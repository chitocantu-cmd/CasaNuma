-- ============================================================================
-- Casa Numa · 09 · Reservas v2
-- ----------------------------------------------------------------------------
-- Lo que agrega (sin borrar nada de lo anterior):
--
--   workshop_sessions     cada fecha/horario reservable: talleres de la agenda,
--                         NUMA Kids y clases de membresía. capacity NULL =
--                         Casa Numa aún no confirma el cupo ("Cupo limitado").
--   reservation_items     qué sesiones ocupa cada reserva (1 taller = 1 sesión,
--                         membresía = 4 sesiones).
--   reservation_children  NUMA Kids: SOLO nombre y edad de cada niña o niño.
--                         El tutor es el cliente de la reserva. Nada más.
--   membership_plans      la membresía mensual (4 clases, precio del PDF).
--   memberships           cada membresía vendida, con su mes.
--   folio_counters        el folio consecutivo NUMA-00001, NUMA-00002…
--
--   crear_reserva_sesiones()  aparta lugares con bloqueo de filas: el cupo se
--                             valida AQUÍ, no en el navegador.
--   confirmar_pago()          (nueva versión) revalida cupo por sesión.
--   registrar_pago_manual()   pago en transferencia/efectivo desde el panel.
--   admin_actualizar_reserva() completada / no asistió / notas internas.
--
-- TRANSICIÓN: crear_reserva() (v1, un taller = una fila de workshops) sigue
-- viva para no romper el flujo actual. Cuando la Edge Function
-- create-reservation pase a crear_reserva_sesiones(), v1 se retira: las dos
-- no deben aceptar reservas del mismo taller al mismo tiempo, porque cada una
-- cuenta su propio cupo.
-- ============================================================================


-- ============================================================================
-- 1. Folio consecutivo
-- ----------------------------------------------------------------------------
-- Contador en una fila con UPDATE ... RETURNING, no una SEQUENCE: una
-- secuencia no se regresa si la transacción falla y dejaría huecos
-- (NUMA-00007, NUMA-00009…). Con la fila, el bloqueo se libera al terminar la
-- transacción y un rollback deshace el incremento. El costo —confirmaciones
-- en fila india— es irrelevante para el volumen de un estudio.
--
-- El folio es para hablar con la clienta ("¿me das tu folio?"). NO sustituye
-- a reservation_code, que es aleatorio y es lo que protege la consulta
-- pública de una reserva: un folio consecutivo se adivina.
-- ============================================================================
create table if not exists folio_counters (
  name       text primary key,
  last_value integer not null default 0 check (last_value >= 0)
);

insert into folio_counters (name) values ('reservation') on conflict do nothing;

alter table reservations add column if not exists folio text unique;

create or replace function siguiente_folio()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v integer;
begin
  update folio_counters
     set last_value = last_value + 1
   where name = 'reservation'
  returning last_value into v;

  if v is null then
    insert into folio_counters (name, last_value) values ('reservation', 1)
    returning last_value into v;
  end if;

  -- lpad recorta si el número es más largo: a partir de 100000 va completo.
  return 'NUMA-' || case when v < 100000 then lpad(v::text, 5, '0') else v::text end;
end;
$$;


-- ============================================================================
-- 2. Columnas nuevas en tablas existentes
-- ============================================================================
-- Las reservas de NUMA Kids y membresía no cuelgan de una fila de workshops.
alter table reservations alter column workshop_id drop not null;

alter table reservations
  add column if not exists experience_type text not null default 'taller'
    check (experience_type in ('taller', 'kids', 'membresia')),
  -- Cuenta de Mi cuenta que hizo la reserva (si había sesión iniciada).
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists origin text not null default 'web'
    check (origin in ('web', 'panel')),
  -- Solo las ve el equipo. Nunca se mandan a la clienta.
  add column if not exists internal_notes text,
  add column if not exists completed_at timestamptz;

create index if not exists idx_reservations_user on reservations (user_id) where user_id is not null;

-- Liga del cliente con su cuenta. Solo se llena cuando el correo de la cuenta
-- coincide con el del cliente (ver crear_reserva_sesiones): así nadie puede
-- "adoptar" el historial de otra persona escribiendo su correo.
alter table customers
  add column if not exists user_id uuid unique references auth.users(id) on delete set null;

alter table payments
  add column if not exists method text
    check (method is null or method in ('tarjeta', 'transferencia', 'efectivo', 'otro')),
  add column if not exists reference text;


