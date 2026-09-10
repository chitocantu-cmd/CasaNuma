-- ============================================================================
-- Casa Numa · 03 · Funciones transaccionales
-- ----------------------------------------------------------------------------
-- Aquí vive el control de cupo. NO puede vivir en React ni en la Edge Function:
-- tiene que estar donde están los datos y el bloqueo de fila.
--
-- Todas son SECURITY DEFINER con `set search_path` fijo. Lo segundo no es
-- decorativo: una función SECURITY DEFINER sin search_path fijo es una vía de
-- escalación de privilegios, porque quien la llama puede anteponer un esquema
-- propio y suplantar las tablas.
--
-- Códigos de error que la Edge Function traduce a HTTP:
--   CN001  INSUFFICIENT_CAPACITY   -> 409 (detail = lugares disponibles)
--   CN002  WORKSHOP_NOT_AVAILABLE  -> 404
--   CN003  WORKSHOP_REQUIRES_QUOTE -> 400
--   CN004  INVALID_INPUT           -> 400
--   CN005  RESERVATION_NOT_FOUND   -> 404
--   CN006  WORKSHOP_IN_PAST        -> 409
--   CN007  RESERVATION_EXPIRED     -> 409
-- ============================================================================


-- ----------------------------------------------------------------------------
-- inicio_taller(date, time, timezone) -> timestamptz
-- ----------------------------------------------------------------------------
-- Convierte fecha + hora locales del taller a un instante absoluto.
--
-- Esto es lo que evita el bug clásico: comparar una fecha "2026-09-12" contra
-- now() sin zona horaria hace que el taller parezca pasado (o futuro) por
-- varias horas, según dónde corra el servidor. Los servidores corren en UTC;
-- Casa Numa opera en America/Monterrey.
-- ----------------------------------------------------------------------------
create or replace function inicio_taller(
  p_date date, p_start time, p_tz text
)
returns timestamptz
language sql
immutable
as $$
  select ((p_date + p_start) at time zone coalesce(p_tz, 'America/Monterrey'));
$$;


-- ----------------------------------------------------------------------------
-- lugares_ocupados(workshop, excluir)
-- ----------------------------------------------------------------------------
-- LA fórmula de disponibilidad, definida en un solo lugar. La usan la vista
-- pública, la RPC de reserva y el panel de admin, así que no puede haber dos
-- versiones que se contradigan.
--
--   ocupados = confirmadas + holds cuyo expires_at todavía no vence
--
-- Nota clave: `expires_at > now()` hace que un hold vencido deje de contar
-- AUTOMÁTICAMENTE, sin que ningún proceso corra. El lugar se libera solo, en
-- el instante exacto. Por eso, aunque el cron muera, es imposible sobrevender:
-- el cron solo existe para que el panel no muestre reservas fantasma.
--
-- `p_excluir` permite recontar ignorando una reserva concreta, que es lo que
-- necesita el webhook al revalidar cupo antes de confirmar.
-- ----------------------------------------------------------------------------
create or replace function lugares_ocupados(
  p_workshop_id uuid,
  p_excluir     uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(quantity), 0)::integer
    from reservations
   where workshop_id = p_workshop_id
     and (p_excluir is null or id <> p_excluir)
     and (
       status = 'confirmed'
       or (status = 'pending_payment' and expires_at > now())
     );
$$;


-- ----------------------------------------------------------------------------
-- disponibilidad(workshop) -> jsonb
-- ----------------------------------------------------------------------------
-- Desglose para el panel: confirmados, bloqueados temporalmente y disponibles
-- son tres números distintos. Si Casa Numa ve "14 ocupados" sin saber que 2
-- son holds a medio pagar, toma decisiones equivocadas al teléfono.
-- ----------------------------------------------------------------------------
create or replace function disponibilidad(p_workshop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'capacity',  w.capacity,
    'confirmed', coalesce(c.n, 0),
    'holds',     coalesce(h.n, 0),
    'available', greatest(w.capacity - coalesce(c.n, 0) - coalesce(h.n, 0), 0)
  )
  from workshops w
  left join lateral (
    select sum(quantity)::int n from reservations
     where workshop_id = w.id and status = 'confirmed'
  ) c on true
  left join lateral (
    select sum(quantity)::int n from reservations
     where workshop_id = w.id
       and status = 'pending_payment' and expires_at > now()
  ) h on true
  where w.id = p_workshop_id;
