// ===========================================================================
// Casa Numa · admin-actions
// ---------------------------------------------------------------------------
// Acciones administrativas que no pueden ser un simple UPDATE desde el
// navegador, porque implican reglas de negocio, bitácora y efectos en cola:
//
//   · cancel_reservation  — libera cupo, avisa al cliente, actualiza Calendar
//   · sync_calendar       — fuerza la sincronización de un taller
//   · retry_job           — reintenta un trabajo que quedó en 'failed'
//
// Todas verifican en el SERVIDOR que quien llama sea admin. Ocultar un botón
// en React no es seguridad: cualquiera puede llamar al endpoint directamente.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, traducirError, logError } from '../_shared/clients.ts';
import { adminDe } from '../_shared/admin.ts';

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  const admin = await adminDe(req);
  if (!admin) {
    return json({ error: 'FORBIDDEN', message: 'No tienes permiso para esta acción.' }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400, origin);
  }

  const accion = String(body.action ?? '');

  try {
    switch (accion) {
      // ---------------------------------------------------------------------
      // Cancelar reservación
      // ---------------------------------------------------------------------
      // El cupo se libera solo: la fórmula de disponibilidad deja de contar
      // las canceladas. No hay ningún contador que ajustar.
      //
      // NO hace reembolso en Stripe. El panel lo advierte explícitamente.
      // ---------------------------------------------------------------------
      case 'cancel_reservation': {
        const id = String(body.reservation_id ?? '');
        if (!id) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { data, error } = await db.rpc('cancelar_reserva', {
          p_reservation_id: id,
          p_motivo: body.reason ? String(body.reason) : null,
          p_actor: admin.email || admin.userId,
        });
        if (error) throw error;
        return json({ ok: true, result: data }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Forzar sincronización con Google Calendar
      // ---------------------------------------------------------------------
      // Se encola en vez de llamar a Google aquí: si Google tarda, el panel no
      // se queda colgado, y el reintento ya está resuelto por el worker.
      // ---------------------------------------------------------------------
      case 'sync_calendar': {
        const id = String(body.workshop_id ?? '');
        if (!id) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { error } = await db.from('integration_jobs').insert({
          type: 'calendar_sync',
          entity_type: 'workshop',
          entity_id: id,
          dedupe_key: `calendar:${id}`,
        });
        // Un choque contra el índice único significa que ya hay una
        // sincronización pendiente para ese taller: no es un error.
        if (error && !error.message.includes('duplicate')) throw error;

        return json({ ok: true, queued: true }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Reintentar un trabajo fallido
      // ---------------------------------------------------------------------
      case 'retry_job': {
        const id = String(body.job_id ?? '');
        if (!id) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { error } = await db
          .from('integration_jobs')
          .update({ status: 'pending', attempts: 0, next_retry_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;

        return json({ ok: true }, 200, origin);
      }

      default:
        return json({ error: 'UNKNOWN_ACTION' }, 400, origin);
    }
  } catch (e) {
    const err = e as { code?: string; details?: string; hint?: string };
    const traducido = traducirError(err);
    if (traducido) return json(traducido.body, traducido.status, origin);

    logError(`admin-actions/${accion}`, e);
    return json({ error: 'INTERNAL_ERROR', message: 'No pudimos completar la acción.' }, 500, origin);
  }
});
