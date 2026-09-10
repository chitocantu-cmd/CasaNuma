// ---------------------------------------------------------------------------
// Plantillas y envío de correo (Resend)
// ---------------------------------------------------------------------------
// El texto viene del propio demo, donde ya estaba bien redactado; ahí vivía en
// notificationService y solo hacía console.info. Aquí se envía de verdad.
//
// NUNCA se manda el correo de "confirmado" antes de que el pago esté
// verificado: estos trabajos solo se encolan desde confirmar_pago().
// ---------------------------------------------------------------------------

import { env } from './clients.ts';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// OJO: se parsea a mano en vez de usar new Date('2026-09-12').
// El constructor interpreta las fechas ISO sin hora como UTC, y en México
// (UTC-6) eso corre la fecha un día hacia atrás: un taller del sábado 12
// aparecería como viernes 11 en el correo.
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`;
}

export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function pesos(monto: number | string, moneda = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: moneda, maximumFractionDigits: 0,
  }).format(Number(monto));
}

export interface DatosReserva {
  reservation_code: string;
  quantity: number;
  total_amount: string | number;
  currency: string;
  companions?: string | null;
  customer: { full_name: string; email: string; phone: string | null };
  workshop: {
    slug: string; title: string; date: string;
    start_time: string; end_time: string;
    timezone: string | null; location: string | null;
  };
}

export interface DatosLead {
  tipo: 'contacto' | 'membresia';
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  interests: string[];
}

export interface Correo { para: string; asunto: string; html: string; texto: string }

// ---------------------------------------------------------------------------
// Envoltura visual
// ---------------------------------------------------------------------------
// Tabla y estilos en línea a propósito: los clientes de correo (sobre todo
// Outlook y Gmail) ignoran <style> en el head y no soportan flex ni grid.
// Los colores son los de la marca: papel, tinta y terracota.
// ---------------------------------------------------------------------------
function envoltura(contenido: string): string {
  return `<!doctype html>
