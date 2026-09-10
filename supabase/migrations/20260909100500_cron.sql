-- ============================================================================
-- Casa Numa · 06 · Tareas programadas
-- ----------------------------------------------------------------------------
-- ANTES DE CORRER ESTE ARCHIVO, ejecuta una sola vez en el SQL Editor,
-- sustituyendo los valores:
--
--   select vault.create_secret(
--     'https://TU-PROJECT-REF.supabase.co/functions/v1/process-jobs',
--     'jobs_worker_url'
--   );
--
--   select vault.create_secret(
--     'EL-MISMO-VALOR-QUE-CRON_SECRET-EN-LAS-EDGE-FUNCTIONS',
--     'cron_secret'
--   );
--
-- El secreto queda cifrado en el vault de Supabase: no se escribe en este
-- archivo ni en el repositorio.
--
-- Si `create extension` falla por permisos, habilita pg_cron y pg_net desde
-- Database -> Extensions y vuelve a correr el resto.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ----------------------------------------------------------------------------
-- Expirar holds vencidos · cada minuto
-- ----------------------------------------------------------------------------
-- Recordatorio de por qué esto es cosmético y no crítico: lugares_ocupados()
-- filtra por `expires_at > now()`, así que un hold vencido deja de contar en
-- el instante exacto en que vence, sin que nada se ejecute.
--
-- Si este cron se detiene, NO se sobrevende. Esa propiedad es intencional: la
-- corrección del sistema no depende de que un proceso programado siga vivo.
-- ----------------------------------------------------------------------------
select cron.unschedule('casa-numa-expirar-holds')
  where exists (select 1 from cron.job where jobname = 'casa-numa-expirar-holds');

select cron.schedule(
  'casa-numa-expirar-holds',
  '* * * * *',
  $cron$ select expirar_holds(); $cron$
);


-- ----------------------------------------------------------------------------
-- Marcar talleres pasados como completados · cada hora
-- ----------------------------------------------------------------------------
select cron.unschedule('casa-numa-completar-talleres')
  where exists (select 1 from cron.job where jobname = 'casa-numa-completar-talleres');

select cron.schedule(
  'casa-numa-completar-talleres',
  '5 * * * *',
  $cron$ select completar_talleres_pasados(); $cron$
);


-- ----------------------------------------------------------------------------
-- Vaciar la cola de integraciones · cada minuto
-- ----------------------------------------------------------------------------
-- No pasa nada si dos ejecuciones se traslapan: reclamar_jobs() usa
-- `for update skip locked`, así que la segunda salta los trabajos que la
-- primera ya tomó. Nadie recibe el correo dos veces.
-- ----------------------------------------------------------------------------
select cron.unschedule('casa-numa-jobs')
  where exists (select 1 from cron.job where jobname = 'casa-numa-jobs');

select cron.schedule(
  'casa-numa-jobs',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
             where name = 'jobs_worker_url'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);


-- ----------------------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------------------
--   select jobname, schedule, active from cron.job;
--
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobname like 'casa-numa%'
--    order by start_time desc limit 10;
--
--   -- Trabajos atorados (alimentan la tarjeta de alertas del panel):
--   select type, status, attempts, last_error
--     from integration_jobs where status = 'failed';
--
--   -- Pagos que necesitan intervención humana:
--   select id, reservation_id, amount, review_reason
--     from payments where needs_review;
-- ----------------------------------------------------------------------------
