-- ============================================================================
-- Casa Numa · 18 · Toda reserva en línea se confirma con el 50 % del total
-- ----------------------------------------------------------------------------
-- La regla del sitio (src/config/reservas.ts, src/lib/anticipo.ts) la hace
-- valer la base:
--
--   · al apartar en la web, la reserva guarda su anticipo: el 50 % del total
--     (precio × personas), redondeado hacia abajo al centavo; el centavo de
--     más queda en el saldo;
--   · Stripe cobra SOLO el anticipo (reserva_para_pago → amount_due);
--   · amount_paid es la suma de los pagos cobrados (anticipo + saldo en el
--     estudio); remaining_balance = total − pagado;
--   · payment_status: pending → deposit_paid → paid_in_full (o refunded);
--   · admin_liquidar_saldo() registra el cobro del saldo en el estudio sin
--     borrar el anticipo (queda su propio pago).
--
-- Las reservas que registra el equipo en el panel (origin = 'panel') no
-- llevan anticipo: se pagan completas como hasta ahora.
-- ============================================================================

-- La única fuente del porcentaje en la base. Igual a CONFIG_RESERVAS.
create or replace function anticipo_porcentaje()
returns numeric
language sql
immutable
as $$ select 50::numeric $$;


-- ----------------------------------------------------------------------------
-- 1. Columnas del cobro
-- ----------------------------------------------------------------------------
alter table reservations
  add column if not exists deposit_percentage   numeric(5,2),
  add column if not exists deposit_amount       numeric(10,2) check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists amount_paid          numeric(10,2) not null default 0 check (amount_paid >= 0),
  add column if not exists final_payment_amount numeric(10,2);

alter table reservations
  add column if not exists remaining_balance numeric(10,2)
    generated always as (total_amount - amount_paid) stored;

alter table reservations
  add column if not exists payment_status text
    generated always as (
      case
        when status = 'refunded' then 'refunded'
        when amount_paid <= 0 then 'pending'
        when amount_paid < total_amount then 'deposit_paid'
        else 'paid_in_full'
      end
    ) stored;


-- ----------------------------------------------------------------------------
-- 2. El anticipo se fija al apartar en la web
-- ----------------------------------------------------------------------------
create or replace function fijar_anticipo()
returns trigger
language plpgsql
as $$
begin
  if new.origin = 'web' and new.deposit_amount is null then
    new.deposit_percentage := anticipo_porcentaje();
    -- En centavos: floor(total × 50 %) / 100. $1,600 → $800; $455.01 → $227.50.
    new.deposit_amount := floor(new.total_amount * anticipo_porcentaje()) / 100;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fijar_anticipo on reservations;
create trigger trg_fijar_anticipo
  before insert on reservations
  for each row execute function fijar_anticipo();


-- ----------------------------------------------------------------------------
-- 3. Lo pagado sale de los pagos cobrados (Stripe, manual, saldo)
-- ----------------------------------------------------------------------------
create or replace function sincronizar_pagado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.reservation_id, old.reservation_id);
begin
  update reservations
     set amount_paid = coalesce((
           select sum(p.amount - coalesce(p.refunded_amount, 0))
             from payments p
            where p.reservation_id = v_id and p.status = 'paid'), 0)
   where id = v_id;
  return null;
end;
$$;

drop trigger if exists trg_sincronizar_pagado on payments;
create trigger trg_sincronizar_pagado
  after insert or update of status, amount, refunded_amount or delete on payments
  for each row execute function sincronizar_pagado();

-- Las reservas que ya existían: lo pagado según sus pagos.
update reservations r
   set amount_paid = coalesce((
         select sum(p.amount - coalesce(p.refunded_amount, 0))
           from payments p where p.reservation_id = r.id and p.status = 'paid'), 0);


-- ----------------------------------------------------------------------------
-- 4. reserva_para_pago · v3: lo que cobra Stripe es amount_due (el anticipo)
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
    'reservation_id',     v_r.id,
    'reservation_code',   v_r.reservation_code,
    'experience_type',    v_r.experience_type,
    'quantity',           v_r.quantity,
    'unit_price',         v_r.unit_price,
    'total_amount',       v_r.total_amount,
    'deposit_percentage', v_r.deposit_percentage,
    'deposit_amount',     v_r.deposit_amount,
    -- Lo único que debe cobrar Stripe: el anticipo, o el total si no lo hay.
    'amount_due',         coalesce(v_r.deposit_amount, v_r.total_amount),
    'remaining_after',    v_r.total_amount - coalesce(v_r.deposit_amount, v_r.total_amount),
    'currency',           v_r.currency,
    'expires_at',         v_r.expires_at,
    'workshop_id',        v_r.workshop_id,
    'workshop_title',     v_d->'workshop'->>'title',
    'workshop_date',      v_d->'workshop'->>'date',
    'workshop_start',     v_d->'workshop'->>'start_time',
    'sessions',           v_d->'sessions',
    'customer_email',     v_d->'customer'->>'email'
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. confirmar_pago · v4: si Stripe cobró menos del anticipo, no se confirma
-- ----------------------------------------------------------------------------
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
  v_s        workshop_sessions%rowtype;
  v_ocupados integer;
  v_motivo   text;
  v_esperado numeric;
