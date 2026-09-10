// ===========================================================================
// Casa Numa · stripe-webhook
// ---------------------------------------------------------------------------
// La ÚNICA vía por la que una reserva llega a 'confirmed'.
//
// Que el cliente regrese a /pago/exitoso no prueba nada: esa URL se puede
// escribir a mano. El dinero solo se da por recibido cuando Stripe nos lo dice
// directamente y podemos verificar la firma.
//
// CONFIGURACIÓN OBLIGATORIA: esta función necesita `verify_jwt = false` en
// config.toml. Stripe no manda un JWT de Supabase, así que con la verificación
// activada TODOS los webhooks devolverían 401 y ningún pago se confirmaría
// jamás — y el síntoma en el panel de Stripe es solo "endpoint fallando".
// A cambio, la firma HMAC es la única defensa: por eso se verifica antes de
// leer nada del cuerpo.
// ===========================================================================

import { db, getStripe, cryptoProvider, env, logError } from '../_shared/clients.ts';

const SECRETO = env('STRIPE_WEBHOOK_SECRET', false);

Deno.serve(async (req: Request) => {
  // -------------------------------------------------------------------------
  // 1. Verificación de firma
  // -------------------------------------------------------------------------
  // Se usa el CUERPO CRUDO, sin parsear. Éste es el error clásico: si haces
  // await req.json() y vuelves a serializar, un solo espacio de diferencia
  // rompe el HMAC y la firma no coincide nunca.
  //
  // constructEventAsync también rechaza eventos de más de 5 minutos, lo que
  // impide que alguien capture una petición legítima y la reenvíe después.
  // -------------------------------------------------------------------------
  const cuerpoCrudo = await req.text();
  const firma = req.headers.get('stripe-signature');

  if (!firma || !SECRETO) {
    return new Response('Falta firma o secreto', { status: 400 });
  }

  let evento: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    evento = await getStripe().webhooks.constructEventAsync(
      cuerpoCrudo, firma, SECRETO, undefined, cryptoProvider,
    ) as typeof evento;
  } catch (e) {
    logError('webhook/firma', e);
    // 400: no reintentar. Si la firma no cuadra, reintentar no va a ayudar.
    return new Response('Firma inválida', { status: 400 });
  }

  // -------------------------------------------------------------------------
  // 2. Idempotencia
  // -------------------------------------------------------------------------
  // La llave primaria de webhook_events es el id del evento de Stripe, así que
  // la base misma garantiza que cada evento se registre una sola vez.
  //
  // SUTILEZA IMPORTANTE: no basta con "ya existe -> saltar". Si el registro se
  // insertó y el procesamiento falló después, Stripe reintenta, y saltarnos el
  // evento por duplicado dejaría el pago sin confirmar PARA SIEMPRE.
  //
  // Por eso solo se salta cuando el evento ya quedó 'processed'. Si está en
  // 'received' o 'failed', se reprocesa: todas las operaciones de abajo son
  // idempotentes, así que repetirlas es seguro.
  // -------------------------------------------------------------------------
  const { data: insertados, error: errRegistro } = await db
    .from('webhook_events')
    .upsert(
      {
        provider_event_id: evento.id,
        provider: 'stripe',
        type: evento.type,
        payload: evento as unknown as Record<string, unknown>,
        status: 'received',
      },
      { onConflict: 'provider_event_id', ignoreDuplicates: true },
    )
    .select('provider_event_id');

  if (errRegistro) {
    logError('webhook/registro', errRegistro);
    return new Response('Error al registrar evento', { status: 500 });
  }

  if (!insertados || insertados.length === 0) {
    const { data: previo } = await db
      .from('webhook_events')
      .select('status')
      .eq('provider_event_id', evento.id)
      .single();

    if (previo?.status === 'processed') {
      return respuesta({ received: true, duplicate: true });
    }
    // Si no, es un reintento de algo que falló: seguir adelante.
  }

  // -------------------------------------------------------------------------
  // 3. Procesamiento
  // -------------------------------------------------------------------------
  try {
    switch (evento.type) {
      case 'checkout.session.completed': {
        const s = evento.data.object as Record<string, unknown>;
        if (s.payment_status !== 'paid') break;

        const meta = (s.metadata ?? {}) as Record<string, string>;
        const reservationId = meta.reservation_id;
        if (!reservationId) {
          logError('webhook/metadata', `sesión ${s.id} sin reservation_id`);
          break;
        }

        const intentId = idDe(s.payment_intent);

        // amount_total viene en centavos; la base guarda numeric(10,2).
        const monto = Number(s.amount_total ?? 0) / 100;

        // Una sola transacción corta: registra el pago, revalida cupo,
        // confirma la reserva y encola los efectos secundarios.
        const { data: resultado, error } = await db.rpc('confirmar_pago', {
          p_reservation_id: reservationId,
          p_session_id: String(s.id),
          p_intent_id: intentId,
          p_amount: monto,
          p_currency: String(s.currency ?? 'mxn').toUpperCase(),
          p_provider_status: String(s.payment_status),
        });
        if (error) throw error;

        if (resultado === 'needs_review') {
          // El pago llegó tras vencer el hold y el cupo ya estaba tomado.
          // El pago quedó registrado y marcado para revisión humana; no se
          // confirma la reserva porque eso sería sobreventa.
          logError('webhook/sin-cupo', `reserva ${reservationId} pagada sin cupo disponible`);
        }
        break;
      }

      case 'checkout.session.expired':
        // Nada que hacer: el hold caduca solo y el lugar ya estaba libre desde
        // el instante del vencimiento.
        break;

      case 'payment_intent.payment_failed': {
        const pi = evento.data.object as Record<string, unknown>;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        if (!meta.reservation_id) break;

        // Deliberadamente NO libera el lugar: el cliente puede reintentar con
        // otra tarjeta sin perder su reserva.
        const err = (pi.last_payment_error ?? {}) as Record<string, string>;
        const { error } = await db.rpc('marcar_pago_fallido', {
          p_reservation_id: meta.reservation_id,
          p_intent_id: String(pi.id),
          p_motivo: err.message ?? 'Pago rechazado',
        });
        if (error) throw error;
        break;
      }

      case 'charge.refunded': {
        // Cubre los reembolsos que Casa Numa hace a mano desde el panel de
        // Stripe. Por eso el panel queda conciliado sin que nadie capture
        // nada: se hace el refund en Stripe y el sistema se entera solo.
        const c = evento.data.object as Record<string, unknown>;
        const intentId = idDe(c.payment_intent);
        if (!intentId) break;

        const { error } = await db.rpc('registrar_reembolso', {
          p_intent_id: intentId,
          p_monto: Number(c.amount_refunded ?? 0) / 100,
        });
        if (error) throw error;
        break;
      }
    }

    await db.from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider_event_id', evento.id);

    return respuesta({ received: true });
  } catch (e) {
    logError(`webhook/${evento.type}`, e);

    await db.from('webhook_events')
      .update({ status: 'failed', error: e instanceof Error ? e.message : String(e) })
      .eq('provider_event_id', evento.id);

    // 500 A PROPÓSITO: le dice a Stripe que reintente, con espaciado creciente
    // durante unos tres días. Un error nuestro se convierte en un reintento,
    // no en un pago perdido.
    //
    // Lo que NUNCA hay que hacer es responder 200 cuando algo salió mal: eso
    // le dice a Stripe "recibido, no reintentes" y ahí sí se pierde el evento.
    return new Response('Error al procesar', { status: 500 });
  }
});

function idDe(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'id' in v) return String((v as { id: string }).id);
  return null;
}

function respuesta(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
