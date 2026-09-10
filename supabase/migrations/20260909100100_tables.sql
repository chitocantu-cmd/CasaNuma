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