begin
  select * into v_r from reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if v_r.status in ('confirmed', 'completed') then
    return 'already_confirmed';
  end if;

  if v_r.status = 'cancelled' then
    return 'cancelled';
  end if;

  -- Lo cobrado debe cubrir al menos el anticipo. Si fue más (p. ej. una
  -- sesión de Stripe creada antes de esta regla), se confirma y lo pagado
  -- de más queda a favor en amount_paid.
  v_esperado := coalesce(v_r.deposit_amount, v_r.total_amount);
  if p_amount is not null and p_amount + 0.005 < v_esperado then
    v_motivo := format('Stripe cobró %s y el anticipo requerido es %s. Revisar antes de confirmar.', p_amount, v_esperado);
  end if;

  -------------------------------------------------------------------------
  -- Revalidación de cupo (ver la explicación larga en v1).
  -------------------------------------------------------------------------
  if v_motivo is null and exists (select 1 from reservation_items where reservation_id = v_r.id) then
    for v_s in
      select s.* from workshop_sessions s
        join reservation_items i on i.session_id = s.id
       where i.reservation_id = v_r.id
       order by s.id
       for update of s
    loop
      if v_s.capacity is not null then
        v_ocupados := lugares_ocupados_sesion(v_s.id, v_r.id);
        if v_ocupados + v_r.quantity > v_s.capacity then
          v_motivo := format(
            'Pago recibido tras vencer el apartado; la sesión del %s %s ya estaba llena (%s/%s). Requiere reembolso o reacomodo manual.',
            v_s.date, to_char(v_s.start_time, 'HH24:MI'), v_ocupados, v_s.capacity);
          exit;
        end if;
      end if;
    end loop;
  elsif v_motivo is null and v_r.workshop_id is not null then
    select * into v_w from workshops where id = v_r.workshop_id for update;
    v_ocupados := lugares_ocupados(v_w.id, v_r.id);
    if v_w.capacity is not null and v_ocupados + v_r.quantity > v_w.capacity then
      v_motivo := format(
        'Pago recibido tras vencer el hold; el cupo ya estaba tomado (%s/%s). Requiere reembolso o reacomodo manual.',
        v_ocupados, v_w.capacity);
    end if;
  end if;

  if v_motivo is not null then
    -- El dinero existe: se registra y se marca para revisión. La reserva NO
    -- se confirma.
    perform registrar_pago_stripe(v_r.id, p_session_id, p_intent_id, p_amount,
                                  p_currency, p_provider_status, true, v_motivo);

    insert into audit_log (actor, action, entity, entity_id, after)
    values ('webhook', 'pago.revision', 'reservations', v_r.id::text,
            jsonb_build_object('intent', p_intent_id, 'motivo', v_motivo));

    return 'needs_review';
  end if;

  perform registrar_pago_stripe(v_r.id, p_session_id, p_intent_id, p_amount,
                                p_currency, p_provider_status);

  -- El trigger asigna el folio aquí; amount_paid lo pone el trigger de pagos.
  update reservations
     set status = 'confirmed', expires_at = null, confirmed_at = now()
   where id = v_r.id;

  perform encolar_avisos_confirmacion(v_r.id, true);

  if v_r.workshop_id is not null then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('calendar_sync', 'workshop', v_r.workshop_id, '{}'::jsonb,
            'calendar:' || v_r.workshop_id)
    on conflict do nothing;
  end if;

  insert into audit_log (actor, action, entity, entity_id, after)
  values ('webhook', 'reserva.confirmada', 'reservations', v_r.id::text,
          jsonb_build_object('intent', p_intent_id, 'amount', p_amount, 'deposit', v_r.deposit_amount));

  return 'confirmed';
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. admin_liquidar_saldo(): el saldo se cobra en el estudio
-- ----------------------------------------------------------------------------
-- deposit_paid → paid_in_full. El anticipo conserva su propio pago; el saldo
-- entra como otro pago (manual) y queda en final_payment_amount.
create or replace function admin_liquidar_saldo(
  p_reservation_id uuid,
  p_method         text,
  p_actor          text default 'admin'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_r     reservations%rowtype;
  v_saldo numeric;
begin
  if p_method is null or p_method not in ('transferencia', 'efectivo', 'tarjeta', 'otro') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Indica cómo pagó el saldo.';
  end if;

  select * into v_r from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;
  if v_r.deposit_amount is null then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Esta reserva no se paga por anticipo.';
  end if;
  if v_r.status not in ('confirmed', 'completed') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Solo se cobra el saldo de una reserva confirmada.';
  end if;

  v_saldo := v_r.total_amount - v_r.amount_paid;
  if v_saldo <= 0 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Esta reserva ya no tiene saldo pendiente.';
  end if;

  insert into payments (reservation_id, provider, amount, currency, status, paid_at, method, reference)
  values (v_r.id, 'manual', v_saldo, v_r.currency, 'paid', now(), p_method, 'Saldo en el estudio');

  update reservations
     set final_payment_amount = coalesce(final_payment_amount, 0) + v_saldo
   where id = v_r.id;

  insert into audit_log (actor, action, entity, entity_id, after)
  values (p_actor, 'pago.saldo', 'reservations', v_r.id::text,
          jsonb_build_object('monto', v_saldo, 'metodo', p_method));

  return jsonb_build_object('reservation_id', v_r.id, 'amount', v_saldo, 'payment_status', 'paid_in_full');
end;
$$;


-- ----------------------------------------------------------------------------
-- 7. mis_reservas · v2: con anticipo, pagado y saldo
-- ----------------------------------------------------------------------------
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
      'id',                   r.id,
      'reservation_code',     r.reservation_code,
      'folio',                r.folio,
      'experience_type',      r.experience_type,
      'status',               r.status,
      'quantity',             r.quantity,
      'unit_price',           r.unit_price,
      'total_amount',         r.total_amount,
      'deposit_percentage',   r.deposit_percentage,
      'deposit_amount',       r.deposit_amount,
      'amount_paid',          r.amount_paid,
      'final_payment_amount', r.final_payment_amount,
      'remaining_balance',    r.remaining_balance,
      'payment_status',       r.payment_status,
      'expires_at',           r.expires_at,
      'confirmed_at',         r.confirmed_at,
      'created_at',           r.created_at,
      'updated_at',           r.updated_at,
      'user_id',              r.user_id,
      'origin',               r.origin,
      'workshop',             case when w.id is null then null
                                   else jsonb_build_object('slug', w.slug, 'title', w.title) end,
      'month',                m.month,
      'customer',             case when c.user_id = auth.uid()
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


-- ----------------------------------------------------------------------------
-- 8. datos_reserva · v3: los correos dicen total, anticipo y saldo
-- ----------------------------------------------------------------------------
create or replace function datos_reserva(p_reservation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',                 r.id,
    'reservation_code',   r.reservation_code,
    'folio',              r.folio,
    'experience_type',    r.experience_type,
    'quantity',           r.quantity,
    'total_amount',       r.total_amount,
    'deposit_percentage', r.deposit_percentage,
    'deposit_amount',     r.deposit_amount,
    'amount_paid',        r.amount_paid,
    'remaining_balance',  r.remaining_balance,
    'payment_status',     r.payment_status,
    'currency',           r.currency,
    'status',             r.status,
    'companions',         r.companions,
    'paid',               exists (select 1 from payments p where p.reservation_id = r.id and p.status = 'paid'),
    'customer', jsonb_build_object(
      'full_name', c.full_name, 'email', c.email::text, 'phone', c.phone
    ),
    'workshop', jsonb_build_object(
      'slug',       coalesce(w.slug, r.experience_type),
      'title',      coalesce(w.title, case r.experience_type
                                        when 'kids' then 'NUMA Kids'
                                        when 'membresia' then 'Membresía NUMA'
                                        else 'Casa Numa' end),
      'date',       coalesce(s1.date, w.date),
      'start_time', coalesce(s1.start_time, w.start_time),
      'end_time',   case when s1.id is not null then s1.end_time else w.end_time end,
      'timezone',   coalesce(s1.timezone, w.timezone),
      'location',   w.location
    ),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time)
             order by s.date, s.start_time)
        from reservation_items i
        join workshop_sessions s on s.id = i.session_id
       where i.reservation_id = r.id), '[]'::jsonb),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object('name', ch.child_name, 'age', ch.age) order by ch.created_at)
        from reservation_children ch
       where ch.reservation_id = r.id), '[]'::jsonb)
  )
  from reservations r
  join customers c on c.id = r.customer_id
  left join workshops w on w.id = r.workshop_id
  left join lateral (
    select s.* from reservation_items i
      join workshop_sessions s on s.id = i.session_id
     where i.reservation_id = r.id
     order by s.date, s.start_time
     limit 1
  ) s1 on true
  where r.id = p_reservation_id;
$$;


revoke all on function anticipo_porcentaje() from public;
grant execute on function anticipo_porcentaje() to anon, authenticated, service_role;
revoke all on function fijar_anticipo() from public, anon, authenticated;
revoke all on function sincronizar_pagado() from public, anon, authenticated;
revoke all on function reserva_para_pago(uuid) from public, anon, authenticated;
grant execute on function reserva_para_pago(uuid) to service_role;
revoke all on function confirmar_pago(uuid,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function confirmar_pago(uuid,text,text,numeric,text,text) to service_role;
revoke all on function admin_liquidar_saldo(uuid,text,text) from public, anon, authenticated;
grant execute on function admin_liquidar_saldo(uuid,text,text) to service_role;
revoke all on function mis_reservas() from public, anon;
grant execute on function mis_reservas() to authenticated;
revoke all on function datos_reserva(uuid) from public, anon, authenticated;
grant execute on function datos_reserva(uuid) to service_role;
