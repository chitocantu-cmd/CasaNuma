-- ============================================================================
-- Casa Numa · 16 · Catálogo administrado desde el panel
-- ----------------------------------------------------------------------------
-- El equipo crea, edita, activa y desactiva talleres en /admin/talleres
-- (con su sesión de admin y el RLS de siempre: admin_crea_talleres,
-- admin_edita_talleres, admin_crea_sesiones, admin_edita_sesiones).
--
--   origen      'agenda' = lo cargó dev/cargar-agenda.mjs;
--               'panel'  = lo creó el equipo (se aparta siempre como taller).
--   editado_en  el equipo lo cambió en el panel: la carga de la agenda ya no
--               lo sobrescribe ni lo vuelve a publicar.
-- ============================================================================

alter table workshops
  add column if not exists origen text not null default 'agenda'
    check (origen in ('agenda', 'panel')),
  add column if not exists editado_en timestamptz;

-- El sitio necesita `origen` para saber cómo se aparta; editado_en solo el panel.
grant select (origen) on workshops to anon, authenticated;
grant select (editado_en) on workshops to authenticated;