-- ============================================================================
-- 3. Tablas nuevas
-- ============================================================================
create table if not exists workshop_sessions (
  id               uuid primary key default gen_random_uuid(),
  experience_type  text not null default 'taller'
                   check (experience_type in ('taller', 'kids', 'membresia')),
  workshop_id      uuid references workshops(id) on delete restrict,

  date             date not null,
  start_time       time not null,
  end_time         time,                       -- NULL = horario de cierre sin publicar
  timezone         text not null default 'America/Monterrey',

  -- NULL = cupo sin confirmar: no se cuentan lugares, el sitio dice "Cupo
  -- limitado" y se aplica solo el tope por reserva. NUNCA se inventa.
  capacity         integer check (capacity is null or capacity >= 0),

  -- Por persona (talleres y NUMA Kids). NULL = "Info DM": no se reserva en
  -- línea. La membresía toma su precio de membership_plans.
  price            numeric(10,2) check (price is null or price > 0),
  currency         char(3) not null default 'MXN',

  status           text not null default 'open'
                   check (status in ('open', 'closed', 'cancelled')),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint sesion_de_taller check ((experience_type = 'taller') = (workshop_id is not null)),
  constraint sesion_horario   check (end_time is null or end_time > start_time)
);

create unique index if not exists uq_sessions_horario
  on workshop_sessions (
    experience_type,
    coalesce(workshop_id, '00000000-0000-0000-0000-000000000000'::uuid),
    date, start_time
  );
create index if not exists idx_sessions_fecha on workshop_sessions (date);

drop trigger if exists trg_sessions_updated on workshop_sessions;
create trigger trg_sessions_updated before update on workshop_sessions
  for each row execute function set_updated_at();


create table if not exists reservation_items (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  session_id      uuid not null references workshop_sessions(id) on delete restrict,
  quantity        integer not null check (quantity between 1 and 10),
  created_at      timestamptz not null default now(),
  unique (reservation_id, session_id)
);

-- Alimenta cada conteo de cupo por sesión.
create index if not exists idx_items_session on reservation_items (session_id);


create table if not exists reservation_children (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  child_name      text not null check (btrim(child_name) <> '' and length(child_name) <= 80),
  age             smallint not null check (age between 1 and 17),
  created_at      timestamptz not null default now()
);

create index if not exists idx_children_reservation on reservation_children (reservation_id);


