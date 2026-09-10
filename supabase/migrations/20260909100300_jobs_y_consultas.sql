-- ============================================================================
-- Casa Numa · 04 · Cola de integraciones, consultas y formularios
-- ============================================================================


-- ----------------------------------------------------------------------------
-- reclamar_jobs(limite, tipos)
-- ----------------------------------------------------------------------------
-- `for update skip locked` es la pieza clave. Si dos ejecuciones del worker se
-- traslapan —el cron dispara cada minuto y una tanda tardó más— la segunda
-- SALTA las filas que la primera tiene bloqueadas, en vez de esperarlas. Sin
-- eso, dos workers tomarían los mismos trabajos y el cliente recibiría el
-- correo dos veces.
--
-- `p_tipos` permite que el worker reclame solo lo que sabe ejecutar, para
-- poder desplegar integraciones por separado sin que las demás fallen en bucle.
-- ----------------------------------------------------------------------------
create or replace function reclamar_jobs(
  p_limite integer default 20,
  p_tipos  job_type[] default null
)
returns setof integration_jobs
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with elegidos as (
    select id from integration_jobs
     where status = 'pending'
       and next_retry_at <= now()
       and (p_tipos is null or type = any(p_tipos))
     order by next_retry_at
     limit p_limite
     for update skip locked
  )
  update integration_jobs j
     set status = 'processing', attempts = j.attempts + 1
    from elegidos e
   where j.id = e.id
  returning j.*;
end;
$$;


