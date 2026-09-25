-- ============================================================================
-- Casa Numa · 13 · Lo que necesita el sitio para leer y escribir la base
-- ----------------------------------------------------------------------------
--   1. Las sesiones de NUMA Kids y membresía se ligan a su fila del catálogo
--      (Tardes de Cerámica · Niños, Clases de Cerámica).
--   2. workshops.booking_type: en línea, con membresía o por mensaje.
--   3. sesiones_ocupacion: lugares ocupados por sesión, para el panel.
--   4. liberar_mi_apartado(): la clienta suelta su propio apartado.
--   5. crear_reserva_panel(): reserva que registra el equipo, con importe.
--   6. registrar_pago_manual(): completa el pago pendiente del panel.
--   7. admin_marcar_reembolso(): el reembolso se hizo fuera (Stripe,
--      transferencia); aquí se registra y el lugar se libera.
-- ============================================================================


-- ============================================================================
-- 1. Sesiones ligadas a su fila del catálogo
-- ----------------------------------------------------------------------------
-- Antes: solo los talleres podían tener workshop_id. Ahora cualquier sesión
-- puede ligarse a su tarjeta; un taller sigue necesitándola.
-- ============================================================================
alter table workshop_sessions drop constraint if exists sesion_de_taller;
alter table workshop_sessions
  add constraint sesion_de_taller check (experience_type <> 'taller' or workshop_id is not null);


-- ============================================================================
-- 2. Cómo se aparta cada fila del catálogo (src/datos/agenda.ts)
-- ============================================================================
alter table workshops
  add column if not exists booking_type text not null default 'online'
    check (booking_type in ('online', 'membership', 'inquiry'));

grant select (booking_type) on workshops to anon, authenticated;


-- ============================================================================
-- 3. Ocupación por sesión
-- ----------------------------------------------------------------------------
-- security_invoker: cada quien ve las sesiones que su RLS le deja ver (el
-- equipo, todas). `occupied` es un número, nunca quién reservó.
-- ============================================================================
create or replace view sesiones_ocupacion
with (security_invoker = on)
as
select
  s.id, s.experience_type, s.workshop_id, s.date, s.start_time, s.end_time,
  s.timezone, s.capacity, s.price, s.currency, s.status,
  lugares_ocupados_sesion(s.id) as occupied
from workshop_sessions s;

grant select on sesiones_ocupacion to authenticated;