create table if not exists membership_plans (
  id              text primary key,
  name            text not null,
  sessions_count  smallint not null check (sessions_count between 1 and 12),
  price           numeric(10,2) check (price is null or price > 0),
  currency        char(3) not null default 'MXN',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_plans_updated on membership_plans;
create trigger trg_plans_updated before update on membership_plans
  for each row execute function set_updated_at();

-- Dato confirmado (Casa_Numa_Contenido_Webpdf.pdf): 4 sesiones al mes, $3,200.
insert into membership_plans (id, name, sessions_count, price)
values ('mensual', 'Membresía NUMA', 4, 3200)
on conflict (id) do nothing;


create table if not exists memberships (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null unique references reservations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete restrict,
  plan_id         text not null references membership_plans(id),
  month           date not null check (extract(day from month) = 1),
  sessions_total  smallint not null check (sessions_total between 1 and 12),
  created_at      timestamptz not null default now()
);

create index if not exists idx_memberships_customer on memberships (customer_id);


-- ============================================================================
-- 4. Datos existentes al modelo nuevo
-- ----------------------------------------------------------------------------
-- Cada taller de v1 se vuelve una sesión con el mismo cupo y precio, y cada
-- reserva de v1 una partida. Los folios se asignan a las reservas ya
-- confirmadas en el orden en que se confirmaron.
-- ============================================================================
insert into workshop_sessions (
  experience_type, workshop_id, date, start_time, end_time, timezone,
  capacity, price, currency, status
)
select 'taller', w.id, w.date, w.start_time, w.end_time, w.timezone,
       w.capacity, nullif(w.price, 0), w.currency,
       case when w.status = 'published' and w.booking_mode = 'paid' then 'open' else 'closed' end
  from workshops w
on conflict do nothing;

insert into reservation_items (reservation_id, session_id, quantity)
select r.id, s.id, r.quantity
  from reservations r
  join workshop_sessions s
    on s.workshop_id = r.workshop_id and s.experience_type = 'taller'
 where not exists (select 1 from reservation_items i where i.reservation_id = r.id)
on conflict do nothing;

do $$
declare
  x record;
begin
  for x in
    select id from reservations
     where folio is null and status in ('confirmed', 'completed', 'refunded')
     order by coalesce(confirmed_at, created_at), id
  loop
    update reservations set folio = siguiente_folio() where id = x.id;
  end loop;
end
$$;


-- ============================================================================
-- 5. El folio se pone solo
-- ----------------------------------------------------------------------------
-- · Reserva web: al confirmarse el pago (no antes: un apartado que vence no
--   gasta folio).
-- · Reserva registrada por el equipo en el panel: desde que se crea, porque
--   ya es un compromiso con la clienta aunque pague por transferencia.
-- Vive en un trigger para que NINGÚN camino (webhook, panel, SQL a mano)
-- pueda confirmar una reserva sin folio.
-- ============================================================================
create or replace function asignar_folio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.folio is null and (new.status = 'confirmed' or new.origin = 'panel') then
    new.folio := siguiente_folio();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservations_folio on reservations;
create trigger trg_reservations_folio
  before insert or update of status on reservations
  for each row execute function asignar_folio();


-- ============================================================================
-- 6. Cupo por sesión
-- ----------------------------------------------------------------------------
-- Igual que lugares_ocupados() de v1: se CALCULA, no se guarda. Cuentan las
-- reservas confirmadas/completadas y los apartados vigentes.
-- ============================================================================
create or replace function lugares_ocupados_sesion(
  p_session_id uuid,
  p_excluir    uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(i.quantity), 0)::integer
    from reservation_items i
    join reservations r on r.id = i.reservation_id
   where i.session_id = p_session_id
     and (p_excluir is null or r.id <> p_excluir)
     and (
       r.status in ('confirmed', 'completed')
       or (r.status = 'pending_payment' and r.expires_at > now())
     );
$$;

-- v1 también cuenta las completadas: el equipo puede marcar "completada" el
-- mismo día, antes de que termine el taller.
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
       status in ('confirmed', 'completed')
       or (status = 'pending_payment' and expires_at > now())
     );
$$;