create or replace function completar_job(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  -- Al pasar a 'done' se libera la dedupe_key (el índice único solo aplica a
  -- pending/processing), lo que permite la siguiente sincronización.
  update integration_jobs
     set status = 'done', last_error = null
   where id = p_id;
$$;


-- Reintento con espaciado creciente: 1, 4, 9, 16, 25 minutos. Un problema
-- pasajero se resuelve solo; uno permanente se detiene a los 5 intentos y
-- aparece en la tarjeta de alertas del panel.
create or replace function fallar_job(
  p_id uuid, p_error text, p_max integer default 5
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_intentos integer;
begin
  select attempts into v_intentos from integration_jobs where id = p_id;

  if v_intentos >= p_max then
    update integration_jobs set status = 'failed', last_error = p_error
     where id = p_id;
  else
    update integration_jobs
       set status = 'pending', last_error = p_error,
           next_retry_at = now() + make_interval(mins => v_intentos * v_intentos)
     where id = p_id;
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- datos_reserva(id) · todo lo que el worker necesita para un correo
-- ----------------------------------------------------------------------------
create or replace function datos_reserva(p_reservation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reservation_code', r.reservation_code,
    'quantity',         r.quantity,
    'total_amount',     r.total_amount,
    'currency',         r.currency,
    'status',           r.status,
    'companions',       r.companions,
    'customer', jsonb_build_object(
      'full_name', c.full_name, 'email', c.email::text, 'phone', c.phone
    ),
    'workshop', jsonb_build_object(
      'slug', w.slug, 'title', w.title, 'date', w.date,
      'start_time', w.start_time, 'end_time', w.end_time,
      'timezone', w.timezone, 'location', w.location
    )
  )
  from reservations r
  join customers c on c.id = r.customer_id
  join workshops w on w.id = r.workshop_id
  where r.id = p_reservation_id;
$$;


-- ----------------------------------------------------------------------------
-- resumen_taller(id) · para reconstruir el evento de Google Calendar
-- ----------------------------------------------------------------------------
-- El worker RECONSTRUYE la descripción completa desde cero cada vez, en vez de
-- aplicar cambios incrementales. Eso lo hace idempotente por construcción:
-- ejecutarlo dos veces da el mismo resultado que ejecutarlo una.
-- ----------------------------------------------------------------------------
create or replace function resumen_taller(p_workshop_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',            w.id,
    'title',         w.title,
    'date',          w.date,
    'start_time',    w.start_time,
    'end_time',      w.end_time,
    'timezone',      w.timezone,
    'location',      w.location,
    'price',         w.price,
    'currency',      w.currency,
    'capacity',      w.capacity,
    'status',        w.status,
    'google_calendar_event_id', w.google_calendar_event_id,
    'confirmed',     coalesce(v.confirmados, 0),
    'reservations',  coalesce(v.lista, '[]'::jsonb)
  )
  from workshops w
  left join lateral (
    select sum(r.quantity)::int as confirmados,
           jsonb_agg(jsonb_build_object(
             'code', r.reservation_code,
             'name', c.full_name,
             'quantity', r.quantity
           ) order by r.confirmed_at) as lista
      from reservations r
      join customers c on c.id = r.customer_id
     where r.workshop_id = w.id and r.status = 'confirmed'
  ) v on true
  where w.id = p_workshop_id;
$$;


create or replace function guardar_evento_calendar(
  p_workshop_id uuid, p_event_id text
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update workshops set google_calendar_event_id = p_event_id
   where id = p_workshop_id;
$$;


-- ----------------------------------------------------------------------------
-- consultar_reserva(code, email)
-- ----------------------------------------------------------------------------
-- Exige DOS datos, no uno. Abrir la consulta solo con el código invitaría a
-- probar códigos hasta encontrar reservas ajenas. Pedir también el correo hace
-- que solo la dueña pueda verla, sin necesidad de crear cuenta.
--
-- Devuelve null si algo no coincide: nunca distingue entre "código incorrecto"
-- y "correo incorrecto", que sería una pista para adivinar.
-- ----------------------------------------------------------------------------
create or replace function consultar_reserva(p_code text, p_email citext)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reservation_code', r.reservation_code,
    'status',           r.status,
    'quantity',         r.quantity,
    'total_amount',     r.total_amount,
    'currency',         r.currency,
    'expires_at',       r.expires_at,
    'payment_status',   p.status,
    'workshop', jsonb_build_object(
      'slug', w.slug, 'title', w.title, 'date', w.date,
      'start_time', w.start_time, 'end_time', w.end_time,
      'timezone', w.timezone, 'location', w.location
    )
  )
  from reservations r
  join customers c on c.id = r.customer_id
  join workshops w on w.id = r.workshop_id
  left join lateral (
    select status from payments
     where reservation_id = r.id
     order by created_at desc limit 1
  ) p on true
  where upper(r.reservation_code) = upper(p_code)
    and c.email = p_email;
$$;


-- ----------------------------------------------------------------------------
-- reserva_para_pago(id) · valida antes de crear la sesión de Stripe
-- ----------------------------------------------------------------------------
create or replace function reserva_para_pago(p_reservation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_r reservations%rowtype;
  v_w workshops%rowtype;
begin
  select * into v_r from reservations where id = p_reservation_id;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if v_r.status <> 'pending_payment' then
    raise exception 'RESERVATION_EXPIRED'
      using errcode = 'CN007', detail = v_r.status::text;
  end if;

  if v_r.expires_at is null or v_r.expires_at <= now() then
    raise exception 'RESERVATION_EXPIRED'
      using errcode = 'CN007', detail = 'expired';
  end if;

  select * into v_w from workshops where id = v_r.workshop_id;

  -- El precio se recalcula AQUÍ, desde el taller. Aunque alguien manipulara
  -- total_amount, Stripe cobra lo que dice workshops.price.
  return jsonb_build_object(
    'reservation_id',   v_r.id,
    'reservation_code', v_r.reservation_code,
    'quantity',         v_r.quantity,
    'unit_price',       v_w.price,
    'total_amount',     v_w.price * v_r.quantity,
    'currency',         v_w.currency,
    'expires_at',       v_r.expires_at,
    'workshop_id',      v_w.id,
    'workshop_title',   v_w.title,
    'workshop_date',    v_w.date,
    'workshop_start',   v_w.start_time,
    'customer_email',   (select email::text from customers where id = v_r.customer_id)
  );
end;
$$;


create or replace function guardar_checkout_session(
  p_reservation_id uuid, p_session_id text, p_amount numeric, p_currency text
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  insert into payments (
    reservation_id, provider, stripe_checkout_session_id,
    amount, currency, status
  )
  values (p_reservation_id, 'stripe', p_session_id, p_amount,
          upper(coalesce(p_currency, 'MXN')), 'pending')
  on conflict (stripe_checkout_session_id)
    where stripe_checkout_session_id is not null
  do nothing;
$$;


-- ----------------------------------------------------------------------------
-- guardar_prospecto() · contacto y membresía
-- ----------------------------------------------------------------------------
create or replace function guardar_prospecto(
  p_tipo      text,
  p_name      text,
  p_email     citext,
  p_phone     text default null,
  p_message   text default null,
  p_interests text[] default '{}'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Falta el nombre.';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El correo no es válido.';
  end if;

  if p_tipo = 'contacto' then
    if p_message is null or btrim(p_message) = '' then
      raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Falta el mensaje.';
    end if;
    insert into contact_leads (name, email, phone, message)
    values (btrim(p_name), p_email, normalizar_telefono(p_phone), btrim(p_message))
    returning id into v_id;

  elsif p_tipo = 'membresia' then
    insert into membership_leads (name, email, phone, message, interests)
    values (btrim(p_name), p_email, normalizar_telefono(p_phone),
            nullif(btrim(coalesce(p_message, '')), ''), coalesce(p_interests, '{}'))
    returning id into v_id;

  else
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Tipo desconocido.';
  end if;

  -- El aviso por correo va por la cola: si Resend falla, el lead YA quedó
  -- guardado y el envío se reintenta solo. Nunca se pierde un prospecto por
  -- una caída del proveedor de correo.
  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('email_send', p_tipo || '_lead', v_id,
          jsonb_build_object('template', 'admin_lead', 'tipo', p_tipo),
          'email:lead:' || v_id)
  on conflict do nothing;

  return v_id;
end;
$$;


create or replace function datos_prospecto(p_lead_id uuid, p_tipo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if p_tipo = 'contacto' then
    select jsonb_build_object(
      'tipo', 'contacto', 'name', name, 'email', email::text,
      'phone', phone, 'message', message, 'interests', '[]'::jsonb
    ) into v from contact_leads where id = p_lead_id;
  else
    select jsonb_build_object(
      'tipo', 'membresia', 'name', name, 'email', email::text,
      'phone', phone, 'message', message, 'interests', to_jsonb(interests)
    ) into v from membership_leads where id = p_lead_id;
  end if;
  return v;
end;
$$;


-- ----------------------------------------------------------------------------
-- permitir() · límite por IP
-- ----------------------------------------------------------------------------
create or replace function permitir(
  p_clave text, p_maximo integer default 5, p_minutos integer default 10
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ventana timestamptz := date_trunc('hour', now())
    + make_interval(mins => (extract(minute from now())::int / p_minutos) * p_minutos);
  v_conteo integer;
begin
  insert into rate_limit (clave, ventana, conteo)
  values (p_clave, v_ventana, 1)
  on conflict (clave, ventana) do update set conteo = rate_limit.conteo + 1
  returning conteo into v_conteo;

  delete from rate_limit where ventana < now() - interval '1 hour';
  return v_conteo <= p_maximo;
end;
$$;


-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on function reclamar_jobs(integer, job_type[])                      from public, anon, authenticated;
revoke all on function completar_job(uuid)                                     from public, anon, authenticated;
revoke all on function fallar_job(uuid, text, integer)                          from public, anon, authenticated;
revoke all on function datos_reserva(uuid)                                     from public, anon, authenticated;
revoke all on function resumen_taller(uuid)                                    from public, anon, authenticated;
revoke all on function guardar_evento_calendar(uuid, text)                     from public, anon, authenticated;
revoke all on function consultar_reserva(text, citext)                         from public, anon, authenticated;
revoke all on function reserva_para_pago(uuid)                                 from public, anon, authenticated;
revoke all on function guardar_checkout_session(uuid, text, numeric, text)     from public, anon, authenticated;
revoke all on function guardar_prospecto(text, text, citext, text, text, text[]) from public, anon, authenticated;
revoke all on function datos_prospecto(uuid, text)                             from public, anon, authenticated;
revoke all on function permitir(text, integer, integer)                        from public, anon, authenticated;

grant execute on function reclamar_jobs(integer, job_type[])                      to service_role;
grant execute on function completar_job(uuid)                                     to service_role;
grant execute on function fallar_job(uuid, text, integer)                          to service_role;
grant execute on function datos_reserva(uuid)                                     to service_role;
grant execute on function resumen_taller(uuid)                                    to service_role;
grant execute on function guardar_evento_calendar(uuid, text)                     to service_role;
grant execute on function consultar_reserva(text, citext)                         to service_role;
grant execute on function reserva_para_pago(uuid)                                 to service_role;
grant execute on function guardar_checkout_session(uuid, text, numeric, text)     to service_role;
grant execute on function guardar_prospecto(text, text, citext, text, text, text[]) to service_role;
grant execute on function datos_prospecto(uuid, text)                             to service_role;
grant execute on function permitir(text, integer, integer)                        to service_role;
