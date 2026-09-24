// ---------------------------------------------------------------------------
// Aviso al equipo por WhatsApp — API oficial (WhatsApp Business Cloud, Meta)
// ---------------------------------------------------------------------------
// NO es un enlace wa.me: esto lo manda el servidor, sin que nadie abra nada.
//
// Meta exige una PLANTILLA aprobada para los mensajes que inicia el negocio.
// Plantilla sugerida (categoría "Utility", idioma es_MX), 6 variables:
//
//   Nueva reserva Casa Numa
//   {{1}} — {{2}}
//   {{3}} · {{4}} personas
//   Total {{5}} · Folio {{6}}
//
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN            token permanente del usuario del sistema
//   WHATSAPP_PHONE_NUMBER_ID  id del número emisor (no el número)
//   WHATSAPP_ADMIN_TO         número del equipo en formato 52XXXXXXXXXX
//   WHATSAPP_TEMPLATE         nombre de la plantilla aprobada
//   WHATSAPP_TEMPLATE_LANG    opcional, por omisión es_MX
//
// Mientras falte cualquiera de las cuatro primeras, el aviso se OMITE (el
// trabajo se marca hecho con nota) en vez de fallar cinco veces y ensuciar
// las alertas del panel. El correo al equipo sigue saliendo.
// ---------------------------------------------------------------------------

import { fechaCorta, hora12, pesos, type DatosReserva } from './emails.ts';

const API = 'https://graph.facebook.com/v21.0';

function config() {
  const token = Deno.env.get('WHATSAPP_TOKEN') ?? '';
  const numeroId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
  const para = (Deno.env.get('WHATSAPP_ADMIN_TO') ?? '').replace(/\D/g, '');
  const plantilla = Deno.env.get('WHATSAPP_TEMPLATE') ?? '';
  const idioma = Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'es_MX';
  return token && numeroId && para && plantilla ? { token, numeroId, para, plantilla, idioma } : null;
}

export function whatsappConfigurado(): boolean {
  return config() !== null;
}

/** Devuelve false si no está configurado (se omite sin error). */
export async function avisarReservaPorWhatsApp(r: DatosReserva): Promise<boolean> {
  const c = config();
  if (!c) return false;

  const primera = r.sessions?.[0] ?? { date: r.workshop.date, start_time: r.workshop.start_time };
  const variables = [
    r.workshop.title,
    `${fechaCorta(primera.date)} ${hora12(primera.start_time)}`,
    r.customer.full_name,
    String(r.quantity),
    pesos(r.total_amount, r.currency),
    r.folio ?? r.reservation_code,
  ];

  const res = await fetch(`${API}/${c.numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: c.para,
      type: 'template',
      template: {
        name: c.plantilla,
        language: { code: c.idioma },
        components: [{ type: 'body', parameters: variables.map((text) => ({ type: 'text', text })) }],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return true;
}
