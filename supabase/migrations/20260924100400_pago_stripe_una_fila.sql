-- ============================================================================
-- Casa Numa · 12 · Un pago de Stripe = una fila en payments
-- ----------------------------------------------------------------------------
-- create-checkout-session deja una fila 'pending' con el id de la sesión de
-- Stripe (guardar_checkout_session). confirmar_pago() insertaba OTRA fila con
-- ese mismo id, y el índice único uq_payments_session la rechazaba: el pago
-- quedaba cobrado en Stripe pero la reserva nunca se confirmaba. (Venía de
-- v1; no se había visto porque Stripe no estaba configurado.)
--
-- Ahora el pago se registra en la fila que ya existe, y solo si no hay
-- ninguna se crea. El webhook y la verificación de respaldo pueden llegar los
-- dos: el segundo encuentra la misma fila y no duplica nada.
-- ============================================================================

create or replace function registrar_pago_stripe(
  p_reservation_id  uuid,
  p_session_id      text,
  p_intent_id       text,
  p_amount          numeric,
  p_currency        text,
  p_provider_status text,
  p_needs_review    boolean default false,
  p_review_reason   text    default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  -- 1. La fila de esa sesión (o de ese cobro) que ya existe.
  update payments
     set stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_intent_id),
         amount          = p_amount,
         currency        = upper(coalesce(p_currency, currency, 'MXN')),
         status          = 'paid',
         provider_status = coalesce(p_provider_status, provider_status),
         paid_at         = coalesce(paid_at, now()),
         method          = coalesce(method, 'tarjeta'),
         needs_review    = needs_review or p_needs_review,
         review_reason   = coalesce(p_review_reason, review_reason)
   where reservation_id = p_reservation_id
     and ((p_session_id is not null and stripe_checkout_session_id = p_session_id)
       or (p_intent_id  is not null and stripe_payment_intent_id  = p_intent_id));

  if found then
    return;
  end if;

  -- 2. No había fila: se crea. Idempotente por cobro de Stripe.
  insert into payments (
    reservation_id, provider, stripe_checkout_session_id, stripe_payment_intent_id,
    amount, currency, status, provider_status, paid_at, method, needs_review, review_reason
  ) values (
    p_reservation_id, 'stripe', p_session_id, p_intent_id,
    p_amount, upper(coalesce(p_currency, 'MXN')), 'paid', p_provider_status, now(), 'tarjeta',
    p_needs_review, p_review_reason
  )
  on conflict (stripe_payment_intent_id) where stripe_payment_intent_id is not null
  do update set status          = 'paid',
                provider_status = excluded.provider_status,
                paid_at         = coalesce(payments.paid_at, now()),
                needs_review    = payments.needs_review or excluded.needs_review,
                review_reason   = coalesce(excluded.review_reason, payments.review_reason);
end;
$$;


-- ============================================================================
-- confirmar_pago(...) · igual que en reservas_v2, registrando el pago con
-- registrar_pago_stripe().
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
  v_s        workshop_sessions%rowtype;
  v_ocupados integer;
  v_motivo   text;
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

  -------------------------------------------------------------------------
  -- Revalidación de cupo (ver la explicación larga en v1).
  -------------------------------------------------------------------------
  if exists (select 1 from reservation_items where reservation_id = v_r.id) then
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
  elsif v_r.workshop_id is not null then
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
    values ('webhook', 'pago.sin_cupo', 'reservations', v_r.id::text,
            jsonb_build_object('intent', p_intent_id));

    return 'needs_review';
  end if;

  perform registrar_pago_stripe(v_r.id, p_session_id, p_intent_id, p_amount,
                                p_currency, p_provider_status);

  -- El trigger asigna el folio aquí.
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
          jsonb_build_object('intent', p_intent_id, 'amount', p_amount));

  return 'confirmed';
end;
$$;


revoke all on function registrar_pago_stripe(uuid,text,text,numeric,text,text,boolean,text) from public, anon, authenticated;
revoke all on function confirmar_pago(uuid,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function registrar_pago_stripe(uuid,text,text,numeric,text,text,boolean,text) to service_role;
grant execute on function confirmar_pago(uuid,text,text,numeric,text,text) to service_role;
