-- ============================================================================
-- Casa Numa · 07 · El panel necesita leer workshops completo
-- ----------------------------------------------------------------------------
-- El problema: la migración de RLS otorga SELECT sobre `workshops` a nivel de
-- COLUMNA, para que el público no vea google_calendar_event_id ni
-- cloudinary_public_id. Eso es correcto para `anon`.
--
-- Pero el panel hace `select *` y necesita esas columnas, así que fallaba con
-- "permission denied for table workshops" — un error confuso, porque las
-- políticas de RLS eran correctas: lo que faltaba era el GRANT.
--
-- Es una distinción que se olvida fácil: en PostgreSQL, RLS y GRANT son dos
-- capas independientes. Una política permisiva no sirve de nada si el rol no
-- tiene concedido el privilegio sobre la columna.
--
-- Solución: `authenticated` recibe SELECT completo. Las filas que puede ver
-- las siguen decidiendo las políticas:
--   · taller_publicado_visible -> cualquiera ve los publicados
--   · admin_ve_talleres        -> los admins ven todos, en cualquier estado
--
-- `anon` conserva el permiso limitado por columna: el público sigue sin ver
-- los identificadores internos.
-- ============================================================================

grant select on workshops to authenticated;

-- Recordatorio: esto solo importa si el registro público está DESACTIVADO en
-- Authentication -> Providers -> Email. Si cualquiera pudiera crear cuenta,
-- `authenticated` dejaría de ser sinónimo de "equipo de Casa Numa".
