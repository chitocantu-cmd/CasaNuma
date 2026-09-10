// ===========================================================================
// Casa Numa · process-jobs
// ---------------------------------------------------------------------------
// Vacía la cola de integration_jobs: correos (Resend) y agenda (Google
// Calendar).
//
// Esta separación es la que hace que una caída de Google o de Resend NO pueda
// costar una venta. El cliente ya pagó y su reserva ya está confirmada mucho
// antes de que este worker corra; si algo falla aquí, se reintenta.
//
// Lo dispara pg_cron cada minuto. Dos ejecuciones traslapadas no se pisan:
// reclamar_jobs() usa `for update skip locked`.
// ===========================================================================

import { db, env, logError, APP_URL } from '../_shared/clients.ts';
import {
  confirmacion, avisoAdminReserva, cancelacion, avisoLead, enviar,
  type DatosReserva, type DatosLead,
} from '../_shared/emails.ts';
import { sincronizarTaller, type ResumenTaller } from '../_shared/google-calendar.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ADMIN_EMAIL = Deno.env.get('RESEND_ADMIN_EMAIL') ?? '';

interface Job {
  id: string;
  type: 'email_send' | 'calendar_sync';
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // Este endpoint manda correos y toca Google: no puede quedar abierto. Sin el
  // secreto, cualquiera podría dispararlo en bucle y quemar la cuota.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('No autorizado', { status: 401 });
  }

  const { data: jobs, error } = await db.rpc('reclamar_jobs', { p_limite: 20 });

  if (error) {
    logError('process-jobs/reclamar', error);
    return new Response('Error al reclamar trabajos', { status: 500 });
  }
  if (!jobs || jobs.length === 0) {
    return json({ procesados: 0 });
  }

  let hechos = 0, fallidos = 0;

  for (const job of jobs as Job[]) {
    try {
      await ejecutar(job);
      await db.rpc('completar_job', { p_id: job.id });
      hechos++;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      logError(`process-jobs/${job.type}`, mensaje);
      // Reintento con espaciado creciente. Tras 5 intentos queda 'failed' y
      // aparece en la tarjeta de alertas del panel.
      await db.rpc('fallar_job', { p_id: job.id, p_error: mensaje });
      fallidos++;
    }
  }

  return json({ procesados: jobs.length, hechos, fallidos });
});

// ---------------------------------------------------------------------------

async function ejecutar(job: Job): Promise<void> {
  if (job.type === 'calendar_sync') return await sincronizarCalendario(job);
  if (job.type === 'email_send') return await mandarCorreo(job);
  throw new Error(`Tipo de trabajo desconocido: ${job.type}`);
}

async function sincronizarCalendario(job: Job): Promise<void> {
  const { data, error } = await db.rpc('resumen_taller', {
    p_workshop_id: job.entity_id,
  });
  if (error) throw error;
  if (!data) throw new Error(`Taller ${job.entity_id} no encontrado`);

  const eventId = await sincronizarTaller(data as ResumenTaller);

  // Se guarda siempre: si el evento se había borrado en Google y se recreó,
  // el id nuevo tiene que quedar registrado.
  await db.rpc('guardar_evento_calendar', {
    p_workshop_id: job.entity_id,
    p_event_id: eventId,
  });
}

async function mandarCorreo(job: Job): Promise<void> {
  const plantilla = String(job.payload.template ?? '');

  // Avisos de prospecto: no cuelgan de una reserva.
  if (plantilla === 'admin_lead') {
    if (!ADMIN_EMAIL) throw new Error('Falta RESEND_ADMIN_EMAIL');
    const { data, error } = await db.rpc('datos_prospecto', {
      p_lead_id: job.entity_id,
      p_tipo: String(job.payload.tipo ?? 'contacto'),
    });
    if (error) throw error;
    if (!data) throw new Error('Prospecto no encontrado');
    await enviar(avisoLead(data as DatosLead, ADMIN_EMAIL));
    return;
  }

  const { data, error } = await db.rpc('datos_reserva', {
    p_reservation_id: job.entity_id,
  });
  if (error) throw error;
  if (!data) throw new Error(`Reserva ${job.entity_id} no encontrada`);

  const r = data as DatosReserva;

  switch (plantilla) {
    case 'confirmacion':
      await enviar(confirmacion(r, APP_URL));
      return;

    case 'admin_reserva':
      if (!ADMIN_EMAIL) throw new Error('Falta RESEND_ADMIN_EMAIL');
      await enviar(avisoAdminReserva(r, ADMIN_EMAIL));
      return;

    case 'cancelacion':
      await enviar(cancelacion(r, job.payload.motivo as string | undefined));
      return;

    default:
      throw new Error(`Plantilla desconocida: ${plantilla}`);
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Se declara para que falte temprano y con mensaje claro si no está cargada.
env('SUPABASE_URL');
