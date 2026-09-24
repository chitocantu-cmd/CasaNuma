// ===========================================================================
// Casa Numa · create-checkout-session
// ---------------------------------------------------------------------------
// Recibe SOLO un reservation_id. Todo lo demás —precio, cantidad, moneda— se
// lee de la base de datos.
//
// Aunque alguien manipule React o DevTools y mande un total distinto, no hay
// ningún parámetro de monto en esta API: Stripe cobra el precio que calculó
// la base al apartar (sesión o plan de membresía) × lugares.
//
// Se usa Stripe Checkout (página alojada), no Elements ni formulario propio:
// los datos de tarjeta nunca tocan este código, lo que mantiene a Casa Numa
// fuera del alcance completo de PCI-DSS.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, getStripe, traducirError, logError, APP_URL } from '../_shared/clients.ts';
import { fechaCorta } from '../_shared/emails.ts';

// Stripe exige que expires_at esté al menos a 30 minutos. El hold dura menos
// (10 por omisión), así que el webhook revalida el cupo antes de confirmar.
// Ver confirmar_pago() y la nota sobre 'needs_review'.
const SESION_MINUTOS = 31;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  let reservationId: string;
  try {
    const body = await req.json();
    reservationId = String(body.reservation_id ?? '');
  } catch {
    return json({ error: 'INVALID_JSON' }, 400, origin);
  }
  if (!reservationId) {
    return json({ error: 'INVALID_INPUT', message: 'Falta reservation_id.' }, 400, origin);
  }

  // ---------------------------------------------------------------------
  // Valida que la reserva exista, siga pending_payment y no haya expirado.
  // Devuelve el precio, el nombre y las fechas desde la base.
  // ---------------------------------------------------------------------
  const { data: r, error } = await db.rpc('reserva_para_pago', {
    p_reservation_id: reservationId,
  });

  if (error) {
    const traducido = traducirError(error);
    if (traducido) return json(traducido.body, traducido.status, origin);
    logError('create-checkout-session/rpc', error);
    return json({ error: 'INTERNAL_ERROR' }, 500, origin);
  }

  const successUrl = Deno.env.get('STRIPE_SUCCESS_URL')
    ?? `${APP_URL}/pago/exitoso?code={CHECKOUT_SESSION_ID}`;
  const cancelUrl = Deno.env.get('STRIPE_CANCEL_URL')
    ?? `${APP_URL}/pago/cancelado`;

  try {
    // Stripe trabaja en la unidad mínima de la moneda. Ésta es la ÚNICA
    // conversión a centavos de todo el sistema; la base guarda numeric(10,2)
    // exacto y aquí se redondea una sola vez.
    const unitAmountCents = Math.round(Number(r.unit_price) * 100);

    // "sáb 3 oct · 11:00" — una línea por clase en la membresía.
    const sesiones = (r.sessions ?? []) as { date: string; start_time: string }[];
    const fechas = sesiones.length
      ? sesiones.map((x) => `${fechaCorta(x.date)} · ${String(x.start_time).slice(0, 5)} h`).join(', ')
      : `${r.workshop_date} · ${String(r.workshop_start).slice(0, 5)} h`;

    // Stripe rechaza metadatos nulos: solo va lo que existe.
    const metadata: Record<string, string> = {
      reservation_id: r.reservation_id,
      reservation_code: r.reservation_code,
      experience_type: r.experience_type ?? 'taller',
    };
    if (r.workshop_id) metadata.workshop_id = r.workshop_id;

    const sesion = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: r.customer_email ?? undefined,
        expires_at: Math.floor(Date.now() / 1000) + SESION_MINUTOS * 60,
        line_items: [{
          quantity: r.quantity,
          price_data: {
            currency: String(r.currency ?? 'MXN').toLowerCase(),
            unit_amount: unitAmountCents,
            product_data: {
              name: r.workshop_title,
              description: fechas,
            },
          },
        }],
        // Los metadatos son el hilo que amarra el pago con la reserva cuando
        // el webhook llegue, minutos después y sin el cliente presente.
        metadata,
        payment_intent_data: { metadata },
        success_url: successUrl.replace('{CODE}', r.reservation_code),
        cancel_url: cancelUrl.replace('{CODE}', r.reservation_code),
      },
      {
        // Idempotencia de Stripe: si esta petición se reintenta por un fallo
        // de red, no se crean dos sesiones para la misma reserva.
        idempotencyKey: `checkout-${r.reservation_id}`,
      },
    );

    await db.rpc('guardar_checkout_session', {
      p_reservation_id: r.reservation_id,
      p_session_id: sesion.id,
      p_amount: r.total_amount,
      p_currency: r.currency,
    });

    return json(
      {
        checkout_url: sesion.url,
        session_id: sesion.id,
        reservation_code: r.reservation_code,
        total_amount: r.total_amount,
        currency: r.currency,
        expires_at: r.expires_at,
      },
      200, origin,
    );
  } catch (e) {
    logError('create-checkout-session/stripe', e);
    return json(
      { error: 'PAYMENT_UNAVAILABLE', message: 'No pudimos crear tu pago. Intenta de nuevo en un momento.' },
      502, origin,
    );
  }
});
