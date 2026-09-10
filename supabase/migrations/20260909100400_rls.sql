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
