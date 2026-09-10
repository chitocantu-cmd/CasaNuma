// ===========================================================================
// Casa Numa · create-reservation
// ---------------------------------------------------------------------------
// Crea la reserva temporal (hold) llamando a la RPC transaccional.
//
// EL PRECIO NUNCA VIENE DEL CLIENTE. El cuerpo de la petición solo acepta
// slug, cantidad y datos de contacto. El monto lo lee crear_reserva() desde la
// tabla workshops, dentro de la misma transacción que valida el cupo. No
// existe ningún campo por donde un precio manipulado pueda entrar.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, traducirError, logError } from '../_shared/clients.ts';

// Duración del hold. Configurable por variable de entorno.
const HOLD_MINUTOS = Number(Deno.env.get('HOLD_MINUTES') ?? '10');

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400, origin);
  }

  const slug = String(body.slug ?? '').trim();
  const quantity = Number(body.quantity);

  // Validación de forma. La validación real —correo, teléfono, cupo, precio,
  // fecha— la hace la función de PostgreSQL: es la única que no se puede saltar.
  if (!slug) {
    return json({ error: 'INVALID_INPUT', message: 'Falta el taller.' }, 400, origin);
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return json({ error: 'INVALID_INPUT', message: 'Cantidad inválida.' }, 400, origin);
  }

  // Límite por IP: evita que alguien agote el cupo creando holds en masa.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
  const { data: permitido } = await db.rpc('permitir', {
    p_clave: `reserva:${ip}`, p_maximo: 10, p_minutos: 10,
  });
  if (permitido === false) {
    return json(
      { error: 'TOO_MANY_REQUESTS', message: 'Espera unos minutos antes de volver a intentar.' },
      429, origin,
    );
  }

  const { data, error } = await db.rpc('crear_reserva', {
    p_slug: slug,
    p_quantity: quantity,
    p_full_name: String(body.full_name ?? ''),
    p_email: String(body.email ?? ''),
    p_phone: String(body.phone ?? ''),
    p_companions: body.companions ? String(body.companions) : null,
    p_notes: body.notes ? String(body.notes) : null,
    p_hold_minutos: HOLD_MINUTOS,
  });

  if (error) {
    const traducido = traducirError(error);
    if (traducido) return json(traducido.body, traducido.status, origin);
    logError('create-reservation', error);
    return json({ error: 'INTERNAL_ERROR', message: 'No pudimos crear tu reserva.' }, 500, origin);
  }

  return json(data, 200, origin);
});
