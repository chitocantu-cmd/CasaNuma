-- ============================================================================
-- Casa Numa · 11 · Funciones del servidor para reservas v2
-- ----------------------------------------------------------------------------
--   · NUMA Kids: 10 a 14 años ("Talleres octubre numa.docx"), validado aquí.
--   · reserva_para_pago(): lo que Stripe cobra, también para NUMA Kids y
--     membresía (no cuelgan de una fila de workshops).
--   · consultar_reserva(): la pantalla "confirmando tu pago", con folio y
--     las sesiones de cualquier tipo de reserva.
--   · admin_ajustar_cupo(): el cupo de una sesión nunca queda por debajo de
--     lo ya reservado.
-- ============================================================================


-- ============================================================================
-- 1. Edad de NUMA Kids
-- ----------------------------------------------------------------------------
-- crear_reserva_sesiones() ya exige nombre y edad por niño; este trigger pone
-- el rango vigente. Si falla, la reserva completa se deshace (misma
-- transacción): no queda un apartado a medias.
-- ============================================================================
create or replace function validar_edad_nino()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.age < 10 or new.age > 14 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004',
      detail = 'NUMA Kids es para niñas y niños de 10 a 14 años.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_children_edad on reservation_children;
create trigger trg_children_edad
  before insert or update of age on reservation_children
  for each row execute function validar_edad_nino();


-- ============================================================================
-- 2. reserva_para_pago(...) · v2
-- ----------------------------------------------------------------------------
-- El precio es el que calculó la base al apartar (reservations.unit_price,
-- tomado de la sesión o del plan, nunca del navegador). Devuelve también el
-- nombre y las fechas para la página de Stripe.
-- ============================================================================
create or replace function reserva_para_pago(p_reservation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_r reservations%rowtype;
  v_d jsonb;
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

  v_d := datos_reserva(v_r.id);

  return jsonb_build_object(
    'reservation_id',   v_r.id,
    'reservation_code', v_r.reservation_code,
    'experience_type',  v_r.experience_type,
    'quantity',         v_r.quantity,
    'unit_price',       v_r.unit_price,
    'total_amount',     v_r.unit_price * v_r.quantity,
    'currency',         v_r.currency,
    'expires_at',       v_r.expires_at,
    'workshop_id',      v_r.workshop_id,
    'workshop_title',   v_d->'workshop'->>'title',
    'workshop_date',    v_d->'workshop'->>'date',
    'workshop_start',   v_d->'workshop'->>'start_time',
    'sessions',         v_d->'sessions',
    'customer_email',   v_d->'customer'->>'email'
  );
end;
$$;


-- ============================================================================
-- 3. consultar_reserva(...) · v2
-- ----------------------------------------------------------------------------
-- Misma regla que v1: exige código + correo, y no distingue cuál falló.
-- ============================================================================
create or replace function consultar_reserva(p_code text, p_email citext)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select datos_reserva(r.id) - 'customer' - 'companions' || jsonb_build_object(
    'expires_at',     r.expires_at,
    'payment_status', p.status
  )
  from reservations r
  join customers c on c.id = r.customer_id
  left join lateral (
    select status from payments
     where reservation_id = r.id
     order by created_at desc limit 1
  ) p on true
  where upper(r.reservation_code) = upper(p_code)
    and c.email = p_email;
$$;


-- ============================================================================
-- 4. admin_ajustar_cupo(...)
-- ----------------------------------------------------------------------------
-- NULL = cupo sin confirmar ("Cupo limitado"). Un número menor a lo ya
-- reservado se rechaza: dejaría la sesión sobrevendida.
-- ============================================================================
create or replace function admin_ajustar_cupo(
  p_session_id uuid,
  p_capacity   integer,
  p_actor      text default 'admin'
)
returns workshop_sessions
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_s        workshop_sessions%rowtype;
  v_ocupados integer;
begin
  select * into v_s from workshop_sessions where id = p_session_id for update;
  if not found then
    raise exception 'WORKSHOP_NOT_AVAILABLE' using errcode = 'CN002', detail = 'No existe esa sesión.';
  end if;

  if p_capacity is not null then
    if p_capacity < 0 then
      raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El cupo no puede ser negativo.';
    end if;
    v_ocupados := lugares_ocupados_sesion(v_s.id);
    if p_capacity < v_ocupados then
      raise exception 'INVALID_INPUT' using errcode = 'CN004',
        detail = format('Ya hay %s lugares reservados en esa sesión: el cupo no puede ser menor.', v_ocupados);
    end if;
  end if;

  update workshop_sessions set capacity = p_capacity where id = v_s.id returning * into v_s;

  insert into audit_log (actor, action, entity, entity_id, after)
  values (p_actor, 'sesion.cupo', 'workshop_sessions', v_s.id::text,
          jsonb_build_object('capacity', p_capacity));

  return v_s;
end;
$$;


-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on function validar_edad_nino() from public, anon, authenticated;
revoke all on function reserva_para_pago(uuid) from public, anon, authenticated;
revoke all on function consultar_reserva(text, citext) from public, anon, authenticated;
revoke all on function admin_ajustar_cupo(uuid, integer, text) from public, anon, authenticated;

grant execute on function reserva_para_pago(uuid) to service_role;
grant execute on function consultar_reserva(text, citext) to service_role;
grant execute on function admin_ajustar_cupo(uuid, integer, text) to service_role;
