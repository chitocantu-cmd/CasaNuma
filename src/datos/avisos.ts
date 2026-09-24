import { siteConfig } from '../config/site';
import { MESES, fechaCompleta, hora, partes } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import type { Aviso, Reserva } from './tipos';

// ===========================================================================
// Avisos de una reserva confirmada
// ---------------------------------------------------------------------------
// Qué se le avisa a quién. Es la misma información que mandan las plantillas
// del backend (supabase/functions/_shared/emails.ts); la demo solo la guarda
// en una bandeja en vez de enviarla.
//
// Canales:
//   · email al equipo      → ADMIN_NOTIFICATION_EMAIL (obligatorio)
//   · email a la clienta   → correo de la reserva (obligatorio)
//   · WhatsApp al equipo   → preparado para una API oficial (WhatsApp Business
//                            / Twilio). No es un enlace wa.me: se conecta en
//                            el servidor cuando exista el proveedor.
// ===========================================================================

function fechaCorta(iso: string) {
  const [, m, d] = partes(iso);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1].slice(0, 3).replace(/^./, (c) => c.toUpperCase())}`;
}

function fechaConAnio(iso: string) {
  const [a, m, d] = partes(iso);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${a}`;
}

function cuando(r: Reserva): string[] {
  if (r.sesiones.length === 1) {
    const s = r.sesiones[0];
    return [`Fecha: ${fechaConAnio(s.fecha)}`, `Hora: ${hora(s.inicio)}`];
  }
  return ['Clases:', ...r.sesiones.map((s, i) => `  ${i + 1}. ${fechaCompleta(s.fecha)} · ${hora(s.inicio)}`)];
}

function personas(r: Reserva): string[] {
  if (r.ninos?.length) {
    return [
      `Mamá, papá o tutor: ${r.contacto.nombre}`,
      `Niños: ${r.ninos.map((n) => `${n.nombre} (${n.edad} años)`).join(', ')}`,
    ];
  }
  return [`Participantes: ${r.participantes}`];
}

export function avisosReservaConfirmada(r: Reserva, id: () => string): Aviso[] {
  const ahora = new Date().toISOString();
  const primera = r.sesiones[0];
  const correoEquipo = siteConfig.correoAvisosEquipo || null;

  const equipo: Aviso = {
    id: id(),
    canal: 'email',
    destinatario: 'equipo',
    para: correoEquipo,
    asunto: `Nueva reserva Casa Numa — ${r.titulo}${primera ? ` — ${fechaCorta(primera.fecha)}` : ''}`,
    lineas: [
      'Nueva reservación confirmada.',
      '',
      `Cliente: ${r.contacto.nombre}`,
      `Teléfono: ${r.contacto.telefono}`,
      `Correo: ${r.contacto.email}`,
      '',
      `Experiencia: ${r.titulo}`,
      ...cuando(r),
      ...personas(r),
      '',
      `Total: ${pesosCortos(r.total)}`,
      `Estado: ${r.pago === 'pagado' ? 'PAGADO' : 'PAGO PENDIENTE'}`,
      `Folio: ${r.folio ?? '—'}`,
    ],
    enlace: { texto: 'Ver reservación', ruta: `/admin/reservas/${r.id}` },
    reservaId: r.id,
    estado: correoEquipo ? 'enviado' : 'sin_destinatario',
    creadoEn: ahora,
  };

  const cliente: Aviso = {
    id: id(),
    canal: 'email',
    destinatario: 'cliente',
    para: r.contacto.email || null,
    asunto: `Tu lugar en Casa Numa está reservado — ${r.folio ?? r.titulo}`,
    lineas: [
      `Hola, ${r.contacto.nombre.split(' ')[0]}.`,
      '',
      '¡Tu lugar está reservado!',
      '',
      `Número de reserva: ${r.folio ?? '—'}`,
      r.titulo,
      ...(r.sesiones.length === 1
        ? [`${fechaCompleta(primera.fecha).replace(/^./, (c) => c.toUpperCase())} · ${hora(primera.inicio)}`]
        : r.sesiones.map((s, i) => `Clase ${i + 1}: ${fechaCompleta(s.fecha)} · ${hora(s.inicio)}`)),
      r.ninos?.length ? `Niños: ${r.ninos.map((n) => n.nombre).join(', ')}` : `${r.participantes} ${r.participantes === 1 ? 'participante' : 'participantes'}`,
      `Total: ${pesosCortos(r.total)}`,
      '',
      `Te esperamos en ${siteConfig.direccion ? `${siteConfig.direccion}, ` : ''}${siteConfig.zona}.`,
    ],
    enlace: { texto: 'Ver mis reservas', ruta: '/cuenta' },
    reservaId: r.id,
    estado: r.contacto.email ? 'enviado' : 'sin_destinatario',
    creadoEn: ahora,
  };

  const whatsapp: Aviso = {
    id: id(),
    canal: 'whatsapp',
    destinatario: 'equipo',
    para: null,
    asunto: `Nueva reserva ${r.folio ?? ''} · ${r.titulo}`.trim(),
    lineas: [`${r.contacto.nombre} · ${r.participantes} · ${pesosCortos(r.total)}`],
    enlace: { texto: 'Ver reservación', ruta: `/admin/reservas/${r.id}` },
    reservaId: r.id,
    estado: 'pendiente_integracion',
    creadoEn: ahora,
  };

  return [equipo, cliente, whatsapp];
}

/** Solo la confirmación a la clienta (reservas que registra el equipo). */
export function avisoClienteManual(r: Reserva, id: () => string): Aviso[] {
  return avisosReservaConfirmada(r, id).filter((a) => a.destinatario === 'cliente');
}
