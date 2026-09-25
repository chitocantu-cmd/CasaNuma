// ---------------------------------------------------------------------------
// Google Calendar · agenda del equipo de Casa Numa
// ---------------------------------------------------------------------------
// REGLA: UN EVENTO POR SESIÓN (cada horario de taller, NUMA Kids o clase de
// membresía), no uno por reservación: un evento por clienta convertiría el
// calendario en ruido ilegible.
//
// El worker RECONSTRUYE el evento completo desde el estado actual de la base
// cada vez (resumen_sesion). Es idempotente por construcción: ejecutarlo dos
// veces da lo mismo que una, y N pagos seguidos colapsan en una sola llamada.
//
// Acceso (Supabase → Edge Functions → Secrets):
//   GOOGLE_CALENDAR_ID        id del calendario (en Google Calendar →
//                             Configuración del calendario → «ID de calendario»)
//   GOOGLE_SERVICE_ACCOUNT    el JSON de la llave de una cuenta de servicio.
//                             El calendario se COMPARTE con su correo
//                             (…@….iam.gserviceaccount.com) con permiso de
//                             «Hacer cambios en los eventos». No caduca.
//   GOOGLE_TIMEZONE           opcional, America/Monterrey por omisión
// Respaldo de v1: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN
// (con la app de OAuth en modo «Prueba», Google invalida el token a los 7 días).
// ---------------------------------------------------------------------------

import { env } from './clients.ts';

const TZ = Deno.env.get('GOOGLE_TIMEZONE') || 'America/Monterrey';
const LUGAR = Deno.env.get('GOOGLE_EVENT_LOCATION') ||
  'Casa NUMA, Los Aldama 345A, Casco de San Pedro, 66200 San Pedro Garza García, N.L.';
/** Si Casa Numa no publicó la hora de término, el evento dura esto. */
const DURACION_SUPUESTA_MIN = 120;

interface CuentaServicio {
  client_email: string;
  private_key: string;
}

function cuentaServicio(): CuentaServicio | null {
  const crudo = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!crudo) return null;
  try {
    const j = JSON.parse(crudo);
    return j.client_email && j.private_key ? j : null;
  } catch {
    return null;
  }
}

function tokenDeRespaldo(): boolean {
  return Boolean(Deno.env.get('GOOGLE_CLIENT_ID') && Deno.env.get('GOOGLE_CLIENT_SECRET') && Deno.env.get('GOOGLE_REFRESH_TOKEN'));
}