-- ============================================================================
-- 7. crear_reserva_sesiones(...)
-- ----------------------------------------------------------------------------
-- Aparta lugares para una o varias sesiones en UNA transacción:
--
--   1. Valida datos (el front ya lo hizo; esto es lo que no se puede saltar).
--   2. Bloquea las filas de las sesiones con FOR UPDATE, SIEMPRE en orden de
--      id: dos membresías que comparten viernes no se bloquean en cruz.
--   3. Con las filas bloqueadas, cuenta ocupados y compara con el cupo. Si
--      alguna no alcanza, falla TODO (nada de membresías de 3 clases).
--   4. Crea/reutiliza el cliente, la reserva, sus partidas y —según el tipo—
--      los niños o la membresía.
--
-- Queda en pending_payment con expires_at: el lugar ya está tomado para los
-- demás, pero no es una reserva hasta que el proveedor de pago la confirme
-- (confirmar_pago) o el equipo registre el pago (registrar_pago_manual).
-- ============================================================================
create or replace function crear_reserva_sesiones(
  p_tipo          text,
  p_session_ids   uuid[],
  p_quantity      integer,
  p_full_name     text,
  p_email         citext,
  p_phone         text,
  p_children      jsonb   default '[]'::jsonb,
  p_user_id       uuid    default null,
  p_origin        text    default 'web',
  p_notes         text    default null,
  p_max_sin_cupo  integer default 6,
  p_hold_minutos  integer default 15
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids          uuid[];
  v_s            workshop_sessions%rowtype;
  v_n            integer := 0;
  v_ocupados     integer;
  v_min_libres   integer;
  v_sin_lugar    jsonb := '[]'::jsonb;
  v_unit         numeric(10,2);
  v_workshop     uuid;
  v_mes          date;
  v_primera      timestamptz;
  v_plan         membership_plans%rowtype;
  v_phone        text;
  v_email_cuenta text;
  v_customer_id  uuid;
  v_hijo         jsonb;
  v_r            reservations%rowtype;
begin
  ---------------------------------------------------------------------------
  -- 1. Validación
  ---------------------------------------------------------------------------
  if p_tipo is null or p_tipo not in ('taller', 'kids', 'membresia') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Tipo de experiencia desconocido.';
  end if;

  if p_origin is null or p_origin not in ('web', 'panel') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Origen desconocido.';
  end if;

  select array_agg(distinct x order by x) into v_ids
    from unnest(coalesce(p_session_ids, '{}'::uuid[])) x
   where x is not null;

  if v_ids is null then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Elige una fecha.';
  end if;

  if p_tipo <> 'membresia' and cardinality(v_ids) <> 1 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Elige un solo horario.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'La cantidad debe estar entre 1 y 10.';
  end if;

  if p_tipo = 'membresia' and p_quantity <> 1 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'La membresía es individual.';
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

  -- NUMA Kids: un niño por lugar, solo nombre y edad. Edad mínima 7
  -- (Casa_Numa_Contenido_Webpdf.pdf, igual que src/contenido/oferta.ts).
  if p_tipo = 'kids' then
    if jsonb_typeof(coalesce(p_children, 'null'::jsonb)) <> 'array'
       or jsonb_array_length(p_children) <> p_quantity then
      raise exception 'INVALID_INPUT' using errcode = 'CN004',
        detail = 'Registra el nombre y la edad de cada niña o niño.';
    end if;
    for v_hijo in select * from jsonb_array_elements(p_children) loop
      if btrim(coalesce(v_hijo->>'name', '')) = ''
         or coalesce(v_hijo->>'age', '') !~ '^\d{1,2}$'
         or (v_hijo->>'age')::int not between 1 and 17 then
        raise exception 'INVALID_INPUT' using errcode = 'CN004',
          detail = 'Cada niña o niño necesita nombre y una edad válida.';
      end if;
      if (v_hijo->>'age')::int < 7 then
        raise exception 'INVALID_INPUT' using errcode = 'CN004',
          detail = 'NUMA Kids es para niñas y niños a partir de 7 años.';
      end if;
    end loop;
  end if;

  ---------------------------------------------------------------------------
  -- 2 y 3. Bloqueo en orden y conteo
  ---------------------------------------------------------------------------
  for v_s in
    select * from workshop_sessions where id = any(v_ids) order by id for update
  loop
    v_n := v_n + 1;

    if v_s.experience_type <> p_tipo or v_s.status <> 'open' then
      raise exception 'WORKSHOP_NOT_AVAILABLE' using errcode = 'CN002',
        detail = 'Ese horario ya no está disponible.';
    end if;

    if inicio_taller(v_s.date, v_s.start_time, v_s.timezone) <= now() then
      raise exception 'WORKSHOP_IN_PAST' using errcode = 'CN006', detail = 'Ese horario ya pasó.';
    end if;

    if v_s.capacity is null then
      if p_quantity > p_max_sin_cupo then
        raise exception 'INVALID_INPUT' using errcode = 'CN004',
          detail = format('Hasta %s personas por reserva. Si son más, escríbenos.', p_max_sin_cupo);
      end if;
    else
      v_ocupados := lugares_ocupados_sesion(v_s.id);
      if v_ocupados + p_quantity > v_s.capacity then
        v_sin_lugar := v_sin_lugar || jsonb_build_object(
          'session_id', v_s.id,
          'available',  greatest(v_s.capacity - v_ocupados, 0)
        );
        v_min_libres := least(coalesce(v_min_libres, 2147483647), greatest(v_s.capacity - v_ocupados, 0));
      end if;
    end if;

    if p_tipo = 'membresia' then
      if v_mes is null then
        v_mes := date_trunc('month', v_s.date)::date;
      elsif date_trunc('month', v_s.date)::date <> v_mes then
        raise exception 'INVALID_INPUT' using errcode = 'CN004',
          detail = 'Las clases de la membresía deben ser del mismo mes.';
      end if;
    else
      if v_s.price is null then
        raise exception 'WORKSHOP_REQUIRES_QUOTE' using errcode = 'CN003',
          detail = 'Este taller se aparta por mensaje.';
      end if;
      v_unit     := v_s.price;
      v_workshop := v_s.workshop_id;
    end if;

    v_primera := least(coalesce(v_primera, 'infinity'::timestamptz),
                       inicio_taller(v_s.date, v_s.start_time, v_s.timezone));
  end loop;

  if v_n <> cardinality(v_ids) then
    raise exception 'WORKSHOP_NOT_AVAILABLE' using errcode = 'CN002',
      detail = 'Alguno de los horarios ya no existe.';
  end if;

  if jsonb_array_length(v_sin_lugar) > 0 then
    -- detail = lugares disponibles (el mismo contrato que v1); hint = por sesión.
    raise exception 'INSUFFICIENT_CAPACITY' using errcode = 'CN001',
      detail = v_min_libres::text,
      hint   = v_sin_lugar::text;
  end if;

  if p_tipo = 'membresia' then
    select * into v_plan from membership_plans where id = 'mensual' and active;
    if not found or v_plan.price is null then
      raise exception 'WORKSHOP_REQUIRES_QUOTE' using errcode = 'CN003',
        detail = 'La membresía todavía no se vende en línea.';
    end if;
    if cardinality(v_ids) <> v_plan.sessions_count then
      raise exception 'INVALID_INPUT' using errcode = 'CN004',
        detail = format('Elige exactamente %s clases.', v_plan.sessions_count);
    end if;
    v_unit := v_plan.price;
  end if;

  ---------------------------------------------------------------------------
  -- 4. Cliente, reserva, partidas, niños / membresía
  ---------------------------------------------------------------------------
  -- La cuenta solo se liga si su correo es el mismo de la reserva.
  if p_user_id is not null then
    select email into v_email_cuenta from auth.users where id = p_user_id;
  end if;

  insert into customers (full_name, email, phone, user_id)
  values (
    btrim(p_full_name), p_email, v_phone,
    case when v_email_cuenta is not null and lower(v_email_cuenta) = lower(p_email::text) then p_user_id end
  )
  on conflict (email) do update
    set full_name  = excluded.full_name,
        phone      = coalesce(excluded.phone, customers.phone),
        user_id    = coalesce(customers.user_id, excluded.user_id),
        updated_at = now()
  returning id into v_customer_id;

  -- Una reserva web aparta p_hold_minutos. Una del panel (la clienta paga por
  -- transferencia) aparta hasta que empieza la primera clase, o hasta que el
  -- equipo la cancele; el trigger le pone folio desde ahora.
  insert into reservations (
    reservation_code, workshop_id, customer_id, quantity,
    unit_price, total_amount, currency, status, expires_at,
    notes, experience_type, user_id, origin
  ) values (
    generar_reservation_code(), v_workshop, v_customer_id, p_quantity,
    v_unit, v_unit * p_quantity, 'MXN', 'pending_payment',
    case when p_origin = 'panel' then v_primera
         else now() + make_interval(mins => p_hold_minutos) end,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_tipo, p_user_id, p_origin
  )
  returning * into v_r;

  insert into reservation_items (reservation_id, session_id, quantity)
  select v_r.id, x, p_quantity from unnest(v_ids) x;

  if p_tipo = 'kids' then
    insert into reservation_children (reservation_id, child_name, age)
    select v_r.id, btrim(c->>'name'), (c->>'age')::smallint
      from jsonb_array_elements(p_children) c;
  end if;

  if p_tipo = 'membresia' then
    insert into memberships (reservation_id, customer_id, plan_id, month, sessions_total)
    values (v_r.id, v_customer_id, v_plan.id, v_mes, v_plan.sessions_count);
  end if;

  insert into audit_log (actor, action, entity, entity_id, after)
  values (p_origin, 'reserva.apartada', 'reservations', v_r.id::text,
          jsonb_build_object('tipo', p_tipo, 'sesiones', to_jsonb(v_ids), 'personas', p_quantity));

  return jsonb_build_object(
    'reservation_id',   v_r.id,
    'reservation_code', v_r.reservation_code,
    'folio',            v_r.folio,
    'status',           v_r.status,
    'experience_type',  v_r.experience_type,
    'quantity',         v_r.quantity,
    'unit_price',       v_r.unit_price,
    'total_amount',     v_r.total_amount,
    'currency',         v_r.currency,
    'expires_at',       v_r.expires_at,
    'customer_id',      v_customer_id,
    'session_ids',      to_jsonb(v_ids)
  );
end;
$$;


-- ============================================================================
-- 8. confirmar_pago(...) · versión con sesiones
-- ----------------------------------------------------------------------------
-- Idéntica a v1 en contrato y resultados ('confirmed', 'already_confirmed',
-- 'cancelled', 'needs_review'). Lo nuevo:
--   · si la reserva tiene partidas, revalida el cupo de CADA sesión (con las
--     filas bloqueadas en orden); si no, usa el taller como v1;
--   · el folio lo pone el trigger al pasar a 'confirmed';
--   · encola también el aviso por WhatsApp al equipo (se omite solo si no
--     está configurado).
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
    if v_ocupados + v_r.quantity > v_w.capacity then
      v_motivo := format(
        'Pago recibido tras vencer el hold; el cupo ya estaba tomado (%s/%s). Requiere reembolso o reacomodo manual.',
        v_ocupados, v_w.capacity);
    end if;
  end if;

  if v_motivo is not null then
    insert into payments (
      reservation_id, provider, stripe_checkout_session_id,
      stripe_payment_intent_id, amount, currency, status, provider_status,
      paid_at, needs_review, review_reason
    ) values (
      v_r.id, 'stripe', p_session_id, p_intent_id, p_amount,
      upper(coalesce(p_currency, 'MXN')), 'paid', p_provider_status, now(),
      true, v_motivo
    )
    on conflict (stripe_payment_intent_id) where stripe_payment_intent_id is not null
    do update set status = 'paid', needs_review = true;

    insert into audit_log (actor, action, entity, entity_id, after)
    values ('webhook', 'pago.sin_cupo', 'reservations', v_r.id::text,
            jsonb_build_object('intent', p_intent_id));

    return 'needs_review';
  end if;

  insert into payments (
    reservation_id, provider, stripe_checkout_session_id,
    stripe_payment_intent_id, amount, currency, status, provider_status, paid_at, method
  ) values (
    v_r.id, 'stripe', p_session_id, p_intent_id, p_amount,
    upper(coalesce(p_currency, 'MXN')), 'paid', p_provider_status, now(), 'tarjeta'
  )
  on conflict (stripe_payment_intent_id) where stripe_payment_intent_id is not null
  do update set status          = 'paid',
                provider_status = excluded.provider_status,
                paid_at         = coalesce(payments.paid_at, now());

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


-- ----------------------------------------------------------------------------
-- Avisos al confirmar: correo a la clienta, correo al equipo y WhatsApp al
-- equipo. Deduplicados: confirmar dos veces no manda dos correos.
-- ----------------------------------------------------------------------------
create or replace function encolar_avisos_confirmacion(
  p_reservation_id uuid,
  p_avisar_cliente boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_avisar_cliente then
    insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
    values ('email_send', 'reservation', p_reservation_id,
            jsonb_build_object('template', 'confirmacion'),
            'email:confirmacion:' || p_reservation_id)
    on conflict do nothing;
  end if;

  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('email_send', 'reservation', p_reservation_id,
          jsonb_build_object('template', 'admin_reserva'),
          'email:admin_reserva:' || p_reservation_id)
  on conflict do nothing;

  insert into integration_jobs (type, entity_type, entity_id, payload, dedupe_key)
  values ('whatsapp_send', 'reservation', p_reservation_id,
          jsonb_build_object('template', 'admin_reserva'),
          'whatsapp:admin_reserva:' || p_reservation_id)
  on conflict do nothing;
end;
$$;


-- ============================================================================
-- 9. registrar_pago_manual(...) · transferencia o efectivo desde el panel
-- ----------------------------------------------------------------------------
-- Si el apartado ya había vencido, se vuelve a medir el cupo: registrar un
-- pago no puede sobrevender.
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
  v_r        reservations%rowtype;
  v_s        workshop_sessions%rowtype;
begin
  if p_method is null or p_method not in ('transferencia', 'efectivo', 'tarjeta', 'otro') then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'Método de pago desconocido.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_INPUT' using errcode = 'CN004', detail = 'El monto debe ser mayor a cero.';
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

  insert into payments (reservation_id, provider, amount, currency, status, paid_at, method, reference)
  values (v_r.id, 'manual', p_amount, v_r.currency, 'paid', now(), p_method,
          nullif(btrim(coalesce(p_reference, '')), ''));

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
-- 10. admin_actualizar_reserva(...) · completada, no asistió, notas
-- ----------------------------------------------------------------------------
-- Cancelar y reembolsar siguen en cancelar_reserva() y registrar_reembolso(),
-- que ya avisan a la clienta.
-- ============================================================================
create or replace function admin_actualizar_reserva(
  p_reservation_id uuid,
  p_status         text default null,
  p_internal_notes text default null,
  p_actor          text default 'admin'
)
returns reservations
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_antes reservations%rowtype;
  v_r     reservations%rowtype;
begin
  select * into v_antes from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'CN005';
  end if;

  if p_status is not null then
    if p_status not in ('completed', 'no_show') then
      raise exception 'INVALID_INPUT' using errcode = 'CN004',
        detail = 'Desde aquí solo se marca completada o no asistió.';
    end if;
    if v_antes.status not in ('confirmed', 'completed', 'no_show') then
      raise exception 'INVALID_INPUT' using errcode = 'CN004',
        detail = 'Solo una reserva confirmada puede marcarse así.';
    end if;
  end if;

  update reservations
     set status         = coalesce(p_status::reservation_status, status),
         completed_at   = case when p_status = 'completed' then now() else completed_at end,
         internal_notes = case when p_internal_notes is null then internal_notes
                               else nullif(btrim(p_internal_notes), '') end
   where id = p_reservation_id
  returning * into v_r;

  insert into audit_log (actor, action, entity, entity_id, before, after)
  values (p_actor, 'reserva.actualizada', 'reservations', v_r.id::text,
          jsonb_build_object('status', v_antes.status),
          jsonb_build_object('status', v_r.status, 'nota', p_internal_notes is not null));

  return v_r;
end;
$$;


-- ============================================================================
-- 11. datos_reserva(...) · lo que usan los correos y el WhatsApp
-- ----------------------------------------------------------------------------
-- Conserva la forma de v1 (`workshop`) para no romper las plantillas, y
-- agrega id, folio, tipo, sesiones y niños. Para NUMA Kids y membresía,
-- `workshop` se arma con la primera sesión.
-- ============================================================================
create or replace function datos_reserva(p_reservation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',               r.id,
    'reservation_code', r.reservation_code,
    'folio',            r.folio,
    'experience_type',  r.experience_type,
    'quantity',         r.quantity,
    'total_amount',     r.total_amount,
    'currency',         r.currency,
    'status',           r.status,
    'companions',       r.companions,
    'paid',             exists (select 1 from payments p where p.reservation_id = r.id and p.status = 'paid'),
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


-- ============================================================================
-- 12. Membresías: clases utilizadas, reservadas y restantes
-- ----------------------------------------------------------------------------
-- utilizadas = clases cuya hora ya pasó; reservadas = las que vienen;
-- restantes = total − utilizadas.
-- ============================================================================
create or replace view membership_usage
with (security_invoker = on)
as
select
  m.id, m.reservation_id, m.customer_id, m.plan_id, m.month, m.sessions_total,
  count(s.id) filter (where inicio_taller(s.date, s.start_time, s.timezone) <= now())::int as sessions_used,
  count(s.id) filter (where inicio_taller(s.date, s.start_time, s.timezone) >  now())::int as sessions_booked,
  (m.sessions_total
    - count(s.id) filter (where inicio_taller(s.date, s.start_time, s.timezone) <= now()))::int as sessions_remaining
from memberships m
left join reservation_items i on i.reservation_id = m.reservation_id
left join workshop_sessions s on s.id = i.session_id
group by m.id;


-- ============================================================================
-- 13. Sesiones públicas con lugares disponibles
-- ----------------------------------------------------------------------------
-- seats_available es NULL cuando el cupo no está confirmado: el sitio dice
-- "Cupo limitado" en vez de inventar un número.
-- ============================================================================
create or replace view public_sessions
with (security_invoker = on)
as
select
  s.id, s.experience_type, s.workshop_id, w.slug as workshop_slug,
  s.date, s.start_time, s.end_time, s.timezone,
  s.capacity, s.price, s.currency,
  case when s.capacity is null then null
       else greatest(s.capacity - lugares_ocupados_sesion(s.id), 0) end as seats_available
from workshop_sessions s
left join workshops w on w.id = s.workshop_id
where s.status = 'open'
  and (s.workshop_id is null or w.status = 'published');


-- ============================================================================
-- 14. Seguridad
-- ----------------------------------------------------------------------------
-- · RLS en todas las tablas nuevas; sin política = denegado.
-- · El público solo lee sesiones abiertas y planes (catálogo).
-- · Una clienta con sesión ve SUS reservas, partidas, niños y membresías.
--   Nunca las de otra persona.
-- · El equipo (es_admin) ve todo y edita cupo, precio y estado de sesiones.
-- · Las funciones que escriben solo las invoca el backend (service_role).
-- ============================================================================
alter table folio_counters       enable row level security;
alter table workshop_sessions    enable row level security;
alter table reservation_items    enable row level security;
alter table reservation_children enable row level security;
alter table membership_plans     enable row level security;
alter table memberships          enable row level security;

revoke all on folio_counters, workshop_sessions, reservation_items,
              reservation_children, membership_plans, memberships
  from anon, authenticated;

-- Catálogo
grant select (id, experience_type, workshop_id, date, start_time, end_time, timezone,
              capacity, price, currency, status)
  on workshop_sessions to anon, authenticated;
drop policy if exists sesion_abierta_visible on workshop_sessions;
create policy sesion_abierta_visible on workshop_sessions
  for select to anon, authenticated using (status = 'open');

drop policy if exists admin_ve_sesiones on workshop_sessions;
create policy admin_ve_sesiones on workshop_sessions
  for select to authenticated using (es_admin());

grant insert, update (date, start_time, end_time, capacity, price, status)
  on workshop_sessions to authenticated;
drop policy if exists admin_crea_sesiones on workshop_sessions;
create policy admin_crea_sesiones on workshop_sessions
  for insert to authenticated with check (es_admin());
drop policy if exists admin_edita_sesiones on workshop_sessions;
create policy admin_edita_sesiones on workshop_sessions
  for update to authenticated using (es_admin()) with check (es_admin());

grant select on membership_plans to anon, authenticated;
drop policy if exists plan_visible on membership_plans;
create policy plan_visible on membership_plans
  for select to anon, authenticated using (active or es_admin());

grant select on public_sessions to anon, authenticated;

-- Mi cuenta: lo propio. Las políticas de las tablas hijas se apoyan en la de
-- reservations (un SELECT sobre reservations ya viene filtrado por RLS).
drop policy if exists cliente_se_ve on customers;
create policy cliente_se_ve on customers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists cliente_ve_sus_reservas on reservations;
create policy cliente_ve_sus_reservas on reservations
  for select to authenticated using (
    user_id = auth.uid()
    or customer_id in (select id from customers where user_id = auth.uid())
  );

grant select on reservation_items, reservation_children, memberships to authenticated;

drop policy if exists ve_partidas on reservation_items;
create policy ve_partidas on reservation_items
  for select to authenticated using (es_admin() or reservation_id in (select id from reservations));

drop policy if exists ve_ninos on reservation_children;
create policy ve_ninos on reservation_children
  for select to authenticated using (es_admin() or reservation_id in (select id from reservations));

drop policy if exists ve_membresias on memberships;
create policy ve_membresias on memberships
  for select to authenticated using (es_admin() or reservation_id in (select id from reservations));

grant select on membership_usage to authenticated;

-- Funciones
revoke all on function siguiente_folio() from public, anon, authenticated;
revoke all on function asignar_folio() from public, anon, authenticated;
revoke all on function crear_reserva_sesiones(text,uuid[],integer,text,citext,text,jsonb,uuid,text,text,integer,integer)
  from public, anon, authenticated;
revoke all on function confirmar_pago(uuid,text,text,numeric,text,text) from public, anon, authenticated;
revoke all on function encolar_avisos_confirmacion(uuid,boolean) from public, anon, authenticated;
revoke all on function registrar_pago_manual(uuid,numeric,text,text,boolean,text) from public, anon, authenticated;
revoke all on function admin_actualizar_reserva(uuid,text,text,text) from public, anon, authenticated;
revoke all on function datos_reserva(uuid) from public, anon, authenticated;

grant execute on function siguiente_folio() to service_role;
grant execute on function crear_reserva_sesiones(text,uuid[],integer,text,citext,text,jsonb,uuid,text,text,integer,integer)
  to service_role;
grant execute on function confirmar_pago(uuid,text,text,numeric,text,text) to service_role;
grant execute on function encolar_avisos_confirmacion(uuid,boolean) to service_role;
grant execute on function registrar_pago_manual(uuid,numeric,text,text,boolean,text) to service_role;
grant execute on function admin_actualizar_reserva(uuid,text,text,text) to service_role;
grant execute on function datos_reserva(uuid) to service_role;

-- Solo lectura: devuelve un número, nunca quién reservó.
grant execute on function lugares_ocupados_sesion(uuid, uuid) to anon, authenticated, service_role;
grant execute on function lugares_ocupados(uuid, uuid)         to anon, authenticated, service_role;
