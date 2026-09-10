-- ============================================================================
-- Casa Numa · MIGRACIÓN COMPLETA
-- ----------------------------------------------------------------------------
-- Todo el esquema en un solo archivo, para pegarlo de una vez en el SQL Editor
-- de Supabase. Es exactamente el contenido de supabase/migrations/ (menos la
-- de cron) más el seed, concatenado en orden.
--
-- Generado automáticamente. La fuente de verdad sigue siendo supabase/migrations/.
--
-- QUÉ FALTA DESPUÉS DE ESTO:
--   · 20260909100500_cron.sql — necesita crear dos secretos en el vault antes.
--   · Habilitar pg_cron y pg_net en Database → Extensions.
-- ============================================================================


-- ==========================================================================
-- ARCHIVO: 20260909100000_types.sql
-- ==========================================================================

-- ============================================================================
-- Casa Numa · 01 · Extensiones, enums y utilidades
-- ============================================================================

create extension if not exists citext;

-- gen_random_uuid() esta en el core de PostgreSQL desde la version 13, asi que
-- pgcrypto no hace falta. Pedirla de mas solo agrega un requisito que puede no
-- estar disponible en todos los entornos.

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workshop_status') then
    create type workshop_status as enum ('draft', 'published', 'cancelled', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum (
      'pending_payment', 'confirmed', 'expired', 'cancelled', 'refunded'
    );
  end if;

  -- 'paid' es el estado interno de pago. La reserva NO tiene un estado 'paid'
  -- separado de 'confirmed': el dinero vive en payments, la reserva vive en
  -- reservations. Un solo hecho, un solo lugar.
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending', 'paid', 'failed', 'cancelled', 'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('new', 'contacted', 'converted', 'discarded');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_type') then
    create type job_type as enum ('calendar_sync', 'email_send');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('pending', 'processing', 'done', 'failed');
  end if;
end
$$;


-- ----------------------------------------------------------------------------
-- Trigger común de updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ----------------------------------------------------------------------------
-- Normalización de contacto
-- ----------------------------------------------------------------------------
-- Evita clientes duplicados por diferencias cosméticas. "81 1234 5678",
-- "+52 81 1234 5678" y "8112345678" son la misma persona.
--
-- Se guarda en E.164 (+52...) porque es lo que necesita el enlace de wa.me,
-- y porque comparar cadenas con formato libre garantiza duplicados.
-- ----------------------------------------------------------------------------
create or replace function normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p_telefono is null then return null; end if;

  d := regexp_replace(p_telefono, '\D', '', 'g');
  if d = '' then return null; end if;

  -- 10 dígitos: número nacional mexicano.
  if length(d) = 10 then
    return '+52' || d;
  end if;

  -- 52 + 10 dígitos: ya trae lada de país.
  if length(d) = 12 and left(d, 2) = '52' then
    return '+' || d;
  end if;

  -- 521 + 10 dígitos: formato viejo de móvil mexicano.
  if length(d) = 13 and left(d, 3) = '521' then
    return '+52' || right(d, 10);
  end if;

  -- Cualquier otro caso: se conserva tal cual con prefijo, sin inventar.
  return '+' || d;
end;
$$;


-- ----------------------------------------------------------------------------
-- Código de reservación: NUMA-XXXXXX
-- ----------------------------------------------------------------------------
-- Alfabeto sin caracteres ambiguos (sin 0/O, sin 1/I/L). Estos códigos se
-- dictan por WhatsApp y por teléfono; confundir un 0 con una O es un problema
-- real de operación, no teórico.
--
-- Nunca se le muestra el UUID al cliente.
-- ----------------------------------------------------------------------------
create or replace function generar_reservation_code()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidato text;
  i int;
begin
  loop
    candidato := 'NUMA-';
    for i in 1..6 loop
      candidato := candidato ||
        substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (
      select 1 from reservations where reservation_code = candidato
    );
  end loop;
  return candidato;
end;
$$;


-- ==========================================================================
-- ARCHIVO: 20260909100100_tables.sql
-- ==========================================================================

-- ============================================================================
-- Casa Numa · 02 · Tablas
-- ----------------------------------------------------------------------------
-- DINERO: se usa numeric(10,2), no float. NUMERIC en PostgreSQL es decimal
-- exacto de precisión arbitraria, así que 650.00 es exactamente 650.00 y las
-- sumas no acumulan error. La conversión a centavos ocurre en un solo punto:
-- justo antes de llamar a Stripe.
--
-- CUPO: no existe ninguna columna `reserved`. La ocupación se CALCULA desde
-- reservations. Un contador guardado se desincroniza tarde o temprano —una
-- cancelación que no lo baja, un webhook que lo sube dos veces— y cuando eso
-- pasa se sobrevende sin que nadie se entere.
-- ============================================================================


-- ============================================================================
-- workshops
-- ============================================================================
create table if not exists workshops (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  title                    text not null,
  category                 text not null default 'ceramica',
  short_description        text,
  description              text[] not null default '{}',

  date                     date not null,
  start_time               time not null,
  end_time                 time not null,
  timezone                 text not null default 'America/Monterrey',

  price                    numeric(10,2) not null default 0 check (price >= 0),
  currency                 char(3) not null default 'MXN',
  capacity                 integer not null check (capacity > 0),

  location                 text,
  instructor               text,
  level                    text,

  image_url                text,
  cloudinary_public_id     text,
  gallery                  text[] not null default '{}',

  includes                 text[] not null default '{}',
  crearas                  text[] not null default '{}',
  faqs                     jsonb  not null default '[]',
  tono                     text,

  status                   workshop_status not null default 'draft',

  -- 'quote' = "sobre cotización": no entra al flujo de pago. Resuelve el caso
  -- de piezas-personalizadas, que tiene precio 0 y de otro modo sería
  -- reservable por $0.
  booking_mode             text not null default 'paid'
                           check (booking_mode in ('paid', 'quote')),

  google_calendar_event_id text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint horario_coherente check (end_time > start_time),
  constraint precio_coherente check (
    (booking_mode = 'quote' and price = 0) or
    (booking_mode = 'paid'  and price > 0)
  )
);

create index if not exists idx_workshops_date   on workshops (date);
create index if not exists idx_workshops_status on workshops (status);
create index if not exists idx_workshops_agenda on workshops (date)
  where status = 'published';

drop trigger if exists trg_workshops_updated on workshops;
create trigger trg_workshops_updated before update on workshops
  for each row execute function set_updated_at();


-- ============================================================================
-- customers
-- ============================================================================
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  -- citext: Maria@gmail.com y maria@gmail.com son la misma persona.
  email       citext not null unique,
  -- Normalizado a E.164 por normalizar_telefono().
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_customers_phone on customers (phone);

drop trigger if exists trg_customers_updated on customers;
create trigger trg_customers_updated before update on customers
  for each row execute function set_updated_at();


-- ============================================================================
-- reservations
-- ============================================================================
create table if not exists reservations (
  id                  uuid primary key default gen_random_uuid(),
  reservation_code    text not null unique,

  workshop_id         uuid not null references workshops(id) on delete restrict,
  customer_id         uuid not null references customers(id) on delete restrict,

  quantity            integer not null check (quantity >= 1 and quantity <= 10),

  -- Instantánea del precio al momento de reservar. Si el taller sube de precio
  -- en octubre, las reservas de septiembre conservan lo que se cobró. Sin esto
  -- el historial de ingresos se reescribe solo.
  unit_price          numeric(10,2) not null check (unit_price >= 0),
  total_amount        numeric(10,2) not null check (total_amount >= 0),
  currency            char(3) not null default 'MXN',

  status              reservation_status not null default 'pending_payment',

  -- El corazón del control de cupo.
  expires_at          timestamptz,
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,

  companions          text,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint hold_coherente check (
    status <> 'pending_payment' or expires_at is not null
  )
);

-- El índice más caliente del sistema: alimenta cada cálculo de disponibilidad.
-- Es parcial, así que las reservas viejas (expired/cancelled) no lo engordan.
create index if not exists idx_reservations_ocupacion
  on reservations (workshop_id)
  where status in ('pending_payment', 'confirmed');

create index if not exists idx_reservations_workshop on reservations (workshop_id);
create index if not exists idx_reservations_status   on reservations (status);
create index if not exists idx_reservations_expires  on reservations (expires_at)
  where status = 'pending_payment';
create index if not exists idx_reservations_customer on reservations (customer_id);

drop trigger if exists trg_reservations_updated on reservations;
create trigger trg_reservations_updated before update on reservations
  for each row execute function set_updated_at();


-- ============================================================================
-- payments
-- ----------------------------------------------------------------------------
-- REGLA ABSOLUTA: aquí no entra ningún dato de tarjeta. Ni número, ni CVV, ni
-- vencimiento, ni titular. Solo identificadores opacos de Stripe.
-- ============================================================================
create table if not exists payments (
  id                         uuid primary key default gen_random_uuid(),
  reservation_id             uuid not null references reservations(id) on delete restrict,

  provider                   text not null default 'stripe',
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,

  amount                     numeric(10,2) not null check (amount >= 0),
  currency                   char(3) not null default 'MXN',

  status                     payment_status not null default 'pending',
  -- Lo que dijo Stripe textualmente, para conciliar sin adivinar.
  provider_status            text,
  failure_reason             text,

  -- Excepción operativa: el pago llegó pero ya no había cupo. Ver la función
  -- confirmar_pago(). No se pierde el dinero ni la información; se marca para
  -- que una persona lo resuelva.
  needs_review               boolean not null default false,
  review_reason              text,

  paid_at                    timestamptz,
  refunded_at                timestamptz,
  refunded_amount            numeric(10,2),

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_payments_reservation on payments (reservation_id);
create unique index if not exists uq_payments_session
  on payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists uq_payments_intent
  on payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists idx_payments_review on payments (created_at)
  where needs_review;

drop trigger if exists trg_payments_updated on payments;
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();


-- ============================================================================
-- webhook_events · idempotencia
-- ----------------------------------------------------------------------------
-- La llave primaria es el id del evento DEL PROVEEDOR (evt_...). Eso convierte
-- la idempotencia en una sola línea de SQL y hace que la garantía la dé la
-- base, no la lógica de aplicación.
-- ============================================================================
create table if not exists webhook_events (
  provider_event_id text primary key,
  provider          text not null default 'stripe',
  type              text not null,
  payload           jsonb not null,
  status            text not null default 'received'
                    check (status in ('received', 'processed', 'failed')),
  error             text,
  attempts          integer not null default 0,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz
);

create index if not exists idx_webhook_pendientes on webhook_events (received_at)
  where status <> 'processed';


-- ============================================================================
-- integration_jobs · cola de efectos secundarios
-- ----------------------------------------------------------------------------
-- Es la pieza que hace que una caída de Google Calendar o de Resend NO pueda
-- costar una venta. El webhook hace UNA transacción corta (confirma y encola)
-- y responde 200 en milisegundos; un worker aparte vacía la cola con
-- reintentos.
-- ============================================================================
create table if not exists integration_jobs (
  id            uuid primary key default gen_random_uuid(),
  type          job_type not null,
  entity_type   text not null,
  entity_id     uuid not null,
  payload       jsonb not null default '{}',
  status        job_status not null default 'pending',
  attempts      integer not null default 0,
  last_error    text,
  next_retry_at timestamptz not null default now(),
  dedupe_key    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Único mientras el trabajo está VIVO. Dos efectos distintos:
--   · email_send:<reserva>     -> no se encola dos veces el mismo correo
--   · calendar_sync:<taller>   -> tres pagos en un minuto producen UNA sola
--     llamada a Google, porque el worker reconstruye la descripción completa
--     desde la base (es idempotente por construcción).
-- Al completarse, la llave se libera para la siguiente sincronización.
create unique index if not exists uq_jobs_vivo
  on integration_jobs (dedupe_key)
  where dedupe_key is not null and status in ('pending', 'processing');

create index if not exists idx_jobs_pendientes
  on integration_jobs (next_retry_at) where status = 'pending';
create index if not exists idx_jobs_fallidos
  on integration_jobs (updated_at) where status = 'failed';

drop trigger if exists trg_jobs_updated on integration_jobs;
create trigger trg_jobs_updated before update on integration_jobs
  for each row execute function set_updated_at();


-- ============================================================================
-- Prospectos
-- ============================================================================
create table if not exists membership_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  phone       text,
  message     text,
  interests   text[] not null default '{}',
  status      lead_status not null default 'new',
  admin_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists contact_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  phone       text,
  message     text not null,
  status      lead_status not null default 'new',
  admin_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_membership_nuevos on membership_leads (created_at desc);
create index if not exists idx_contact_nuevos    on contact_leads (created_at desc);

drop trigger if exists trg_membership_updated on membership_leads;
create trigger trg_membership_updated before update on membership_leads
  for each row execute function set_updated_at();
drop trigger if exists trg_contact_updated on contact_leads;
create trigger trg_contact_updated before update on contact_leads
  for each row execute function set_updated_at();


-- ============================================================================
-- admin_profiles
-- ----------------------------------------------------------------------------
-- NO es una tabla de usuarios con contraseñas. Supabase Auth ya tiene
-- auth.users; esta tabla solo dice cuál de esos usuarios es administrador.
-- Los clientes NUNCA crean cuenta: reservan sin registrarse.
-- ============================================================================
create table if not exists admin_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text,
  role        text not null default 'admin' check (role in ('admin')),
  created_at  timestamptz not null default now()
);


-- ============================================================================
-- site_settings · una sola fila
-- ----------------------------------------------------------------------------
-- Saca del código el WhatsApp, el correo y la dirección, para que Casa Numa
-- los edite sin volver a publicar el sitio.
-- ============================================================================
create table if not exists site_settings (
  id                   boolean primary key default true check (id),
  nombre               text not null default 'Casa Numa',
  lema                 text,
  whatsapp             text,
  whatsapp_url         text,
  email                text,
  instagram            text,
  instagram_url        text,
  direccion_linea1     text,
  direccion_linea2     text,
  horarios             jsonb not null default '[]',
  mapa_embed_url       text,
  politica_cancelacion text,
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_settings_updated on site_settings;
create trigger trg_settings_updated before update on site_settings
  for each row execute function set_updated_at();

insert into site_settings (id) values (true) on conflict (id) do nothing;


-- ============================================================================
-- rate_limit · defensa anti-spam mínima para formularios públicos
-- ============================================================================
create table if not exists rate_limit (
  clave   text not null,
  ventana timestamptz not null,
  conteo  integer not null default 1,
  primary key (clave, ventana)
);


-- ============================================================================
-- audit_log · quién canceló qué y cuándo
-- ============================================================================
create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  actor      text not null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entidad
  on audit_log (entity, entity_id, created_at desc);


-- ==========================================================================
-- ARCHIVO: 20260909100200_functions.sql
-- ==========================================================================

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


-- ==========================================================================
-- ARCHIVO: 20260909100300_jobs_y_consultas.sql
-- ==========================================================================

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


-- ==========================================================================
-- ARCHIVO: 20260909100400_rls.sql
-- ==========================================================================

-- ============================================================================
-- Casa Numa · 05 · Row Level Security
-- ----------------------------------------------------------------------------
-- LA REGLA QUE HAY QUE MEMORIZAR:
--   RLS activo sin políticas = nadie puede nada.
--   RLS inactivo             = todos pueden todo.
--
-- Y "todos" incluye a cualquiera que copie la anon key del código del
-- navegador, donde está a la vista por diseño. Una tabla de clientes sin RLS
-- activo es una tabla pública.
--
-- Reparto:
--   PUBLIC (anon)          -> lee talleres publicados. Nada más.
--   ADMIN (authenticated)  -> lee todo; las acciones pasan por Edge Functions.
--   BACKEND (service_role) -> ignora RLS por diseño; es quien escribe.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- es_admin()
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER a propósito: si las políticas consultaran admin_profiles
-- directamente, la política de admin_profiles se evaluaría a sí misma y
-- PostgreSQL entraría en recursión infinita. Es una trampa clásica de Supabase.
-- ----------------------------------------------------------------------------
create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from admin_profiles where user_id = auth.uid());
$$;

grant execute on function es_admin() to anon, authenticated, service_role;


-- ============================================================================
-- 1. RLS activo en TODAS las tablas
-- ============================================================================
alter table workshops        enable row level security;
alter table customers        enable row level security;
alter table reservations     enable row level security;
alter table payments         enable row level security;
alter table webhook_events   enable row level security;
alter table integration_jobs enable row level security;
alter table membership_leads enable row level security;
alter table contact_leads    enable row level security;
alter table admin_profiles   enable row level security;
alter table site_settings    enable row level security;
alter table rate_limit       enable row level security;
alter table audit_log        enable row level security;


-- ============================================================================
-- 2. Quitar los permisos que Supabase otorga por omisión
-- ----------------------------------------------------------------------------
-- RLS ya protegería estas tablas, pero revocar también los GRANT es defensa en
-- profundidad: si algún día alguien desactiva RLS por error, la tabla sigue
-- sin ser legible.
-- ============================================================================
revoke all on workshops, customers, reservations, payments, webhook_events,
              integration_jobs, membership_leads, contact_leads,
              admin_profiles, site_settings, rate_limit, audit_log
  from anon, authenticated;


-- ============================================================================
-- 3. Lo único que el público puede leer
-- ----------------------------------------------------------------------------
-- Permiso a nivel de COLUMNA: anon ve el catálogo, pero no
-- google_calendar_event_id, cloudinary_public_id ni las marcas internas.
-- ============================================================================
grant select (
  id, slug, title, category, short_description, description,
  date, start_time, end_time, timezone, price, currency, capacity,
  location, instructor, level, image_url, gallery,
  includes, crearas, faqs, tono, booking_mode, status
) on workshops to anon, authenticated;

drop policy if exists taller_publicado_visible on workshops;
create policy taller_publicado_visible on workshops
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists admin_ve_talleres on workshops;
create policy admin_ve_talleres on workshops
  for select to authenticated using (es_admin());

-- El admin edita talleres desde el panel. Es la única escritura directa que se
-- permite desde el navegador, y solo para quien está en admin_profiles.
drop policy if exists admin_crea_talleres on workshops;
create policy admin_crea_talleres on workshops
  for insert to authenticated with check (es_admin());

drop policy if exists admin_edita_talleres on workshops;
create policy admin_edita_talleres on workshops
  for update to authenticated using (es_admin()) with check (es_admin());

grant insert, update on workshops to authenticated;


-- ============================================================================
-- 4. public_workshops · el catálogo con disponibilidad en vivo
-- ----------------------------------------------------------------------------
-- `security_invoker = on` hace que la vista lea workshops con los permisos de
-- quien consulta, no con los del dueño. Es lo correcto y además evita la
-- advertencia de "security definer view" del linter de Supabase.
--
-- La disponibilidad NO se calcula con un join contra reservations (anon no
-- puede leer esa tabla, y no debe). Se obtiene llamando a lugares_ocupados(),
-- que es SECURITY DEFINER y devuelve solo un número: nunca se expone quién
-- reservó ni cuándo.
-- ============================================================================
create or replace view public_workshops
with (security_invoker = on)
as
select
  w.id, w.slug, w.title, w.category, w.short_description, w.description,
  w.date, w.start_time, w.end_time, w.timezone,
  w.price, w.currency, w.capacity,
  w.location, w.instructor, w.level,
  w.image_url, w.gallery, w.includes, w.crearas, w.faqs, w.tono,
  w.booking_mode,
  greatest(w.capacity - lugares_ocupados(w.id), 0) as seats_available
from workshops w
where w.status = 'published';

grant select on public_workshops to anon, authenticated;

comment on view public_workshops is
  'Catálogo público con disponibilidad en vivo. Única superficie de lectura anónima del sistema.';


-- ============================================================================
-- 5. Todo lo demás: el público no ve nada
-- ----------------------------------------------------------------------------
-- No se declara ninguna política para anon en customers, reservations,
-- payments, webhook_events, integration_jobs, leads ni audit_log. Con RLS
-- activo, la ausencia de política significa denegar.
--
-- La consulta de una reserva por parte del cliente NO se resuelve abriendo
-- reservations al público: se hace por Edge Function, exigiendo código +
-- correo, con límite de intentos por IP.
--
-- La creación de reservas tampoco es un INSERT público: pasa por la RPC
-- crear_reserva(), que solo puede invocar el backend con service_role.
-- ============================================================================
drop policy if exists admin_lee_clientes on customers;
create policy admin_lee_clientes on customers
  for select to authenticated using (es_admin());

drop policy if exists admin_lee_reservas on reservations;
create policy admin_lee_reservas on reservations
  for select to authenticated using (es_admin());

drop policy if exists admin_lee_pagos on payments;
create policy admin_lee_pagos on payments
  for select to authenticated using (es_admin());

drop policy if exists admin_lee_membresia on membership_leads;
create policy admin_lee_membresia on membership_leads
  for select to authenticated using (es_admin());

drop policy if exists admin_edita_membresia on membership_leads;
create policy admin_edita_membresia on membership_leads
  for update to authenticated using (es_admin()) with check (es_admin());

drop policy if exists admin_lee_contacto on contact_leads;
create policy admin_lee_contacto on contact_leads
  for select to authenticated using (es_admin());

drop policy if exists admin_edita_contacto on contact_leads;
create policy admin_edita_contacto on contact_leads
  for update to authenticated using (es_admin()) with check (es_admin());

drop policy if exists admin_lee_jobs on integration_jobs;
create policy admin_lee_jobs on integration_jobs
  for select to authenticated using (es_admin());

drop policy if exists admin_lee_bitacora on audit_log;
create policy admin_lee_bitacora on audit_log
  for select to authenticated using (es_admin());

grant select on customers, reservations, payments, membership_leads,
                contact_leads, integration_jobs, audit_log to authenticated;
grant update on membership_leads, contact_leads to authenticated;

-- Cada admin ve su propia fila, para saber su rol en la interfaz.
drop policy if exists admin_se_ve on admin_profiles;
create policy admin_se_ve on admin_profiles
  for select to authenticated using (user_id = auth.uid());
grant select on admin_profiles to authenticated;

-- La configuración del sitio es pública (WhatsApp, dirección, horarios).
-- Solo el admin la modifica.
grant select on site_settings to anon, authenticated;
drop policy if exists config_publica on site_settings;
create policy config_publica on site_settings
  for select to anon, authenticated using (true);

drop policy if exists admin_edita_config on site_settings;
create policy admin_edita_config on site_settings
  for update to authenticated using (es_admin()) with check (es_admin());
grant update on site_settings to authenticated;


-- ==========================================================================
-- ARCHIVO: seed.sql
-- ==========================================================================

-- ============================================================================
-- Casa Numa · Datos iniciales
-- ----------------------------------------------------------------------------
-- Los 11 talleres reales, extraidos del bundle original (commit 140ca86) y
-- migrados al esquema nuevo. En el demo todo esto estaba escrito a mano
-- dentro del JavaScript; aqui son datos, editables desde el panel.
--
-- Conversiones: status 'publicado' -> 'published' | image -> image_url
-- price 0 -> booking_mode 'quote' (no entra al flujo de pago)
-- duration -> eliminado (se deriva de start_time/end_time)
--
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================================

insert into workshops (
  slug, title, category, short_description, description,
  date, start_time, end_time, timezone, price, currency, capacity,
  location, instructor, level, includes, crearas, faqs,
  image_url, gallery, tono, booking_mode, status
) values
  (
    'ceramica-desde-cero', 'Cerámica desde cero', 'ceramica',
    'Una experiencia para aprender, ensuciarte las manos y crear tu primera pieza.',
    array['Empezamos por lo básico: sentir el barro, entender cómo responde y perderle el miedo. No necesitas experiencia ni haber tocado arcilla antes.', 'Trabajamos con técnicas de modelado a mano —pellizco, churro y placa— para que salgas con una pieza terminada y con ganas de volver por la siguiente.']::text[],
    '2026-09-12', '11:00', '13:30', 'America/Monterrey',
    650.00, 'MXN', 12,
    'Casa Numa', '[Nombre] — Fundadora', 'Principiante',
    array['Arcilla y herramientas', 'Delantal', 'Quema y esmaltado', 'Café y algo dulce']::text[],
    array['Un tazón o vaso modelado a mano', 'Una pieza pequeña de práctica']::text[],
    '[{"q":"¿Necesito experiencia?","a":"Ninguna. El taller está pensado para primeras veces."},{"q":"¿Cuándo me llevo mi pieza?","a":"Después de quema y esmaltado, alrededor de tres semanas. Te avisamos por WhatsApp."},{"q":"¿Cómo pago?","a":"Puedes pagar tu lugar en línea al momento de reservar. Tu reservación queda confirmada una vez que el pago ha sido aprobado."}]'::jsonb,
    '/images/talleres/ceramica-desde-cero.jpg',
    array['/images/talleres/ceramica-desde-cero-1.jpg', '/images/talleres/ceramica-desde-cero-2.jpg', '/images/talleres/ceramica-desde-cero-3.jpg']::text[],
    'terracota', 'paid', 'published'
  ),
  (
    'pinta-tu-propia-pieza', 'Pinta tu propia pieza', 'pintura',
    'Eliges una pieza en bizcocho y la haces tuya con color.',
    array['Una tarde tranquila, sin prisa. Escoges una pieza ya horneada y la pintas como quieras: con plantilla, a mano suelta o copiando algo que traigas guardado en el celular.', 'Es el taller ideal para venir acompañada, platicar y salir con algo hecho por ti.']::text[],
    '2026-09-14', '16:00', '18:00', 'America/Monterrey',
    550.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Talleres', 'Todos los niveles',
    array['Pieza en bizcocho a elegir', 'Esmaltes y pinceles', 'Quema final']::text[],
    array['Una pieza pintada por completo', 'Un diseño propio sobre cerámica']::text[],
    '[{"q":"¿Puedo elegir qué pieza pintar?","a":"Sí, tenemos tazas, platos y macetas pequeñas disponibles el día del taller."},{"q":"¿Puedo venir con alguien?","a":"Claro. Puedes reservar y pagar varios lugares en la misma operación."}]'::jsonb,
    '/images/talleres/pinta-tu-propia-pieza.jpg',
    array['/images/talleres/pinta-tu-propia-pieza-1.jpg', '/images/talleres/pinta-tu-propia-pieza-2.jpg']::text[],
    'azul', 'paid', 'published'
  ),
  (
    'ceramica-tematica-septiembre', 'Cerámica temática', 'especiales',
    'Cada mes cambiamos de tema. Este mes: vajilla de mesa mexicana.',
    array['Una sesión con tema fijo que cambia cada mes. Trabajamos una sola idea a fondo, con referencias, molde y color pensados para ese tema.', 'Se llena rápido: los lugares se abren el primer día del mes.']::text[],
    '2026-09-21', '11:00', '14:00', 'America/Monterrey',
    780.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Fundadora', 'Todos los niveles',
    array['Materiales del tema del mes', 'Quema y esmaltado', 'Comida ligera']::text[],
    array['Dos piezas de vajilla coordinadas']::text[],
    '[{"q":"¿Cuándo abren lugares nuevos?","a":"El primer día de cada mes anunciamos el tema y liberamos lugares en Instagram."}]'::jsonb,
    '/images/talleres/ceramica-tematica.jpg',
    array['/images/talleres/ceramica-tematica-1.jpg', '/images/talleres/ceramica-tematica-2.jpg']::text[],
    'olivo', 'paid', 'published'
  ),
  (
    'taller-libre-sabado', 'Taller libre', 'libre',
    'El estudio abierto: tú traes la idea, nosotras el barro y las herramientas.',
    array['Sin instrucción guiada. Reservas mesa, tomas materiales y trabajas a tu ritmo. Siempre hay alguien del estudio cerca por si te atoras.', 'Pensado para quienes ya tomaron un taller y quieren seguir practicando.']::text[],
    '2026-09-26', '10:00', '14:00', 'America/Monterrey',
    420.00, 'MXN', 8,
    'Casa Numa', 'Estudio abierto', 'Intermedio',
    array['Mesa de trabajo', 'Herramientas del estudio', 'Arcilla por kilo (se cobra aparte)']::text[],
    array['Lo que traigas en mente']::text[],
    '[{"q":"¿Puedo venir si es mi primera vez?","a":"Te recomendamos empezar por “Cerámica desde cero”. El taller libre no tiene instrucción guiada."}]'::jsonb,
    '/images/talleres/taller-libre.jpg',
    array['/images/talleres/taller-libre-1.jpg']::text[],
    'tinta', 'paid', 'published'
  ),
  (
    'day-pass-estudio', 'Day pass', 'libre',
    'Un día completo en el estudio, con todo incluido.',
    array['Llegas en la mañana y te vas cuando cerramos. Acceso a mesas, torno de práctica y materiales básicos.', 'Un buen plan para un día libre, sola o acompañada.']::text[],
    '2026-10-03', '10:00', '18:00', 'America/Monterrey',
    890.00, 'MXN', 6,
    'Casa Numa', 'Estudio abierto', 'Todos los niveles',
    array['Acceso todo el día', 'Materiales básicos', 'Café y comida ligera']::text[],
    array['Todas las piezas que alcances a terminar']::text[],
    '[{"q":"¿Puedo salir y volver?","a":"Sí, tu lugar se queda apartado todo el día."}]'::jsonb,
    '/images/talleres/day-pass.jpg',
    array['/images/talleres/day-pass-1.jpg']::text[],
    'arcilla', 'paid', 'published'
  ),
  (
    'torno-primera-vez', 'Torno por primera vez', 'ceramica',
    'Centrar, abrir y levantar. Dos horas frente al torno.',
    array['El torno intimida hasta que lo tocas. En esta sesión trabajas con tu propio torno durante toda la clase, en grupos muy pequeños.', 'Salimos con al menos una pieza levantada por ti.']::text[],
    '2026-10-10', '11:00', '13:00', 'America/Monterrey',
    720.00, 'MXN', 6,
    'Casa Numa', '[Nombre] — Fundadora', 'Principiante',
    array['Torno individual', 'Arcilla', 'Quema y esmaltado']::text[],
    array['Un cilindro o tazón levantado en torno']::text[],
    '[{"q":"¿Qué ropa llevo?","a":"Ropa que puedas ensuciar. El barro sale con agua, pero mejor no estrenar nada."}]'::jsonb,
    '/images/talleres/torno.jpg',
    array['/images/talleres/torno-1.jpg', '/images/talleres/torno-2.jpg']::text[],
    'terracota', 'paid', 'published'
  ),
  (
    'piezas-personalizadas', 'Piezas personalizadas', 'especiales',
    'Diseñamos contigo una pieza para un regalo, una boda o tu casa.',
    array['Una sesión de trabajo para definir forma, color y cantidad. De ahí sale un presupuesto y un calendario de producción.', 'Sirve igual para un juego de tazas de regalo que para la vajilla de un restaurante.']::text[],
    '2026-10-17', '12:00', '13:30', 'America/Monterrey',
    0.00, 'MXN', 4,
    'Casa Numa', '[Nombre] — Fundadora', 'Todos los niveles',
    array['Sesión de diseño', 'Muestrario de esmaltes', 'Presupuesto por escrito']::text[],
    array['El boceto y la ficha técnica de tu encargo']::text[],
    '[{"q":"¿La sesión tiene costo?","a":"La sesión de diseño no se cobra. La producción se cotiza según la pieza."}]'::jsonb,
    '/images/talleres/personalizadas.jpg',
    array['/images/talleres/personalizadas-1.jpg']::text[],
    'olivo', 'quote', 'published'
  ),
  (
    'acuarela-botanica', 'Acuarela botánica', 'pintura',
    'Papel, agua y plantas del patio. Una mañana lenta.',
    array['Cambiamos el barro por el papel. Aprendemos aguadas, transparencias y cómo dejar que el agua haga su parte.', 'Trabajamos observando plantas reales, no fotos.']::text[],
    '2026-10-24', '10:30', '13:00', 'America/Monterrey',
    590.00, 'MXN', 12,
    'Casa Numa', '[Nombre invitada]', 'Principiante',
    array['Papel de algodón', 'Acuarelas y pinceles', 'Café de olla']::text[],
    array['Tres láminas botánicas']::text[],
    '[{"q":"¿Puedo llevar mis materiales?","a":"Si ya tienes pinceles favoritos, tráelos. Lo demás lo ponemos nosotras."}]'::jsonb,
    '/images/talleres/acuarela.jpg',
    array['/images/talleres/acuarela-1.jpg']::text[],
    'azul', 'paid', 'published'
  ),
  (
    'esmaltes-y-color', 'Esmaltes y color', 'ceramica',
    'Cómo se comporta el color en el horno y por qué a veces sorprende.',
    array['Un taller para quienes ya modelan y quieren entender el esmalte: capas, superposiciones y pruebas.', 'Hacemos una tabla de muestras que te llevas para tus siguientes piezas.']::text[],
    '2026-11-07', '11:00', '14:00', 'America/Monterrey',
    690.00, 'MXN', 10,
    'Casa Numa', '[Nombre] — Fundadora', 'Intermedio',
    array['Piezas de prueba', 'Esmaltes del estudio', 'Tabla de muestras para llevar']::text[],
    array['Una tabla de esmaltes propia', 'Dos piezas esmaltadas']::text[],
    '[{"q":"¿Necesito traer piezas?","a":"No, nosotras ponemos las piezas de prueba."}]'::jsonb,
    '/images/talleres/esmaltes.jpg',
    array['/images/talleres/esmaltes-1.jpg']::text[],
    'arcilla', 'paid', 'published'
  ),
  (
    'noche-de-barro', 'Noche de barro', 'especiales',
    'Entre semana, después del trabajo, con música y vino.',
    array['Abrimos el estudio de noche una vez al mes. Modelado libre, playlist larga y una copa incluida.', 'Es más plan social que clase, pero siempre sale algo.']::text[],
    '2026-11-13', '19:00', '22:00', 'America/Monterrey',
    640.00, 'MXN', 16,
    'Casa Numa', 'Equipo Casa Numa', 'Todos los niveles',
    array['Arcilla y herramientas', 'Una copa', 'Snacks']::text[],
    array['Una pieza libre']::text[],
    '[{"q":"¿Es solo para mayores de edad?","a":"Sí, por la bebida incluida. Hay opción sin alcohol."}]'::jsonb,
    '/images/talleres/noche-de-barro.jpg',
    array['/images/talleres/noche-de-barro-1.jpg']::text[],
    'tinta', 'paid', 'published'
  ),
  (
    'taller-libre-noviembre', 'Taller libre', 'libre',
    'El estudio abierto: tú traes la idea, nosotras el barro.',
    array['Misma dinámica del taller libre: mesa, herramientas y tu ritmo.']::text[],
    '2026-11-21', '10:00', '14:00', 'America/Monterrey',
    420.00, 'MXN', 8,
    'Casa Numa', 'Estudio abierto', 'Intermedio',
    array['Mesa de trabajo', 'Herramientas del estudio']::text[],
    array['Lo que traigas en mente']::text[],
    '[{"q":"¿Hay que reservar?","a":"Sí, los lugares son limitados por mesa."}]'::jsonb,
    '/images/talleres/taller-libre-nov.jpg',
    '{}',
    'olivo', 'paid', 'published'
  )
on conflict (slug) do update set
  title              = excluded.title,
  category           = excluded.category,
  short_description  = excluded.short_description,
  description        = excluded.description,
  date               = excluded.date,
  start_time         = excluded.start_time,
  end_time           = excluded.end_time,
  timezone           = excluded.timezone,
  price              = excluded.price,
  capacity           = excluded.capacity,
  location           = excluded.location,
  instructor         = excluded.instructor,
  level              = excluded.level,
  includes           = excluded.includes,
  crearas            = excluded.crearas,
  faqs               = excluded.faqs,
  image_url          = excluded.image_url,
  gallery            = excluded.gallery,
  tono               = excluded.tono,
  booking_mode       = excluded.booking_mode;

-- ============================================================================
-- Ocupacion de demostracion  ·  OPCIONAL — BORRAR ANTES DE PRODUCCION
-- ----------------------------------------------------------------------------
-- Reproduce los contadores que el demo tenia escritos a mano, para que:
--   1. El sitio se vea igual que el demo original.
--   2. Haya datos para probar el cupo de inmediato:
--      · noche-de-barro        -> 14/16, quedan 2  (TEST C: concurrencia)
--      · ceramica-tematica-... -> 10/10, lleno     (TEST B: rechazo)
--
-- Se reparte en reservas de 1 a 3 personas porque quantity tiene un CHECK
-- de 1 a 10, y porque asi se parece a la realidad.
-- ============================================================================

insert into customers (full_name, email, phone) values
  ('María Fernanda G.', 'demo1@casanuma.local', '+528180001000'),
  ('Ana Sofía R.', 'demo2@casanuma.local', '+528180001001'),
  ('Regina M.', 'demo3@casanuma.local', '+528180001002'),
  ('Paulina T.', 'demo4@casanuma.local', '+528180001003'),
  ('Valeria C.', 'demo5@casanuma.local', '+528180001004'),
  ('Daniela H.', 'demo6@casanuma.local', '+528180001005'),
  ('Ximena L.', 'demo7@casanuma.local', '+528180001006'),
  ('Andrea P.', 'demo8@casanuma.local', '+528180001007'),
  ('Camila S.', 'demo9@casanuma.local', '+528180001008'),
  ('Renata V.', 'demo10@casanuma.local', '+528180001009'),
  ('Fernanda O.', 'demo11@casanuma.local', '+528180001010'),
  ('Mariana B.', 'demo12@casanuma.local', '+528180001011')
on conflict (email) do nothing;

insert into reservations (
  reservation_code, workshop_id, customer_id, quantity,
  unit_price, total_amount, currency, status, confirmed_at, notes
)
select
  'NUMA-' || upper(substr(md5(d.slug || d.idx::text), 1, 6)),
  w.id, c.id, d.n,
  w.price, w.price * d.n, 'MXN', 'confirmed',
  now() - (d.idx || ' hours')::interval,
  'Ocupacion heredada del demo. Borrar antes de produccion.'
from (values
  ('ceramica-desde-cero', 'demo1@casanuma.local', 2, 0),
  ('ceramica-desde-cero', 'demo2@casanuma.local', 1, 1),
  ('ceramica-desde-cero', 'demo3@casanuma.local', 1, 2),
  ('pinta-tu-propia-pieza', 'demo1@casanuma.local', 2, 0),
  ('pinta-tu-propia-pieza', 'demo2@casanuma.local', 1, 1),
  ('pinta-tu-propia-pieza', 'demo3@casanuma.local', 3, 2),
  ('pinta-tu-propia-pieza', 'demo4@casanuma.local', 1, 3),
  ('ceramica-tematica-septiembre', 'demo1@casanuma.local', 2, 0),
  ('ceramica-tematica-septiembre', 'demo2@casanuma.local', 1, 1),
  ('ceramica-tematica-septiembre', 'demo3@casanuma.local', 3, 2),
  ('ceramica-tematica-septiembre', 'demo4@casanuma.local', 2, 3),
  ('ceramica-tematica-septiembre', 'demo5@casanuma.local', 1, 4),
  ('ceramica-tematica-septiembre', 'demo6@casanuma.local', 1, 5),
  ('taller-libre-sabado', 'demo1@casanuma.local', 2, 0),
  ('taller-libre-sabado', 'demo2@casanuma.local', 1, 1),
  ('taller-libre-sabado', 'demo3@casanuma.local', 2, 2),
  ('day-pass-estudio', 'demo1@casanuma.local', 2, 0),
  ('torno-primera-vez', 'demo1@casanuma.local', 2, 0),
  ('torno-primera-vez', 'demo2@casanuma.local', 1, 1),
  ('acuarela-botanica', 'demo1@casanuma.local', 2, 0),
  ('acuarela-botanica', 'demo2@casanuma.local', 1, 1),
  ('acuarela-botanica', 'demo3@casanuma.local', 3, 2),
  ('acuarela-botanica', 'demo4@casanuma.local', 2, 3),
  ('acuarela-botanica', 'demo5@casanuma.local', 1, 4),
  ('esmaltes-y-color', 'demo1@casanuma.local', 2, 0),
  ('noche-de-barro', 'demo1@casanuma.local', 2, 0),
  ('noche-de-barro', 'demo2@casanuma.local', 1, 1),
  ('noche-de-barro', 'demo3@casanuma.local', 3, 2),
  ('noche-de-barro', 'demo4@casanuma.local', 2, 3),
  ('noche-de-barro', 'demo5@casanuma.local', 1, 4),
  ('noche-de-barro', 'demo6@casanuma.local', 2, 5),
  ('noche-de-barro', 'demo7@casanuma.local', 3, 6)
) as d(slug, email, n, idx)
join workshops w on w.slug = d.slug
join customers c on c.email = d.email
on conflict (reservation_code) do nothing;
