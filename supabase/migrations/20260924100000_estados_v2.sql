-- ============================================================================
-- Casa Numa · 08 · Estados nuevos (reservas v2)
-- ----------------------------------------------------------------------------
-- Va en su propio archivo a propósito: PostgreSQL no deja USAR un valor de
-- enum en la misma transacción que lo agrega. Cada migración corre en su
-- propia transacción, así que la siguiente ya puede usarlos.
--
--   completed  la clienta asistió (la marca el equipo o el cierre del día)
--   no_show    tenía lugar pagado y no llegó
--   whatsapp_send  aviso al equipo por la API oficial de WhatsApp Business
-- ============================================================================

alter type reservation_status add value if not exists 'completed';
alter type reservation_status add value if not exists 'no_show';
alter type job_type add value if not exists 'whatsapp_send';