<html lang="es-MX"><body style="margin:0;padding:0;background:#F5F0E7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E7;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBF9F5;border:1px solid #DDD5C6;">
      <tr><td style="padding:32px 32px 24px;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#C76749;">Casa Numa</td></tr>
      <tr><td style="padding:0 32px 32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#27231F;">${contenido}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function fila(k: string, v: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#8A8177;">${k}</td>
    <td style="padding:6px 0;text-align:right;font-weight:600;">${v}</td>
  </tr>`;
}

const TABLA_INI = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DDD5C6;border-bottom:1px solid #DDD5C6;margin-bottom:24px;">`;

// ---------------------------------------------------------------------------
// Confirmación al cliente
// ---------------------------------------------------------------------------
export function confirmacion(r: DatosReserva, appUrl: string): Correo {
  const lugares = `${r.quantity} ${r.quantity === 1 ? 'lugar' : 'lugares'}`;
  const total = pesos(r.total_amount, r.currency);
  const horario = `${hora12(r.workshop.start_time)} – ${hora12(r.workshop.end_time)}`;

  return {
    para: r.customer.email,
    asunto: 'Tu reservación en Casa Numa está confirmada',
    html: envoltura(`
      <p style="margin:0 0 8px;font-size:19px;font-weight:600;">Hola ${r.customer.full_name},</p>
      <p style="margin:0 0 24px;">Tu reservación está confirmada.</p>
      ${TABLA_INI}
        ${fila('Taller', r.workshop.title)}
        ${fila('Fecha', fechaLarga(r.workshop.date))}
        ${fila('Horario', horario)}
        ${fila('Lugares', lugares)}
        ${fila('Total', total)}
        ${fila('Código', r.reservation_code)}
      </table>
      ${r.workshop.location ? `<p style="margin:0 0 24px;color:#5C554C;">${r.workshop.location}</p>` : ''}
      <p style="margin:0 0 24px;">
        <a href="${appUrl}/reserva/${r.reservation_code}" style="display:inline-block;background:#C76749;color:#FBF9F5;text-decoration:none;padding:12px 24px;font-weight:600;">Agregar a mi calendario</a>
      </p>
      <p style="margin:0;color:#5C554C;">Te esperamos en Casa Numa.</p>
    `),
    texto: [
      `Hola ${r.customer.full_name},`, '',
      'Tu reservación está confirmada.', '',
      r.workshop.title,
      fechaLarga(r.workshop.date),
      horario,
      `${lugares}`, '',
      `Total: ${total}`,
      `Código: ${r.reservation_code}`, '',
      `Agrégalo a tu calendario: ${appUrl}/reserva/${r.reservation_code}`, '',
      'Te esperamos en Casa Numa.',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
export function avisoAdminReserva(r: DatosReserva, para: string): Correo {
  const wa = (r.customer.phone ?? '').replace(/\D/g, '');
  return {
    para,
    asunto: `Nueva reserva · ${r.workshop.title} · ${r.customer.full_name} (${r.quantity})`,
    html: envoltura(`
      <p style="margin:0 0 24px;font-size:19px;font-weight:600;">Nueva reservación pagada</p>
      ${TABLA_INI}
        ${fila('Taller', r.workshop.title)}
        ${fila('Fecha', fechaLarga(r.workshop.date))}
        ${fila('Cliente', r.customer.full_name)}
        ${fila('Lugares', String(r.quantity))}
        ${fila('Total', pesos(r.total_amount, r.currency))}
        ${fila('Código', r.reservation_code)}
      </table>
      ${wa ? `<p style="margin:0;"><a href="https://wa.me/${wa}" style="color:#C76749;">Escribir por WhatsApp</a> &nbsp;·&nbsp; ${r.customer.email}</p>` : `<p style="margin:0;">${r.customer.email}</p>`}
      ${r.companions ? `<p style="margin:16px 0 0;color:#5C554C;">Acompañantes: ${r.companions}</p>` : ''}
    `),
    texto: `Nueva reservación pagada\n\n${r.workshop.title}\n${fechaLarga(r.workshop.date)}\n${r.customer.full_name} — ${r.quantity}\n${pesos(r.total_amount, r.currency)}\n${r.reservation_code}\n${r.customer.email} · ${r.customer.phone ?? ''}`,
  };
}

// ---------------------------------------------------------------------------
export function cancelacion(r: DatosReserva, motivo?: string): Correo {
  return {
    para: r.customer.email,
    asunto: `Casa Numa — tu reservación ${r.reservation_code} quedó cancelada`,
    html: envoltura(`
      <p style="margin:0 0 8px;font-size:19px;font-weight:600;">Hola ${r.customer.full_name},</p>
      <p style="margin:0 0 24px;">Tu reservación para <strong>${r.workshop.title}</strong> del ${fechaLarga(r.workshop.date)} quedó cancelada.</p>
      ${TABLA_INI}
        ${fila('Código', r.reservation_code)}
        ${fila('Lugares', String(r.quantity))}
      </table>
      ${motivo ? `<p style="margin:0 0 24px;color:#5C554C;">${motivo}</p>` : ''}
      <p style="margin:0;">Si quieres cambiar a otra fecha, escríbenos por WhatsApp y te acomodamos.</p>
    `),
    texto: `Hola ${r.customer.full_name},\n\nTu reservación para ${r.workshop.title} del ${fechaLarga(r.workshop.date)} quedó cancelada.\n\nCódigo: ${r.reservation_code}\n${motivo ?? ''}`,
  };
}

// ---------------------------------------------------------------------------
export function avisoLead(l: DatosLead, para: string): Correo {
  const titulo = l.tipo === 'contacto' ? 'Mensaje de contacto' : 'Interés en membresía';
  const wa = (l.phone ?? '').replace(/\D/g, '');
  return {
    para,
    asunto: `${titulo} · ${l.name}`,
    html: envoltura(`
      <p style="margin:0 0 24px;font-size:19px;font-weight:600;">${titulo}</p>
      ${TABLA_INI}
        ${fila('Nombre', l.name)}
        ${fila('Correo', l.email)}
        ${l.phone ? fila('Teléfono', l.phone) : ''}
        ${l.interests?.length ? fila('Le interesa', l.interests.join(', ')) : ''}
      </table>
      ${l.message ? `<p style="margin:0 0 20px;white-space:pre-wrap;">${l.message}</p>` : ''}
      ${wa ? `<p style="margin:0;"><a href="https://wa.me/${wa}" style="color:#C76749;">Responder por WhatsApp</a></p>` : ''}
    `),
    texto: `${titulo}\n\n${l.name}\n${l.email}\n${l.phone ?? ''}\n${(l.interests ?? []).join(', ')}\n\n${l.message ?? ''}`,
  };
}

// ---------------------------------------------------------------------------
export async function enviar(correo: Correo): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env('RESEND_FROM_EMAIL'),
      to: [correo.para],
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }),
  });

  if (!res.ok) {
    // El mensaje incluye el código: un 422 casi siempre significa dominio sin
    // verificar en Resend, y conviene reconocerlo de inmediato en el panel.
    throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
