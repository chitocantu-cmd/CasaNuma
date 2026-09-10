// ---------------------------------------------------------------------------
// Google Calendar · agenda administrativa de Casa Numa
// ---------------------------------------------------------------------------
// REGLA: UN EVENTO POR TALLER, no uno por reservación. Un evento por cliente
// convertiría el calendario en ruido ilegible.
//
// El worker RECONSTRUYE la descripción completa desde el estado actual de la
// base cada vez, en vez de aplicar cambios incrementales. Eso lo hace
// idempotente por construcción: ejecutarlo dos veces da el mismo resultado que
// ejecutarlo una, y N pagos seguidos colapsan en una sola llamada a Google.
// ---------------------------------------------------------------------------

import { env } from './clients.ts';

const TZ = Deno.env.get('GOOGLE_TIMEZONE') ?? 'America/Monterrey';

// ---------------------------------------------------------------------------
// Autenticación: refresh token -> access token
// ---------------------------------------------------------------------------
// Los access tokens de Google duran una hora. El refresh token es de larga
// vida y se canjea por uno nuevo cuando hace falta. Todo ocurre en el servidor:
// ningún secreto de Google llega jamás al navegador.
// ---------------------------------------------------------------------------
let cache: { token: string; expira: number } | null = null;

async function accessToken(): Promise<string> {
  if (cache && Date.now() < cache.expira - 60_000) return cache.token;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Google OAuth respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  cache = {
    token: data.access_token,
    expira: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cache.token;
}

async function api(ruta: string, init: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${ruta}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return await res.json();
}

// ---------------------------------------------------------------------------

export interface ResumenTaller {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string | null;
  location: string | null;
  price: number;
  currency: string;
  capacity: number;
  status: string;
  google_calendar_event_id: string | null;
  confirmed: number;
  reservations: { code: string; name: string; quantity: number }[];
}

/** 'HH:MM:SS' -> 'HH:MM:00' con la fecha, en formato local sin offset. */
function marca(fecha: string, hora: string): string {
  return `${fecha}T${hora.slice(0, 5)}:00`;
}

function descripcion(t: ResumenTaller): string {
  const dinero = new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: t.currency || 'MXN', maximumFractionDigits: 0,
  }).format(Number(t.price));

  const lineas = [
    `Precio: ${dinero}`,
    '',
    `Cupo: ${t.confirmed} / ${t.capacity} confirmados`,
    '',
  ];

  if (t.reservations.length) {
    lineas.push('Reservaciones:');
    for (const r of t.reservations) {
      lineas.push(`${r.code} | ${r.name} | ${r.quantity} ${r.quantity === 1 ? 'lugar' : 'lugares'}`);
    }
  } else {
    lineas.push('Sin reservaciones confirmadas todavía.');
  }

  lineas.push('', `Actualizado: ${new Date().toLocaleString('es-MX', { timeZone: TZ })}`);
  return lineas.join('\n');
}

function cuerpoEvento(t: ResumenTaller) {
  const zona = t.timezone || TZ;
  const cancelado = t.status === 'cancelled';

  return {
    summary: cancelado
      ? `CANCELADO | ${t.title}`
      : `CASA NUMA | ${t.title}`,
    description: descripcion(t),
    location: t.location ?? 'Casa Numa',
    start: { dateTime: marca(t.date, t.start_time), timeZone: zona },
    end: { dateTime: marca(t.date, t.end_time), timeZone: zona },
    // NUNCA se agregan los clientes como `attendees`: Google les mandaría
    // invitaciones automáticas y —peor— cada asistente vería el correo de
    // todos los demás. La lista va solo en la descripción.
    status: cancelado ? 'cancelled' : 'confirmed',
  };
}

/**
 * Sincroniza el evento del taller. Crea si no existe, actualiza si ya existe.
 * Devuelve el id del evento para guardarlo en workshops.
 *
 * NUNCA crea un evento nuevo cuando ya hay uno: eso duplicaría la agenda.
 */
export async function sincronizarTaller(t: ResumenTaller): Promise<string> {
  const calendarId = encodeURIComponent(env('GOOGLE_CALENDAR_ID'));
  const cuerpo = cuerpoEvento(t);

  if (t.google_calendar_event_id) {
    try {
      const ev = await api(
        `/calendars/${calendarId}/events/${encodeURIComponent(t.google_calendar_event_id)}`,
        { method: 'PATCH', body: JSON.stringify(cuerpo) },
      );
      return ev.id as string;
    } catch (e) {
      // Si el evento se borró a mano en Google, se recrea en vez de fallar
      // para siempre. Cualquier otro error sí se propaga.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('404') && !msg.includes('410')) throw e;
    }
  }

  const ev = await api(`/calendars/${calendarId}/events`, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
  return ev.id as string;
}
