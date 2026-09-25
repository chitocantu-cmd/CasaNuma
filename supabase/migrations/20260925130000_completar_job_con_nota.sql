-- ============================================================================
-- Casa Numa · 17 · Cerrar un trabajo con su nota en un solo paso
-- ----------------------------------------------------------------------------
-- El worker cierra con nota los trabajos que no hicieron nada (p. ej.
-- «OMITIDO: Google Calendar sin configurar»). Lo hacía en dos pasos y, entre
-- uno y otro, el panel podía ver el trabajo «hecho» sin nota y creer que la
-- integración ya funcionaba. Ahora la nota entra con el cierre.
-- ============================================================================

drop function if exists completar_job(uuid);

create or replace function completar_job(p_id uuid, p_nota text default null)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  -- Al pasar a 'done' se libera la dedupe_key (el índice único solo aplica a
  -- pending/processing), lo que permite la siguiente sincronización.
  update integration_jobs
     set status = 'done', last_error = p_nota
   where id = p_id;
$$;

revoke all on function completar_job(uuid, text) from public, anon, authenticated;
grant execute on function completar_job(uuid, text) to service_role;
