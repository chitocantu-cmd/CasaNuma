// ===========================================================================
// Casa Numa · reservation-status
// ---------------------------------------------------------------------------
// Alimenta la pantalla de "Estamos confirmando tu pago".
//
// Además de consultar, hace de RED DE SEGURIDAD: si el webhook se atrasó o se
// perdió, esta función le pregunta a Stripe directamente por la sesión y, si
// dice pagada, ejecuta la MISMA lógica de confirmación.
//
// Como confirmar_pago() es idempotente, el webhook y esta consulta pueden
// competir sin riesgo: el que llegue primero confirma, el otro recibe
// 'already_confirmed' y no hace nada.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, getStripe, logError } from '../_shared/clients.ts';

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  let code: string, email: string;
  try {
    const body = await req.json();
    code = String(body.reservation_code ?? '').trim();
    email = String(body.email ?? '').trim();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400, origin);
  }

  if (!code || !email) {
    return json({ error: 'INVALID_INPUT', message: 'Falta el código o el correo.' }, 400, origin);
  }

  // Límite por IP: sin esto alguien podría probar códigos en masa.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
  const { data: permitido } = await db.rpc('permitir', {
    p_clave: `status:${ip}`, p_maximo: 90, p_minutos: 10,
  });
  if (permitido === false) {
    return json({ error: 'TOO_MANY_REQUESTS' }, 429, origin);
  }

  const { data, error } = await db.rpc('consultar_reserva', {
    p_code: code, p_email: email,
  });

  if (error) {
    logError('reservation-status/rpc', error);
    return json({ error: 'INTERNAL_ERROR' }, 500, origin);
  }
  if (!data) {
    // Nunca se distingue entre código malo y correo malo: sería una pista.
    return json({ error: 'RESERVATION_NOT_FOUND' }, 404, origin);
  }

  // -------------------------------------------------------------------------
  // Red de seguridad: sigue pendiente, pero quizá Stripe ya cobró.
  // -------------------------------------------------------------------------
  if (data.status === 'pending_payment') {
    try {
      if (await intentarConfirmar(code)) {
        const { data: fresco } = await db.rpc('consultar_reserva', {
          p_code: code, p_email: email,
        });
        if (fresco) return json(fresco, 200, origin);
      }
    } catch (e) {
      // Si falla, no se rompe la consulta: el webhook sigue siendo la vía
      // principal y esto es solo un respaldo.
      logError('reservation-status/respaldo', e);
    }
  }

  return json(data, 200, origin);
});

/**
 * Busca la sesión de pago de ESTA reserva en Stripe. Si está pagada, confirma.
 * Devuelve true si el estado cambió.
 */
async function intentarConfirmar(code: string): Promise<boolean> {
  // El filtro por código es indispensable: sin él esta consulta podría tomar
  // el pago pendiente de OTRA persona y confirmar la reserva equivocada.
  const { data: pago } = await db
    .from('payments')
    .select('reservation_id, stripe_checkout_session_id, reservations!inner(reservation_code)')
    .eq('reservations.reservation_code', code.toUpperCase())
    .eq('status', 'pending')
    .not('stripe_checkout_session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pago?.stripe_checkout_session_id) return false;

  const s = await getStripe().checkout.sessions.retrieve(pago.stripe_checkout_session_id);
  if (s.metadata?.reservation_code !== code.toUpperCase()) return false;
  if (s.payment_status !== 'paid') return false;

  const intentId = typeof s.payment_intent === 'string'
    ? s.payment_intent
    : s.payment_intent?.id ?? null;

  const { data: resultado } = await db.rpc('confirmar_pago', {
    p_reservation_id: pago.reservation_id,
    p_session_id: s.id,
    p_intent_id: intentId,
    p_amount: Number(s.amount_total ?? 0) / 100,
    p_currency: String(s.currency ?? 'mxn').toUpperCase(),
    p_provider_status: String(s.payment_status),
  });

  return resultado === 'confirmed';
}