/** Sin calendario configurado, la sincronización se omite (no es un error). */
export function calendarioConfigurado(): boolean {
  return Boolean(Deno.env.get('GOOGLE_CALENDAR_ID') && (cuentaServicio() || tokenDeRespaldo()));
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------
// Los access tokens de Google duran una hora; se guardan en memoria mientras
// la función siga viva. Ningún secreto de Google llega jamás al navegador.
// ---------------------------------------------------------------------------
let cache: { token: string; expira: number } | null = null;

function b64url(datos: ArrayBuffer | string): string {
  const bytes = typeof datos === 'string' ? new TextEncoder().encode(datos) : new Uint8Array(datos);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT firmado con la llave de la cuenta de servicio (RS256) → access token. */
async function tokenCuentaServicio(sa: CuentaServicio): Promise<Response> {
  const ahora = Math.floor(Date.now() / 1000);
  const cabeza = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const llave = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(`${cabeza}.${cuerpo}`));

  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabeza}.${cuerpo}.${b64url(firma)}`,
    }),
  });
}

async function accessToken(): Promise<string> {
  if (cache && Date.now() < cache.expira - 60_000) return cache.token;

  const sa = cuentaServicio();
  const res = sa
    ? await tokenCuentaServicio(sa)
    : await fetch('https://oauth2.googleapis.com/token', {
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
  cache = { token: data.access_token, expira: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cache.token;
}

async function api(ruta: string, init: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3${ruta}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return await res.json();
}

// ---------------------------------------------------------------------------
// El evento
// ---------------------------------------------------------------------------

/** La forma de resumen_sesion() (migración calendario_por_sesion). */
export interface ResumenSesion {
  id: string;
  experience_type: 'taller' | 'kids' | 'membresia';
  title: string;
  date: string;
  start_time: string;
  end_time: string | null;
  timezone: string | null;
  capacity: number | null;
  price: number | null;
  currency: string;
  status: 'open' | 'closed' | 'cancelled';
  google_calendar_event_id: string | null;
  confirmed: number;
  reservations: { folio: string; name: string; phone: string | null; quantity: number; children: string[] }[];
}

const TIPO = { taller: 'Taller', kids: 'NUMA Kids', membresia: 'Clase de membresía' } as const;

/** 'HH:MM[:SS]' con la fecha → hora local sin zona (Google usa `timeZone`). */
function marca(fecha: string, hora: string): string {
  return `${fecha}T${hora.slice(0, 5)}:00`;
}

function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function descripcion(s: ResumenSesion): string {
  const precio = s.experience_type === 'membresia'
    ? 'Membresía'
    : s.price === null
      ? 'Info DM (sin precio publicado)'
      : `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: s.currency || 'MXN', maximumFractionDigits: 0 }).format(Number(s.price))} por persona`;

  const lineas = [
    `${TIPO[s.experience_type]} · ${precio}`,
    s.capacity === null ? `Confirmados: ${s.confirmed} (cupo sin confirmar)` : `Cupo: ${s.confirmed} / ${s.capacity} confirmados`,
  ];
  if (!s.end_time) lineas.push(`Hora de término sin publicar: el evento ocupa ${DURACION_SUPUESTA_MIN / 60} h.`);
  if (s.status !== 'open') lineas.push(s.status === 'cancelled' ? 'SESIÓN CANCELADA' : 'Sesión cerrada al público');
  lineas.push('');

  if (s.reservations.length) {
    lineas.push('Reservas:');
    for (const r of s.reservations) {
      lineas.push(`${r.folio} · ${r.name} · ${r.quantity} ${r.quantity === 1 ? 'lugar' : 'lugares'}${r.phone ? ` · ${r.phone}` : ''}`);
      if (r.children.length) lineas.push(`   Niños: ${r.children.join(', ')}`);
    }
  } else {
    lineas.push('Sin reservas confirmadas todavía.');
  }

  lineas.push('', `Actualizado: ${new Date().toLocaleString('es-MX', { timeZone: TZ })}`);
  return lineas.join('\n');
}

function cuerpoEvento(s: ResumenSesion, cancelado: boolean) {
  const zona = s.timezone || TZ;
  const fin = s.end_time ?? sumarMinutos(s.start_time, DURACION_SUPUESTA_MIN);
  const cupo = s.capacity === null ? `${s.confirmed}` : `${s.confirmed}/${s.capacity}`;
  return {
    summary: cancelado ? `CANCELADO | ${s.title}` : `CASA NUMA | ${s.title} (${cupo})`,
    description: descripcion(s),
    location: LUGAR,
    start: { dateTime: marca(s.date, s.start_time), timeZone: zona },
    end: { dateTime: marca(s.date, fin), timeZone: zona },
    // NUNCA se agregan las clientas como `attendees`: Google les mandaría
    // invitaciones y cada una vería el correo de las demás. La lista va solo
    // en la descripción.
    status: cancelado ? 'cancelled' : 'confirmed',
  };
}

/**
 * Crea o actualiza el evento de la sesión. Devuelve su id, o null si no hay
 * nada que mostrar (sesión cerrada sin reservas que nunca tuvo evento).
 * NUNCA crea un evento nuevo cuando ya hay uno: eso duplicaría la agenda.
 */
export async function sincronizarSesion(s: ResumenSesion): Promise<string | null> {
  const calendarId = encodeURIComponent(env('GOOGLE_CALENDAR_ID'));
  // Cerrada sin nadie apuntado: sale del calendario.
  const cancelado = s.status === 'cancelled' || (s.status === 'closed' && s.confirmed === 0);
  const cuerpo = cuerpoEvento(s, cancelado);

  if (s.google_calendar_event_id) {
    try {
      const ev = await api(
        `/calendars/${calendarId}/events/${encodeURIComponent(s.google_calendar_event_id)}`,
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

  if (cancelado) return null;
  const ev = await api(`/calendars/${calendarId}/events`, { method: 'POST', body: JSON.stringify(cuerpo) });
  return ev.id as string;
}
