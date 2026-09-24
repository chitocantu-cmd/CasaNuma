import type { EstadoReserva } from '../tipos';
import type { Reserva } from '../datos/tipos';

const ZONA = 'America/Monterrey';

/**
 * El demo generaba `DTSTART:20260912T110000`, sin `Z` ni `TZID`.
 *
 * Eso es una hora "flotante": cada dispositivo la interpreta en SU propia zona
 * horaria. Una clienta con el teléfono en otro huso —de viaje, o mal
 * configurado— veía la hora equivocada y podía llegar tarde al taller.
 *
 * Aquí la zona se declara explícitamente con un bloque VTIMEZONE. México
 * eliminó el horario de verano en 2022, así que America/Monterrey es UTC-6
 * fijo; aun así se declara en vez de sumar el offset a mano, para que siga
 * siendo correcto si las reglas cambian.
 */
function marcaLocal(fecha: string, hora: string): string {
  const [a, m, d] = fecha.split('-');
  const [hh, mm] = hora.split(':');
  return `${a}${m}${d}T${hh}${mm}00`;
}

function ahoraUTC(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapa los caracteres que iCalendar trata como especiales. */
function esc(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

interface EventoIcs {
  uid: string;
  fecha: string;
  inicio: string;
  /** Sin hora de término, el evento se publica solo con su inicio. */
  fin: string | null;
  titulo: string;
  lugar: string;
  descripcion: string;
}

/** Un archivo, N eventos: la membresía son cuatro clases en un solo .ics. */
function construirIcsEventos(eventos: EventoIcs[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Casa Numa//Reservaciones//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Sin este bloque, TZID no significa nada para muchos clientes de correo.
    'BEGIN:VTIMEZONE',
    `TZID:${ZONA}`,
    'BEGIN:STANDARD',
    'DTSTART:20221030T020000',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...eventos.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}@casanuma`,
      `DTSTAMP:${ahoraUTC()}`,
      `DTSTART;TZID=${ZONA}:${marcaLocal(e.fecha, e.inicio)}`,
      ...(e.fin ? [`DTEND;TZID=${ZONA}:${marcaLocal(e.fecha, e.fin)}`] : []),
      `SUMMARY:${esc(e.titulo)}`,
      `LOCATION:${esc(e.lugar)}`,
      `DESCRIPTION:${esc(e.descripcion)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Tu clase en Casa Numa es en 2 horas',
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].join('\r\n');
}

export function construirIcs(r: EstadoReserva): string {
  const personas = `${r.quantity} ${r.quantity === 1 ? 'persona' : 'personas'}`;
  return construirIcsEventos([{
    uid: r.reservation_code,
    fecha: r.workshop.date,
    inicio: r.workshop.start_time,
    fin: r.workshop.end_time,
    titulo: `Casa Numa — ${r.workshop.title}`,
    lugar: r.workshop.location ?? 'Casa Numa',
    descripcion: `Tu reservación en Casa Numa está confirmada.\nReservación ${r.reservation_code}\n${personas}`,
  }]);
}

function descargar(contenido: string, nombre: string) {
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Reserva del sitio rediseñado: una o varias sesiones. */
export function descargarIcsReserva(r: Reserva, lugar: string): void {
  const eventos = r.sesiones.map((s, i) => ({
    uid: `${r.codigo}-${i + 1}`,
    fecha: s.fecha,
    inicio: s.inicio,
    fin: s.fin,
    titulo: r.sesiones.length > 1 ? `Casa Numa — ${r.titulo} (${i + 1}/${r.sesiones.length})` : `Casa Numa — ${r.titulo}`,
    lugar,
    descripcion: `Reservación ${r.codigo}`,
  }));
  descargar(construirIcsEventos(eventos), `casa-numa-${r.codigo.toLowerCase()}.ics`);
}

export function descargarIcs(r: EstadoReserva): void {
  descargar(construirIcs(r), `casa-numa-${r.workshop.slug}.ics`);
}

/** Alternativa para quien usa Google Calendar en el navegador. */
export function enlaceGoogleCalendar(r: EstadoReserva): string {
  const aUtc = (hora: string) => {
    const [a, m, d] = r.workshop.date.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    return new Date(Date.UTC(a, m - 1, d, hh + 6, mm))
      .toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Casa Numa — ${r.workshop.title}`,
    dates: `${aUtc(r.workshop.start_time)}/${aUtc(r.workshop.end_time)}`,
    details: `Reservación ${r.reservation_code}`,
    location: r.workshop.location ?? 'Casa Numa',
    ctz: ZONA,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
