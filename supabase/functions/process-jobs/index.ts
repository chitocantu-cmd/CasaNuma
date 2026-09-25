// ===========================================================================
// Casa Numa · process-jobs
// ---------------------------------------------------------------------------
// Vacía la cola de integration_jobs: correos (Resend), avisos por WhatsApp
// (API oficial de WhatsApp Business) y agenda (Google Calendar).
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
import { calendarioConfigurado, sincronizarSesion, type ResumenSesion } from '../_shared/google-calendar.ts';
import { avisarReservaPorWhatsApp } from '../_shared/whatsapp.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
// Correo del equipo para avisos de reserva. ADMIN_NOTIFICATION_EMAIL es el
// nombre nuevo; RESEND_ADMIN_EMAIL se sigue aceptando para no romper la
// configuración actual. No hay valor por omisión: no se inventa un correo.
const ADMIN_EMAIL = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || Deno.env.get('RESEND_ADMIN_EMAIL') || '';

interface Job {
  id: string;
  type: 'email_send' | 'calendar_sync' | 'whatsapp_send';
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
      const nota = await ejecutar(job);
      await db.rpc('completar_job', { p_id: job.id });
      // Terminado sin enviar (p. ej. WhatsApp sin configurar): queda anotado
      // para que el panel no lo muestre como enviado.
      if (nota) await db.from('integration_jobs').update({ last_error: nota }).eq('id', job.id);
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

/** Devuelve una nota cuando el trabajo termina sin hacer nada (no es error). */
async function ejecutar(job: Job): Promise<string | void> {
  if (job.type === 'calendar_sync') return await sincronizarCalendario(job);
  if (job.type === 'email_send') return await mandarCorreo(job);
  if (job.type === 'whatsapp_send') return await mandarWhatsApp(job);
  throw new Error(`Tipo de trabajo desconocido: ${job.type}`);
}

async function sincronizarCalendario(job: Job): Promise<string | void> {
  // Sin Google configurado no es un error: se anota y el panel no se llena
  // de alertas.
  if (!calendarioConfigurado()) return 'OMITIDO: Google Calendar sin configurar';
  // Los trabajos por taller de v1 ya no se crean (ver calendario_por_sesion).
  if (job.entity_type !== 'session') return 'OMITIDO: sincronización por taller de v1; ahora es por sesión';

  const { data, error } = await db.rpc('resumen_sesion', { p_session_id: job.entity_id });
  if (error) throw error;
  if (!data) throw new Error(`Sesión ${job.entity_id} no encontrada`);

  const s = data as ResumenSesion;
  const eventId = await sincronizarSesion(s);

  // Si el evento se había borrado en Google y se recreó, el id nuevo tiene
  // que quedar registrado.
  if (eventId && eventId !== s.google_calendar_event_id) {
    await db.rpc('guardar_evento_sesion', { p_session_id: job.entity_id, p_event_id: eventId });
  }
}

async function mandarCorreo(job: Job): Promise<void> {
  const plantilla = String(job.payload.template ?? '');

  // Avisos de prospecto: no cuelgan de una reserva.
  if (plantilla === 'admin_lead') {
    if (!ADMIN_EMAIL) throw new Error('Falta ADMIN_NOTIFICATION_EMAIL');
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
      // Sin correo configurado el trabajo falla a propósito: queda en las
      // alertas del panel hasta que se configure y se reintente.
      if (!ADMIN_EMAIL) throw new Error('Falta ADMIN_NOTIFICATION_EMAIL');
      await enviar(avisoAdminReserva(r, ADMIN_EMAIL, APP_URL));
      return;

    case 'cancelacion':
      await enviar(cancelacion(r, job.payload.motivo as string | undefined));
      return;

    default:
      throw new Error(`Plantilla desconocida: ${plantilla}`);
  }
}

const OMITIDO_WHATSAPP = 'OMITIDO: WhatsApp Business sin configurar';

async function mandarWhatsApp(job: Job): Promise<string | void> {
  const { data, error } = await db.rpc('datos_reserva', { p_reservation_id: job.entity_id });
  if (error) throw error;
  if (!data) throw new Error(`Reserva ${job.entity_id} no encontrada`);
  const resultado = await avisarReservaPorWhatsApp(data as DatosReserva);
  if (!resultado) {
    console.info(`[process-jobs/whatsapp] omitido: WhatsApp Business sin configurar (${job.entity_id})`);
    return OMITIDO_WHATSAPP;
  }
  if (resultado.fallidos.length) return `PARCIAL: no llegó a ${resultado.fallidos.join(', ')}`;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Se declara para que falte temprano y con mensaje claro si no está cargada.
env('SUPABASE_URL');
