-- ============================================================================
-- Casa Numa · 10 · Catálogo sin datos inventados
-- ----------------------------------------------------------------------------
-- v1 obligaba a que cada taller tuviera cupo y hora de cierre. La agenda real
-- de Casa Numa todavía no publica esos datos, y no se inventan: pasan a ser
-- opcionales (NULL = pendiente). Desde v2 el cupo que cuenta es el de cada
-- sesión (workshop_sessions.capacity); el de workshops queda como referencia.
--
-- Con NULL, lo que queda de v1 falla del lado seguro: public_workshops y
-- crear_reserva() ven 0 lugares y no venden nada.
--
-- Además, las columnas de src/datos/agenda.ts que la tabla no tenía, para que
-- el catálogo se lea de la base sin perder nada.
-- ============================================================================

alter table workshops alter column capacity drop not null;
alter table workshops alter column end_time drop not null;

alter table workshops
  -- Texto de la etiqueta cuando no basta la categoría ("Clases").
  add column if not exists label       text,
  -- Lo que se muestra en lugar del precio ("Info DM").
  add column if not exists price_label text,
  add column if not exists age_min     smallint check (age_min is null or age_min between 0 and 99),
  add column if not exists age_max     smallint check (age_max is null or age_max between 0 and 99),
  -- Identificador de la foto en src/contenido/fotos.ts (hasta que haya Cloudinary).
  add column if not exists image_key   text,
  add column if not exists is_featured boolean not null default false;

-- El público lee el catálogo por columna (ver 20260909100400_rls.sql).
grant select (label, price_label, age_min, age_max, image_key, is_featured)
  on workshops to anon, authenticated;