$$;


-- ============================================================================
-- crear_reserva(...)  ·  RESERVA ATÓMICA
-- ----------------------------------------------------------------------------
-- El escenario que esta función resuelve:
--
--   Queda 1 lugar. Dos personas presionan "Reservar" en el mismo milisegundo.
--
-- Sin bloqueo, ambas leerían "1 disponible" antes de que cualquiera escriba,
-- ambas pasarían la validación, y el taller quedaría sobrevendido.
--
-- `select ... for update` toma un bloqueo exclusivo sobre la fila del taller
-- hasta que la transacción termina. PostgreSQL pone a las dos peticiones en
-- fila: la primera cuenta, inserta y hace commit; la segunda entra DESPUÉS,
-- vuelve a contar —ya con la inserción de la primera visible— y falla con
-- INSUFFICIENT_CAPACITY. No queda ninguna ventana entre leer y escribir.
--
-- El bloqueo es por taller, así que reservas de talleres distintos siguen
-- ocurriendo en paralelo.
--
-- EL PRECIO NUNCA VIENE DEL CLIENTE. Se lee de workshops dentro de la misma
-- transacción. No existe ningún parámetro por donde meter un precio falso.
-- ============================================================================
create or replace function crear_reserva(
  p_slug        text,
  p_quantity    integer,
  p_full_name   text,
  p_email       citext,
  p_phone       text,
  p_companions  text default null,
  p_notes       text default null,
  p_hold_minutos integer default 10
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_w           workshops%rowtype;
  v_ocupados    integer;
  v_disponibles integer;
  v_customer_id uuid;
  v_phone       text;
  v_r           reservations%rowtype;
begin
  ---------------------------------------------------------------------------
  -- 6. Validar quantity y datos de contacto.
  --    La validación del front es buena UX, pero no es seguridad: aquí se
  --    vuelve a hacer, y esta sí no se puede saltar.
  ---------------------------------------------------------------------------
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'INVALID_INPUT'
      using errcode = 'CN004', detail = 'La cantidad debe estar entre 1 y 10.';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'INVALID_INPUT'
      using errcode = 'CN004', detail = 'Falta el nombre.';
  end if;

  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT'
      using errcode = 'CN004', detail = 'El correo no es válido.';
  end if;

  v_phone := normalizar_telefono(p_phone);
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then
    raise exception 'INVALID_INPUT'
      using errcode = 'CN004', detail = 'El WhatsApp necesita 10 dígitos.';
  end if;

  ---------------------------------------------------------------------------
  -- 1 y 2. Localizar el taller y BLOQUEAR la fila.
  --        Todo lo que sigue ve una foto congelada.
  ---------------------------------------------------------------------------
  select * into v_w from workshops where slug = p_slug for update;

  if not found then
    raise exception 'WORKSHOP_NOT_AVAILABLE'
      using errcode = 'CN002', detail = 'No existe ese taller.';
  end if;

  ---------------------------------------------------------------------------
  -- 3. Verificar que esté publicado.
  ---------------------------------------------------------------------------
  if v_w.status <> 'published' then
    raise exception 'WORKSHOP_NOT_AVAILABLE'
      using errcode = 'CN002', detail = 'Este taller no está disponible.';
  end if;

  if v_w.booking_mode <> 'paid' then
    raise exception 'WORKSHOP_REQUIRES_QUOTE'
      using errcode = 'CN003', detail = 'Este taller se cotiza a la medida.';
  end if;

  ---------------------------------------------------------------------------
  -- 4. Verificar que la fecha no haya pasado, en la zona horaria del taller.
  ---------------------------------------------------------------------------
  if inicio_taller(v_w.date, v_w.start_time, v_w.timezone) <= now() then
    raise exception 'WORKSHOP_IN_PAST'
      using errcode = 'CN006', detail = 'Este taller ya ocurrió.';
  end if;

  ---------------------------------------------------------------------------
  -- 5 y 7. Contar ocupados y calcular disponibilidad.
  --        En READ COMMITTED esta consulta corre con un snapshot nuevo tomado
  --        DESPUÉS de que se liberó el bloqueo, así que ve las inserciones que
  --        acaba de confirmar la transacción anterior. Eso es exactamente lo
  --        que hace correcta la validación.
  ---------------------------------------------------------------------------
  v_ocupados    := lugares_ocupados(v_w.id);
  v_disponibles := greatest(v_w.capacity - v_ocupados, 0);

  if p_quantity > v_disponibles then
    raise exception 'INSUFFICIENT_CAPACITY'
      using errcode = 'CN001',
            detail  = v_disponibles::text,
            hint    = format('Se pidieron %s y quedan %s.', p_quantity, v_disponibles);
  end if;

  ---------------------------------------------------------------------------
  -- 8. Crear el cliente o reutilizarlo. El correo normalizado (citext) es la
  --    identidad; el nombre y el teléfono se actualizan al más reciente.
  ---------------------------------------------------------------------------
  insert into customers (full_name, email, phone)
  values (btrim(p_full_name), p_email, v_phone)
  on conflict (email) do update
    set full_name  = excluded.full_name,
        phone      = coalesce(excluded.phone, customers.phone),
        updated_at = now()
  returning id into v_customer_id;

  ---------------------------------------------------------------------------
  -- 9 y 10. Crear la reserva con su vencimiento.
  ---------------------------------------------------------------------------
  insert into reservations (
    reservation_code, workshop_id, customer_id, quantity,
    unit_price, total_amount, currency, status, expires_at,
    companions, notes
  ) values (
    generar_reservation_code(), v_w.id, v_customer_id, p_quantity,
    v_w.price, v_w.price * p_quantity, v_w.currency,
    'pending_payment', now() + make_interval(mins => p_hold_minutos),
    nullif(btrim(coalesce(p_companions, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_r;

  ---------------------------------------------------------------------------
  -- 11. Devolver la reserva.
  ---------------------------------------------------------------------------
  return jsonb_build_object(
    'reservation_id',   v_r.id,
    'reservation_code', v_r.reservation_code,
    'quantity',         v_r.quantity,
    'unit_price',       v_r.unit_price,
    'total_amount',     v_r.total_amount,
    'currency',         v_r.currency,
    'expires_at',       v_r.expires_at,
    'customer_id',      v_customer_id,
    'workshop', jsonb_build_object(
      'id', v_w.id, 'slug', v_w.slug, 'title', v_w.title,
      'date', v_w.date, 'start_time', v_w.start_time,
      'end_time', v_w.end_time, 'timezone', v_w.timezone,
      'location', v_w.location, 'price', v_w.price
    )
  );
end;
$$;


-- ============================================================================
-- confirmar_pago(...)  ·  la transacción del webhook
-- ----------------------------------------------------------------------------
-- Una sola transacción, corta: registra el pago, revalida cupo, confirma la
-- reserva y encola los efectos secundarios. NADA de correos ni llamadas a
-- Google aquí dentro: si Google tarda 8 segundos, el webhook expira, Stripe
-- reintenta, y acabamos con correos duplicados.
--
-- Es IDEMPOTENTE: llamarla dos veces devuelve 'already_confirmed' la segunda y
-- no cambia nada. Eso permite que el webhook y la verificación de respaldo de
-- la pantalla de éxito compitan sin riesgo.
--
-- Resultados:
--   'confirmed'          -> todo bien
--   'already_confirmed'  -> duplicado, no se hizo nada
--   'needs_review'       -> pagó pero ya no hay cupo (ver abajo)
--   'cancelled'          -> la reserva se canceló antes de que llegara el pago
-- ============================================================================
create or replace function confirmar_pago(
  p_reservation_id  uuid,
  p_session_id      text,
  p_intent_id       text,
  p_amount          numeric,
  p_currency        text,
  p_provider_status text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r        reservations%rowtype;
  v_w        workshops%rowtype;
  v_ocupados integer;
begin
  -- Bloquea la reserva: dos webhooks simultáneos se serializan aquí.
  select * into v_r from reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if v_r.status = 'confirmed' then
    return 'already_confirmed';
  end if;

  if v_r.status = 'cancelled' then
    return 'cancelled';
  end if;

  -------------------------------------------------------------------------
  -- Revalidación de cupo antes de confirmar.
  --
  -- Caso real: el hold dura 10 minutos, pero Stripe no permite sesiones de
  -- Checkout que expiren en menos de 30. Así que existe una ventana en la que
  -- alguien puede pagar después de que su hold venció y otra persona tomó el
  -- lugar.
  --
  -- Aceptar el pago a ciegas sería sobreventa. Rechazarlo en silencio sería
  -- quedarse con el dinero. Lo correcto es: registrar el pago (el dinero
  -- existe y hay que poder devolverlo), NO confirmar la reserva, y marcarla
  -- para revisión manual. No se pierde información.
  -------------------------------------------------------------------------
  select * into v_w from workshops where id = v_r.workshop_id for update;
  v_ocupados := lugares_ocupados(v_w.id, v_r.id);

  if v_ocupados + v_r.quantity > v_w.capacity then
    insert into payments (
      reservation_id, provider, stripe_checkout_session_id,
      stripe_payment_intent_id, amount, currency, status, provider_status,
      paid_at, needs_review, review_reason
    ) values (
      v_r.id, 'stripe', p_session_id, p_intent_id, p_amount,
      upper(coalesce(p_currency, 'MXN')), 'paid', p_provider_status, now(),
      true,
      format('Pago recibido tras vencer el hold; el cupo ya estaba tomado (%s/%s). Requiere reembolso o reacomodo manual.',
             v_ocupados, v_w.capacity)
    )
    on conflict (stripe_payment_intent_id) where stripe_payment_intent_id is not null
    do update set status = 'paid', needs_review = true;

    insert into audit_log (actor, action, entity, entity_id, after)
    values ('webhook', 'pago.sin_cupo', 'reservations', v_r.id::text,
            jsonb_build_object('intent', p_intent_id));

    return 'needs_review';
  end if;

  -------------------------------------------------------------------------
  -- Registro del pago
  -------------------------------------------------------------------------
  insert into payments (
    reservation_id, provider, stripe_checkout_session_id,
    stripe_payment_intent_id, amount, currency, status, provider_status, paid_at
  ) values (
    v_r.id, 'stripe', p_session_id, p_intent_id, p_amount,
    upper(coalesce(p_currency, 'MXN')), 'paid', p_provider_status, now()
  )
  on conflict (stripe_payment_intent_id) where stripe_payment_intent_id is not null
  do update set status          = 'paid',
                provider_status = excluded.provider_status,
                paid_at         = coalesce(payments.paid_at, now());

  -------------------------------------------------------------------------
  -- Confirmación. expires_at pasa a NULL: el lugar ya es definitivo.
  -------------------------------------------------------------------------
  update reservations
     set status = 'confirmed', expires_at = null, confirmed_at = now()
   where id = v_r.id;

  -------------------------------------------------------------------------
  -- Encolado de efectos secundarios
  -------------------------------------------------------------------------
  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('email_send', 'reservation', v_r.id,
          jsonb_build_object('template', 'confirmacion'),
          'email:confirmacion:' || v_r.id)
  on conflict do nothing;

  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('email_send', 'reservation', v_r.id,
          jsonb_build_object('template', 'admin_reserva'),
          'email:admin_reserva:' || v_r.id)
  on conflict do nothing;

  -- Coalescencia: mientras haya una sincronización pendiente para este taller
  -- no se encola otra; cuando corra, ya reflejará todos los pagos acumulados.
  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('calendar_sync', 'workshop', v_w.id, '{}'::jsonb,
          'calendar:' || v_w.id)
  on conflict do nothing;

  insert into audit_log (actor, action, entity, entity_id, after)
  values ('webhook', 'reserva.confirmada', 'reservations', v_r.id::text,
          jsonb_build_object('intent', p_intent_id, 'amount', p_amount));

  return 'confirmed';
end;
$$;


-- ----------------------------------------------------------------------------
-- marcar_pago_fallido()
-- ----------------------------------------------------------------------------
-- Deliberadamente NO libera el lugar: el cliente puede reintentar con otra
-- tarjeta sin perder su reserva. El hold se encarga de liberarlo si se rinde.
-- ----------------------------------------------------------------------------
create or replace function marcar_pago_fallido(
  p_reservation_id uuid,
  p_intent_id      text,
  p_motivo         text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update payments
     set status = 'failed', failure_reason = p_motivo
   where reservation_id = p_reservation_id
     and status = 'pending';

  insert into audit_log (actor, action, entity, entity_id, after)
  values ('webhook', 'pago.fallido', 'reservations', p_reservation_id::text,
          jsonb_build_object('intent', p_intent_id, 'motivo', p_motivo));
end;
$$;


-- ----------------------------------------------------------------------------
-- registrar_reembolso()
-- ----------------------------------------------------------------------------
-- Cubre tanto los reembolsos que Casa Numa hace a mano desde el panel de
-- Stripe como cualquier automático. Por eso el panel queda conciliado sin que
-- nadie capture nada: se hace el refund en Stripe y el sistema se entera solo.
-- ----------------------------------------------------------------------------
create or replace function registrar_reembolso(
  p_intent_id text,
  p_monto     numeric
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation_id uuid;
  v_workshop_id    uuid;
begin
  update payments
     set status = 'refunded', refunded_at = now(), refunded_amount = p_monto
   where stripe_payment_intent_id = p_intent_id
  returning reservation_id into v_reservation_id;

  if v_reservation_id is null then
    return 'payment_not_found';
  end if;

  -- La reserva pasa a 'refunded', lo que libera el cupo automáticamente
  -- (la fórmula de disponibilidad solo cuenta 'confirmed' y holds vivos).
  update reservations
     set status = 'refunded', cancelled_at = coalesce(cancelled_at, now())
   where id = v_reservation_id
     and status in ('confirmed', 'cancelled')
  returning workshop_id into v_workshop_id;

  if v_workshop_id is not null then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('calendar_sync', 'workshop', v_workshop_id, '{}'::jsonb,
            'calendar:' || v_workshop_id)
    on conflict do nothing;
  end if;

  insert into audit_log (actor, action, entity, entity_id, after)
  values ('webhook', 'pago.reembolsado', 'reservations', v_reservation_id::text,
          jsonb_build_object('monto', p_monto));

  return 'refunded';
end;
$$;


-- ----------------------------------------------------------------------------
-- cancelar_reserva()
-- ----------------------------------------------------------------------------
-- El cupo se libera solo: la fórmula de disponibilidad deja de contar las
-- reservas canceladas. No hay ningún contador que ajustar.
--
-- NO hace reembolso en Stripe. El panel debe advertirlo explícitamente.
-- ----------------------------------------------------------------------------
create or replace function cancelar_reserva(
  p_reservation_id uuid,
  p_motivo         text default null,
  p_actor          text default 'admin'
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r reservations%rowtype;
begin
  select * into v_r from reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if v_r.status = 'cancelled' then
    return 'already_cancelled';
  end if;

  update reservations
     set status = 'cancelled', expires_at = null,
         cancelled_at = now(), cancellation_reason = p_motivo
   where id = v_r.id;

  -- Solo se avisa al cliente si su reserva llegó a estar confirmada.
  if v_r.status = 'confirmed' then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('email_send', 'reservation', v_r.id,
            jsonb_build_object('template', 'cancelacion', 'motivo', p_motivo),
            'email:cancelacion:' || v_r.id)
    on conflict do nothing;
  end if;

  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('calendar_sync', 'workshop', v_r.workshop_id, '{}'::jsonb,
          'calendar:' || v_r.workshop_id)
  on conflict do nothing;

  insert into audit_log (actor, action, entity, entity_id, before, after)
  values (p_actor, 'reserva.cancelada', 'reservations', v_r.id::text,
          jsonb_build_object('status', v_r.status),
          jsonb_build_object('status', 'cancelled', 'motivo', p_motivo));

  return 'cancelled';
end;
$$;


-- ----------------------------------------------------------------------------
-- expirar_holds()
-- ----------------------------------------------------------------------------
-- Mantenimiento cosmético. Los lugares YA estaban libres desde el instante del
-- vencimiento, porque lugares_ocupados() filtra por `expires_at > now()`. Esto
-- solo evita que el panel muestre reservas fantasma.
--
-- No borra nada: la reserva queda como registro histórico con su Stripe
-- Checkout asociado, por si hace falta investigar.
-- ----------------------------------------------------------------------------
create or replace function expirar_holds()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update reservations
     set status = 'expired', expires_at = null
   where status = 'pending_payment'
     and expires_at < now();
  get diagnostics v_n = row_count;

  -- Los pagos que nunca se completaron quedan como 'cancelled', no colgados.
  update payments p
     set status = 'cancelled'
    from reservations r
   where p.reservation_id = r.id
     and r.status = 'expired'
     and p.status = 'pending';

  return v_n;
end;
$$;


-- ----------------------------------------------------------------------------
-- completar_talleres_pasados()
-- ----------------------------------------------------------------------------
-- Mueve a 'completed' los talleres publicados cuya hora de fin ya pasó, para
-- que dejen de aparecer en la agenda pública sin perder su historial.
-- ----------------------------------------------------------------------------
create or replace function completar_talleres_pasados()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update workshops
     set status = 'completed'
   where status = 'published'
     and ((date + end_time) at time zone timezone) < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


-- ============================================================================
-- Permisos: estas funciones escriben. Solo el backend (service_role) las
-- invoca; el navegador nunca, ni siquiera con sesión de admin.
-- ============================================================================
revoke all on function crear_reserva(text,integer,text,citext,text,text,text,integer) from public, anon, authenticated;
revoke all on function confirmar_pago(uuid,text,text,numeric,text,text)               from public, anon, authenticated;
revoke all on function marcar_pago_fallido(uuid,text,text)                            from public, anon, authenticated;
revoke all on function registrar_reembolso(text,numeric)                              from public, anon, authenticated;
revoke all on function cancelar_reserva(uuid,text,text)                               from public, anon, authenticated;
revoke all on function expirar_holds()                                                from public, anon, authenticated;
revoke all on function completar_talleres_pasados()                                   from public, anon, authenticated;

grant execute on function crear_reserva(text,integer,text,citext,text,text,text,integer) to service_role;
grant execute on function confirmar_pago(uuid,text,text,numeric,text,text)               to service_role;
grant execute on function marcar_pago_fallido(uuid,text,text)                            to service_role;
grant execute on function registrar_reembolso(text,numeric)                              to service_role;
grant execute on function cancelar_reserva(uuid,text,text)                               to service_role;
grant execute on function expirar_holds()                                                to service_role;
grant execute on function completar_talleres_pasados()                                   to service_role;

-- Solo lectura: las usan la vista pública y el panel.
grant execute on function lugares_ocupados(uuid, uuid) to anon, authenticated, service_role;
grant execute on function disponibilidad(uuid)         to authenticated, service_role;
grant execute on function inicio_taller(date, time, text) to anon, authenticated, service_role;
