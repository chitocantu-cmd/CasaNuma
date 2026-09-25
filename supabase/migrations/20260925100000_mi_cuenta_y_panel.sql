-- ============================================================================
-- Casa Numa · 14 · Mi cuenta, novedades y panel con datos reales
-- ----------------------------------------------------------------------------
--   1. cancelar_reserva(): una membresía no cuelga de un taller. Encolaba la
--      sincronización de Calendar con workshop_id NULL, que integration_jobs
--      no acepta, y la cancelación fallaba. Además, el pago que quedaba
--      pendiente (reserva del panel) pasa a 'cancelled'.
--   2. mis_reservas(): lo que ve la clienta en Mi cuenta, sin notas internas.
--      La clienta deja de leer `reservations` directo: la tabla trae
--      internal_notes y el permiso por columna no distingue al equipo de la
--      clienta (los dos son `authenticated`).
--   3. newsletter_subscribers + suscribir_novedades(): el formulario de
--      novedades, con límite de intentos.
--   4. admin_cuentas(): cuentas del sitio para la lista de clientes del panel
--      (auth.users no se lee desde el navegador).
-- ============================================================================


-- ============================================================================
-- 1. cancelar_reserva(...)
-- ============================================================================
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

  -- Un pago que nunca llegó no se queda colgado como pendiente.
  update payments set status = 'cancelled'
   where reservation_id = v_r.id and status = 'pending';

  -- Solo se avisa al cliente si su reserva llegó a estar confirmada.
  if v_r.status = 'confirmed' then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('email_send', 'reservation', v_r.id,
            jsonb_build_object('template', 'cancelacion', 'motivo', p_motivo),
            'email:cancelacion:' || v_r.id)
    on conflict do nothing;
  end if;

  -- La membresía no tiene taller: no hay evento de Calendar que actualizar.
  if v_r.workshop_id is not null then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('calendar_sync', 'workshop', v_r.workshop_id, '{}'::jsonb,
            'calendar:' || v_r.workshop_id)
    on conflict do nothing;
  end if;

  insert into audit_log (actor, action, entity, entity_id, before, after)
  values (p_actor, 'reserva.cancelada', 'reservations', v_r.id::text,
          jsonb_build_object('status', v_r.status),
          jsonb_build_object('status', 'cancelled', 'motivo', p_motivo));

  return 'cancelled';
end;
$$;


-- ============================================================================
-- 2. mis_reservas()
-- ----------------------------------------------------------------------------
-- Las reservas de la cuenta con sesión: las que hizo con ella y las que el
-- equipo registró con su mismo correo (cliente ligado a la cuenta). Trae las
-- sesiones aunque ya estén cerradas y el taller aunque ya no se publique.
--
-- El contacto solo va si el cliente es de esta cuenta: quien reservó con un
-- correo ajeno no ve el nombre ni el teléfono que otra persona dejó ahí.
-- ============================================================================
create or replace function mis_reservas()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(x.fila order by x.creada desc), '[]'::jsonb)
  from (
    select r.created_at as creada, jsonb_build_object(
      'id',               r.id,
      'reservation_code', r.reservation_code,
      'folio',            r.folio,
      'experience_type',  r.experience_type,
      'status',           r.status,
      'quantity',         r.quantity,
      'unit_price',       r.unit_price,
      'total_amount',     r.total_amount,
      'expires_at',       r.expires_at,
      'confirmed_at',     r.confirmed_at,
      'created_at',       r.created_at,
      'updated_at',       r.updated_at,
      'user_id',          r.user_id,
      'origin',           r.origin,
      'workshop',         case when w.id is null then null
                               else jsonb_build_object('slug', w.slug, 'title', w.title) end,
      'month',            m.month,
      'customer',         case when c.user_id = auth.uid()
                               then jsonb_build_object('full_name', c.full_name, 'email', c.email::text, 'phone', c.phone)
                          end,
      'payment', (
        select jsonb_build_object('status', p.status, 'method', p.method, 'paid_at', p.paid_at)
          from payments p
         where p.reservation_id = r.id
         order by (p.status in ('paid', 'refunded')) desc, p.created_at desc
         limit 1),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', s.id, 'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time)
               order by s.date, s.start_time)
          from reservation_items i
          join workshop_sessions s on s.id = i.session_id
         where i.reservation_id = r.id), '[]'::jsonb),
      'children', coalesce((
        select jsonb_agg(jsonb_build_object('name', ch.child_name, 'age', ch.age) order by ch.created_at)
          from reservation_children ch
         where ch.reservation_id = r.id), '[]'::jsonb)
    ) as fila
    from reservations r
    join customers c on c.id = r.customer_id
    left join workshops w on w.id = r.workshop_id
    left join memberships m on m.reservation_id = r.id
    where auth.uid() is not null
      and (r.user_id = auth.uid() or c.user_id = auth.uid())
      and r.status <> 'expired'
  ) x;
