-- ============================================================================
-- Casa Numa · 15 · Google Calendar: un evento por sesión
-- ----------------------------------------------------------------------------
-- v1 sincronizaba un evento por fila de `workshops`, con la hora de esa fila.
-- Con v2 eso ya no alcanza: un taller de sábado tiene dos horarios (11:00 y
-- 16:00) en la misma fila, NUMA Kids y membresía son sesiones propias, y la
-- membresía ni siquiera tiene taller. Ahora:
--
--   · un evento por SESIÓN (workshop_sessions.google_calendar_event_id);
--   · resumen_sesion(): lo que va en el evento (confirmadas, niños, cupo);
--   · se encola solo: al crear o cambiar una sesión (cupo, horario, estado)
--     y cuando una reserva entra o sale de 'confirmed' / 'completed';
--   · encolar_calendario(): sincroniza toda la agenda próxima (la primera vez,
--     o desde el panel).
--
-- Los encolados por taller de v1 (confirmar_pago, cancelar_reserva,
-- registrar_reembolso) quedan cubiertos por el disparador de reservas; un
-- disparador los descarta para no crear eventos duplicados por taller.
-- ============================================================================

alter table workshop_sessions add column if not exists google_calendar_event_id text;


-- ============================================================================
-- 1. Lo que va en el evento
-- ============================================================================
create or replace function resumen_sesion(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',              s.id,
    'experience_type', s.experience_type,
    'title',           coalesce(w.title, case s.experience_type
                                           when 'kids' then 'NUMA Kids'
                                           when 'membresia' then 'Clase de membresía'
                                           else 'Taller' end),
    'date',            s.date,
    'start_time',      s.start_time,
    'end_time',        s.end_time,
    'timezone',        s.timezone,
    'capacity',        s.capacity,
    'price',           s.price,
    'currency',        s.currency,
    'status',          s.status,
    'google_calendar_event_id', s.google_calendar_event_id,
    'confirmed', coalesce((
      select sum(i.quantity)::int
        from reservation_items i
        join reservations r on r.id = i.reservation_id
       where i.session_id = s.id and r.status in ('confirmed', 'completed')), 0),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'folio',    coalesce(r.folio, r.reservation_code),
               'name',     c.full_name,
               'phone',    c.phone,
               'quantity', i.quantity,
               'children', coalesce((
                 select jsonb_agg(ch.child_name || ' (' || ch.age || ')' order by ch.created_at)
                   from reservation_children ch
                  where ch.reservation_id = r.id), '[]'::jsonb))
             order by r.confirmed_at nulls last, r.created_at)
        from reservation_items i
        join reservations r on r.id = i.reservation_id
        join customers c on c.id = r.customer_id
       where i.session_id = s.id and r.status in ('confirmed', 'completed')), '[]'::jsonb)
  )
  from workshop_sessions s
  left join workshops w on w.id = s.workshop_id
  where s.id = p_session_id;
$$;

create or replace function guardar_evento_sesion(p_session_id uuid, p_event_id text)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update workshop_sessions set google_calendar_event_id = p_event_id where id = p_session_id;
$$;


-- ============================================================================
-- 2. Encolar
-- ----------------------------------------------------------------------------
-- La dedupe_key es por sesión: diez pagos seguidos de la misma clase son UNA
-- llamada a Google (el worker reconstruye el evento completo desde la base).
-- ============================================================================
create or replace function encolar_calendario_sesion(p_session_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('calendar_sync', 'session', p_session_id, '{}'::jsonb, 'calendar:session:' || p_session_id)
  on conflict do nothing;
$$;

/** Toda la agenda próxima (o una sesión). Devuelve cuántas se encolaron. */
create or replace function encolar_calendario(p_session_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer := 0;
  v_id uuid;
begin
  for v_id in
    select s.id from workshop_sessions s
     where (p_session_id is null or s.id = p_session_id)
       and (p_session_id is not null
            or (s.date >= current_date
                and (s.status = 'open' or s.google_calendar_event_id is not null)))
  loop
    perform encolar_calendario_sesion(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;


-- ============================================================================
-- 3. Disparadores
-- ============================================================================
create or replace function calendario_por_reserva()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Solo cambia el calendario cuando la reserva entra o sale de la lista.
  if new.status is distinct from old.status
     and (old.status::text in ('confirmed', 'completed') or new.status::text in ('confirmed', 'completed')) then
    perform encolar_calendario_sesion(i.session_id)
       from reservation_items i
      where i.reservation_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reservations_calendario on reservations;
create trigger trg_reservations_calendario
  after update of status on reservations
  for each row execute function calendario_por_reserva();


create or replace function calendario_por_sesion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or (new.capacity, new.status, new.date, new.start_time, new.end_time)
        is distinct from (old.capacity, old.status, old.date, old.start_time, old.end_time) then
    perform encolar_calendario_sesion(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sessions_calendario on workshop_sessions;
create trigger trg_sessions_calendario
  after insert or update on workshop_sessions
  for each row execute function calendario_por_sesion();


-- Los encolados por taller de v1 se descartan: los cubre el disparador de
-- reservas, sesión por sesión.
create or replace function calendario_sin_talleres_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.type = 'calendar_sync' and new.entity_type = 'workshop' then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_calendario_v1 on integration_jobs;
create trigger trg_jobs_calendario_v1
  before insert on integration_jobs
  for each row execute function calendario_sin_talleres_v1();


-- ============================================================================
-- Permisos
-- ============================================================================
revoke all on function resumen_sesion(uuid) from public, anon, authenticated;
revoke all on function guardar_evento_sesion(uuid, text) from public, anon, authenticated;
revoke all on function encolar_calendario_sesion(uuid) from public, anon, authenticated;
revoke all on function encolar_calendario(uuid) from public, anon, authenticated;
revoke all on function calendario_por_reserva() from public, anon, authenticated;
revoke all on function calendario_por_sesion() from public, anon, authenticated;
grant execute on function resumen_sesion(uuid) to service_role;
grant execute on function guardar_evento_sesion(uuid, text) to service_role;
grant execute on function encolar_calendario_sesion(uuid) to service_role;
grant execute on function encolar_calendario(uuid) to service_role;
