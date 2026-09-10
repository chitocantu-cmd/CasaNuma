import type { EstadoReserva } from '../tipos';

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

export function construirIcs(r: EstadoReserva): string {
  const inicio = marcaLocal(r.workshop.date, r.workshop.start_time);
  const fin = marcaLocal(r.workshop.date, r.workshop.end_time);
  const personas = `${r.quantity} ${r.quantity === 1 ? 'persona' : 'personas'}`;
  const lugar = r.workshop.location ?? 'Casa Numa';

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
    'BEGIN:VEVENT',
    `UID:${r.reservation_code}@casanuma`,
    `DTSTAMP:${ahoraUTC()}`,
    `DTSTART;TZID=${ZONA}:${inicio}`,
    `DTEND;TZID=${ZONA}:${fin}`,
    `SUMMARY:${esc(`Casa Numa — ${r.workshop.title}`)}`,
    `LOCATION:${esc(lugar)}`,
    `DESCRIPTION:${esc(
      `Tu reservación en Casa Numa está confirmada.\nReservación ${r.reservation_code}\n${personas}`,
    )}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tu taller en Casa Numa es en 2 horas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function descargarIcs(r: EstadoReserva): void {
  const blob = new Blob([construirIcs(r)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `casa-numa-${r.workshop.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
