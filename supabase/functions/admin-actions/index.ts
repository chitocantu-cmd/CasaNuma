// ===========================================================================
// Casa Numa · admin-actions
// ---------------------------------------------------------------------------
// Acciones administrativas que no pueden ser un simple UPDATE desde el
// navegador, porque implican reglas de negocio, bitácora y efectos en cola:
//
//   · cancel_reservation        — libera cupo, avisa al cliente, actualiza Calendar
//   · register_payment          — pago recibido por transferencia o efectivo
//   · update_reservation        — completada / no asistió / notas internas
//   · create_manual_reservation — reserva que registra el equipo (y su pago)
//   · mark_refunded             — reembolso hecho fuera (Stripe, transferencia)
//   · set_capacity              — cupo de una sesión (nunca menor a lo reservado)
//   · sync_calendar             — sincroniza una sesión, o toda la agenda próxima
//   · retry_job                 — reintenta un trabajo que quedó en 'failed'
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
      // Registrar un pago recibido (transferencia, efectivo…)
      // ---------------------------------------------------------------------
      // Confirma la reserva, le pone folio si no tenía y encola los avisos.
      // Si el apartado ya había vencido, la base vuelve a medir el cupo.
      // ---------------------------------------------------------------------
      case 'register_payment': {
        const id = String(body.reservation_id ?? '');
        const monto = Number(body.amount);
        if (!id || !Number.isFinite(monto)) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { data, error } = await db.rpc('registrar_pago_manual', {
          p_reservation_id: id,
          p_amount: monto,
          // Sin método: se conserva el que se capturó al registrar la reserva.
          p_method: body.method ? String(body.method) : null,
          p_reference: body.reference ? String(body.reference) : null,
          p_avisar_cliente: body.notify_client !== false,
          p_actor: admin.email || admin.userId,
        });
        if (error) throw error;
        return json({ ok: true, result: data }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Completada / no asistió / notas internas
      // ---------------------------------------------------------------------
      case 'update_reservation': {
        const id = String(body.reservation_id ?? '');
        if (!id) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { data, error } = await db.rpc('admin_actualizar_reserva', {
          p_reservation_id: id,
          p_status: body.status ? String(body.status) : null,
          p_internal_notes: typeof body.internal_notes === 'string' ? body.internal_notes : null,
          p_actor: admin.email || admin.userId,
        });
        if (error) throw error;
        return json({ ok: true, reservation: data }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Reserva registrada por el equipo
      // ---------------------------------------------------------------------
      // Mismo control de cupo que la web; el importe lo captura el equipo
      // (talleres "Info DM", precios especiales). Folio desde que se crea;
      // aparta hasta la hora de la clase.
      // ---------------------------------------------------------------------
      case 'create_manual_reservation': {
        const ninos = Array.isArray(body.children)
          ? (body.children as Record<string, unknown>[]).map((n) => ({ name: String(n?.name ?? ''), age: Number(n?.age) }))
          : [];

        const { data: r, error } = await db.rpc('crear_reserva_panel', {
          p_session_id: String(body.session_id ?? ''),
          p_quantity: Number(body.quantity),
          p_full_name: String(body.full_name ?? ''),
          p_email: String(body.email ?? ''),
          p_phone: String(body.phone ?? ''),
          p_total: Number(body.total),
          p_method: String(body.method ?? 'transferencia'),
          p_reference: body.reference ? String(body.reference) : null,
          p_children: ninos,
          p_notes: body.notes ? String(body.notes) : null,
        });
        if (error) throw error;

        if (typeof body.internal_notes === 'string' && body.internal_notes.trim()) {
          await db.rpc('admin_actualizar_reserva', {
            p_reservation_id: r.reservation_id,
            p_internal_notes: body.internal_notes,
            p_actor: admin.email || admin.userId,
          });
        }
        if (body.paid === true) {
          const { error: e2 } = await db.rpc('registrar_pago_manual', {
            p_reservation_id: r.reservation_id,
            p_amount: Number(r.total_amount),
            p_method: null,
            p_avisar_cliente: body.notify_client !== false,
            p_actor: admin.email || admin.userId,
          });
          if (e2) throw e2;
        }
        return json({ ok: true, reservation: r }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Reembolso hecho fuera del sitio (Stripe, transferencia)
      // ---------------------------------------------------------------------
      case 'mark_refunded': {
        const id = String(body.reservation_id ?? '');
        if (!id) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { data, error } = await db.rpc('admin_marcar_reembolso', {
          p_reservation_id: id,
          p_actor: admin.email || admin.userId,
        });
        if (error) throw error;
        return json({ ok: true, result: data }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Cupo de una sesión (null = sin confirmar, "Cupo limitado")
      // ---------------------------------------------------------------------
      case 'set_capacity': {
        const id = String(body.session_id ?? '');
        const cupo = body.capacity === null || body.capacity === '' ? null : Number(body.capacity);
        if (!id || (cupo !== null && !Number.isInteger(cupo))) return json({ error: 'INVALID_INPUT' }, 400, origin);

        const { data, error } = await db.rpc('admin_ajustar_cupo', {
          p_session_id: id,
          p_capacity: cupo,
          p_actor: admin.email || admin.userId,
        });
        if (error) throw error;
        return json({ ok: true, session: data }, 200, origin);
      }

      // ---------------------------------------------------------------------
      // Forzar sincronización con Google Calendar
      // ---------------------------------------------------------------------
      // Se encola en vez de llamar a Google aquí: si Google tarda, el panel no
      // se queda colgado, y el reintento ya está resuelto por el worker.
      // ---------------------------------------------------------------------
      case 'sync_calendar': {
        // Una sesión (session_id) o, sin id, toda la agenda próxima. Se
        // encola en vez de llamar a Google aquí: si Google tarda, el panel no
        // se queda colgado, y los reintentos los resuelve el worker.
        const { data, error } = await db.rpc('encolar_calendario', {
          p_session_id: body.session_id ? String(body.session_id) : null,
        });
        if (error) throw error;
        return json({ ok: true, queued: data }, 200, origin);
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