$$;

-- La clienta ya no lee la tabla (vería internal_notes). El equipo sigue con
-- admin_lee_reservas.
drop policy if exists cliente_ve_sus_reservas on reservations;


-- ============================================================================
-- 3. Novedades
-- ----------------------------------------------------------------------------
-- Consentimiento aparte de la cuenta: se puede suscribir sin cuenta y tener
-- cuenta sin suscribirse. user_id solo se llena si el correo es el de la
-- cuenta con sesión.
-- ============================================================================
create table if not exists newsletter_subscribers (
  email           citext primary key check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  origen          text not null default 'sitio' check (origen in ('sitio', 'registro')),
  user_id         uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table newsletter_subscribers enable row level security;
revoke all on newsletter_subscribers from anon, authenticated;
grant select on newsletter_subscribers to authenticated;
drop policy if exists admin_lee_novedades on newsletter_subscribers;
create policy admin_lee_novedades on newsletter_subscribers
  for select to authenticated using (es_admin());

create or replace function suscribir_novedades(p_email text, p_origen text default 'sitio')
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  -- PostgREST pasa las cabeceras de la petición; sin ellas (SQL a mano), una
  -- sola clave.
  v_ip    text := coalesce(
    nullif(btrim(split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1)), ''),
    'sin-ip');
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Revisa tu correo, parece incompleto.';
  end if;

  if not permitir('novedades:' || v_ip, 10, 10) then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'CN008',
      detail = 'Espera unos minutos antes de volver a intentar.';
  end if;

  insert into newsletter_subscribers (email, origen, user_id)
  values (
    v_email,
    case when p_origen = 'registro' then 'registro' else 'sitio' end,
    (select id from auth.users where id = auth.uid() and lower(email::text) = v_email)
  )
  on conflict (email) do update
    set unsubscribed_at = null,
        user_id = coalesce(newsletter_subscribers.user_id, excluded.user_id);
end;
$$;


-- ============================================================================
-- 4. admin_cuentas()
-- ----------------------------------------------------------------------------
-- Cuentas de clientas (sin las del equipo). Nombre y teléfono vienen de los
-- metadatos que guarda el registro. A quien no es del equipo no le devuelve
-- nada.
-- ============================================================================
create or replace function admin_cuentas()
returns table (id uuid, email text, nombre text, telefono text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.email::text, u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'telefono', u.created_at
    from auth.users u
   where es_admin()
     and not exists (select 1 from admin_profiles a where a.user_id = u.id)
   order by u.created_at desc;
$$;


-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on function mis_reservas() from public, anon;
grant execute on function mis_reservas() to authenticated;

revoke all on function suscribir_novedades(text, text) from public;
grant execute on function suscribir_novedades(text, text) to anon, authenticated;

revoke all on function admin_cuentas() from public, anon;
grant execute on function admin_cuentas() to authenticated;