-- ============================================================================
-- 4. liberar_mi_apartado(...)
-- ----------------------------------------------------------------------------
-- Si la clienta regresa a cambiar fecha o personas, su apartado anterior no
-- debe seguir ocupando lugar 15 minutos. Solo el suyo (auth.uid()), solo si
-- sigue pendiente y es de la web.
-- ============================================================================
create or replace function liberar_mi_apartado(p_reservation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update reservations
     set status = 'expired', expires_at = null
   where id = p_reservation_id
     and status = 'pending_payment'
     and origin = 'web'
     and (user_id = auth.uid()
          or customer_id in (select id from customers where user_id = auth.uid()));

  if found then
    update payments set status = 'cancelled'
     where reservation_id = p_reservation_id and status = 'pending';
  end if;
end;
$$;


-- ============================================================================
-- 5. crear_reserva_panel(...)
-- ----------------------------------------------------------------------------
-- El equipo registra una reserva (apartó por Instagram, paga en el estudio,
-- taller "Info DM"…). Mismo control de cupo que la web, pero el importe lo
-- captura el equipo y basta una sesión (también una clase suelta de
-- membresía). Tiene folio desde que se crea y aparta hasta que empieza la
-- clase. El método de pago previsto queda en un pago 'pending'.
-- ============================================================================
create or replace function crear_reserva_panel(
  p_session_id uuid,
  p_quantity   integer,
  p_full_name  text,
  p_email      citext,
  p_phone      text,
  p_total      numeric,
  p_method     text,
  p_reference  text  default null,
  p_children   jsonb default '[]'::jsonb,
  p_notes      text  default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s           workshop_sessions%rowtype;
  v_ocupados    integer;
  v_phone       text;
  v_customer_id uuid;
  v_usuario     uuid;
  v_r           reservations%rowtype;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Indica cuántas personas (1 a 10).';
  end if;
  if p_total is null or p_total < 0 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Captura el importe.';
  end if;
  if p_method is null or p_method not in ('transferencia', 'efectivo', 'tarjeta', 'otro') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Método de pago desconocido.';
  end if;
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Falta el nombre.';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El correo no es válido.';
  end if;
  v_phone := normalizar_telefono(p_phone);
  if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El WhatsApp necesita 10 dígitos.';
  end if;

  select * into v_s from workshop_sessions where id = p_session_id for update;
  if not found or v_s.status <> 'open' then
    raise exception 'WORKSHOP_NOT_AVAILABLE' using errcode = 'CN002', detail = 'Ese horario no está abierto.';
  end if;
  if inicio_taller(v_s.date, v_s.start_time, v_s.timezone) <= now() then
    raise exception 'WORKSHOP_IN_PAST' using errcode = 'CN006', detail = 'Ese horario ya pasó.';
  end if;

  if v_s.experience_type = 'kids' and (
       jsonb_typeof(coalesce(p_children, 'null'::jsonb)) <> 'array'
       or jsonb_array_length(p_children) <> p_quantity
       or exists (select 1 from jsonb_array_elements(p_children) c where btrim(coalesce(c->>'name', '')) = '')) then
    raise exception 'INVALID_INPUT' using errcode = 'CN004',
      detail = 'Registra el nombre y la edad de cada niña o niño.';
  end if;

  -- El equipo tampoco puede sobrevender.
  if v_s.capacity is not null then
    v_ocupados := lugares_ocupados_sesion(v_s.id);
    if v_ocupados + p_quantity > v_s.capacity then
      raise exception 'INSUFFICIENT_CAPACITY' using errcode = 'CN001',
        detail = greatest(v_s.capacity - v_ocupados, 0)::text;
    end if;
  end if;

  -- Si la clienta ya tiene cuenta con ese correo, la reserva aparece en su
  -- Mi cuenta.
  select id into v_usuario from auth.users where lower(email) = lower(p_email::text);

  insert into customers (full_name, email, phone, user_id)
  values (btrim(p_full_name), p_email, v_phone, v_usuario)
  on conflict (email) do update
    set full_name  = excluded.full_name,
        phone      = coalesce(excluded.phone, customers.phone),
        user_id    = coalesce(customers.user_id, excluded.user_id),
        updated_at = now()
  returning id into v_customer_id;

  insert into reservations (
    reservation_code, workshop_id, customer_id, quantity,
    unit_price, total_amount, currency, status, expires_at,
    notes, experience_type, user_id, origin
  ) values (
    generar_reservation_code(), v_s.workshop_id, v_customer_id, p_quantity,
    round(p_total / p_quantity, 2), p_total, 'MXN', 'pending_payment',
    inicio_taller(v_s.date, v_s.start_time, v_s.timezone),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_s.experience_type, v_usuario, 'panel'
  )
  returning * into v_r;

  insert into reservation_items (reservation_id, session_id, quantity)
  values (v_r.id, v_s.id, p_quantity);

  if v_s.experience_type = 'kids' then
    insert into reservation_children (reservation_id, child_name, age)
    select v_r.id, btrim(c->>'name'), (c->>'age')::smallint
      from jsonb_array_elements(p_children) c;
  end if;

  insert into payments (reservation_id, provider, amount, currency, status, method, reference)
  values (v_r.id, 'manual', p_total, 'MXN', 'pending', p_method,
          nullif(btrim(coalesce(p_reference, '')), ''));

  insert into audit_log (actor, action, entity, entity_id, after)
  values ('panel', 'reserva.panel', 'reservations', v_r.id::text,
          jsonb_build_object('sesion', v_s.id, 'personas', p_quantity, 'total', p_total));

  return jsonb_build_object(
    'reservation_id',   v_r.id,
    'reservation_code', v_r.reservation_code,
    'folio',            v_r.folio,
    'status',           v_r.status,
    'total_amount',     v_r.total_amount
  );
end;
$$;


-- ============================================================================
-- 6. registrar_pago_manual(...) · completa el pago pendiente
-- ----------------------------------------------------------------------------
-- Igual que en reservas_v2, pero si el panel dejó un pago 'pending' se
-- completa ese (conserva el método y la referencia capturados al crear la
-- reserva, salvo que ahora se manden otros): una reserva, un pago.
-- ============================================================================
create or replace function registrar_pago_manual(
  p_reservation_id uuid,
  p_amount         numeric,
  p_method         text,
  p_reference      text    default null,
  p_avisar_cliente boolean default true,
  p_actor          text    default 'admin'
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r reservations%rowtype;
  v_s workshop_sessions%rowtype;
begin
  if p_method is not null and p_method not in ('transferencia', 'efectivo', 'tarjeta', 'otro') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Método de pago desconocido.';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El monto no puede ser negativo.';
  end if;

  select * into v_r from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if v_r.status in ('confirmed', 'completed') then
    return 'already_confirmed';
  end if;
  if v_r.status not in ('pending_payment', 'expired') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004',
      detail = 'Esta reserva ya no admite pagos.';
  end if;

  -- Apartado vencido: el lugar pudo haberlo tomado alguien más.
  if v_r.status = 'expired' or v_r.expires_at <= now() then
    for v_s in
      select s.* from workshop_sessions s
        join reservation_items i on i.session_id = s.id
       where i.reservation_id = v_r.id
       order by s.id
       for update of s
    loop
      if v_s.capacity is not null
         and lugares_ocupados_sesion(v_s.id, v_r.id) + v_r.quantity > v_s.capacity then
        raise exception 'INSUFFICIENT_CAPACITY' using errcode = 'CN001',
          detail = greatest(v_s.capacity - lugares_ocupados_sesion(v_s.id, v_r.id), 0)::text;
      end if;
    end loop;
  end if;

  update payments
     set status    = 'paid',
         paid_at   = now(),
         amount    = p_amount,
         method    = coalesce(p_method, method, 'transferencia'),
         reference = coalesce(nullif(btrim(coalesce(p_reference, '')), ''), reference)
   where id = (select id from payments
                where reservation_id = v_r.id and provider = 'manual' and status = 'pending'
                order by created_at desc limit 1);

  if not found then
    insert into payments (reservation_id, provider, amount, currency, status, paid_at, method, reference)
    values (v_r.id, 'manual', p_amount, v_r.currency, 'paid', now(), coalesce(p_method, 'transferencia'),
            nullif(btrim(coalesce(p_reference, '')), ''));
  end if;

  update reservations
     set status = 'confirmed', expires_at = null, confirmed_at = now()
   where id = v_r.id;

  perform encolar_avisos_confirmacion(v_r.id, p_avisar_cliente);

  insert into audit_log (actor, action, entity, entity_id, after)
  values (p_actor, 'pago.manual', 'reservations', v_r.id::text,
          jsonb_build_object('monto', p_amount, 'metodo', p_method));

  return 'confirmed';
end;
$$;


-- ============================================================================
-- 7. admin_marcar_reembolso(...)
-- ----------------------------------------------------------------------------
-- El dinero se devolvió fuera del sitio (Stripe, transferencia). Aquí se
-- registra: el pago pasa a 'refunded' y la reserva también, lo que libera el
-- lugar. Los reembolsos hechos en Stripe también llegan solos por el webhook
-- (charge.refunded → registrar_reembolso).
-- ============================================================================
create or replace function admin_marcar_reembolso(
  p_reservation_id uuid,
  p_actor          text default 'admin'
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update payments
     set status = 'refunded', refunded_at = now(), refunded_amount = amount
   where reservation_id = p_reservation_id and status = 'paid';

  if not found then
    raise exception 'INVALID_INPUT' using errcode = 'CN004',
      detail = 'Esta reserva no tiene un pago registrado para reembolsar.';
  end if;

  update reservations
     set status = 'refunded', cancelled_at = coalesce(cancelled_at, now()), expires_at = null
   where id = p_reservation_id;

  insert into audit_log (actor, action, entity, entity_id, after)
  values (p_actor, 'pago.reembolsado', 'reservations', p_reservation_id::text, '{}'::jsonb);

  return 'refunded';
end;
$$;


-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on function liberar_mi_apartado(uuid) from public, anon;
grant execute on function liberar_mi_apartado(uuid) to authenticated, service_role;

revoke all on function crear_reserva_panel(uuid,integer,text,citext,text,numeric,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function registrar_pago_manual(uuid,numeric,text,text,boolean,text) from public, anon, authenticated;
revoke all on function admin_marcar_reembolso(uuid,text) from public, anon, authenticated;
grant execute on function crear_reserva_panel(uuid,integer,text,citext,text,numeric,text,text,jsonb,text) to service_role;
grant execute on function registrar_pago_manual(uuid,numeric,text,text,boolean,text) to service_role;
grant execute on function admin_marcar_reembolso(uuid,text) to service_role;
