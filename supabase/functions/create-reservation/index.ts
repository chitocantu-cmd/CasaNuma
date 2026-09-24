// ===========================================================================
// Casa Numa · create-reservation
// ---------------------------------------------------------------------------
// Aparta lugares llamando a crear_reserva_sesiones(), que bloquea las filas
// de las sesiones y valida el cupo en la misma transacción.
//
// EL PRECIO NUNCA VIENE DEL CLIENTE. El cuerpo solo trae qué sesiones,
// cuántas personas y datos de contacto. El monto lo calcula la base desde la
// sesión (talleres, NUMA Kids) o el plan (membresía).
//
// Cuerpo:
//   { tipo: 'taller' | 'kids' | 'membresia', session_ids: string[],
//     quantity, full_name, email, phone, children?: [{ name, age }], notes? }
//
// Compatibilidad: { slug, quantity, ... } (el formato de v1) se traduce a la
// sesión de ese taller. crear_reserva() v1 ya no se usa: dos funciones
// contando cupo por separado podrían sobrevender.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, traducirError, logError } from '../_shared/clients.ts';
import { usuarioDe } from '../_shared/admin.ts';

// Duración del apartado. Configurable por variable de entorno.
const HOLD_MINUTOS = Number(Deno.env.get('HOLD_MINUTES') ?? '15');
// PENDIENTE (Casa Numa): tope por reserva mientras el cupo no esté confirmado.
const MAX_SIN_CUPO = Number(Deno.env.get('MAX_PERSONAS_SIN_CUPO') ?? '6');

const TIPOS = new Set(['taller', 'kids', 'membresia']);

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON' }, 400, origin);
  }

  const quantity = Number(body.quantity);
  let tipo = String(body.tipo ?? '');
  let sesiones = Array.isArray(body.session_ids) ? body.session_ids.map(String) : [];

  // Formato v1: { slug } → la sesión abierta de ese taller.
  if (!sesiones.length && body.slug) {
    const { data: w } = await db.from('workshops').select('id').eq('slug', String(body.slug)).maybeSingle();
    const { data: s } = w
      ? await db.from('workshop_sessions').select('id').eq('workshop_id', w.id).eq('status', 'open')
      : { data: null };
    if (!s || s.length !== 1) {
      return json({ error: 'WORKSHOP_NOT_AVAILABLE', message: 'Elige el horario del taller.' }, 409, origin);
    }
    tipo = 'taller';
    sesiones = [s[0].id];
  }

  // Validación de forma. La validación real —correo, teléfono, edad, cupo,
  // precio, fecha— la hace PostgreSQL: es la única que no se puede saltar.
  if (!TIPOS.has(tipo)) {
    return json({ error: 'INVALID_INPUT', message: 'Tipo de reserva desconocido.' }, 400, origin);
  }
  if (!sesiones.length) {
    return json({ error: 'INVALID_INPUT', message: 'Elige una fecha.' }, 400, origin);
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return json({ error: 'INVALID_INPUT', message: 'Cantidad inválida.' }, 400, origin);
  }

  // Límite por IP: evita que alguien agote el cupo creando apartados en masa.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
  const { data: permitido } = await db.rpc('permitir', {
    p_clave: `reserva:${ip}`, p_maximo: 10, p_minutos: 10,
  });
  if (permitido === false) {
    return json(
      { error: 'TOO_MANY_REQUESTS', message: 'Espera unos minutos antes de volver a intentar.' },
      429, origin,
    );
  }

  // Si hay sesión iniciada, la reserva queda en su Mi cuenta. La base solo
  // liga la cuenta al cliente si el correo coincide.
  const usuario = await usuarioDe(req);

  // Del menor solo se manda nombre y edad, aunque el navegador mande más.
  const ninos = Array.isArray(body.children)
    ? (body.children as Record<string, unknown>[]).map((n) => ({ name: String(n?.name ?? ''), age: Number(n?.age) }))
    : [];

  const { data, error } = await db.rpc('crear_reserva_sesiones', {
    p_tipo: tipo,
    p_session_ids: sesiones,
    p_quantity: quantity,
    p_full_name: String(body.full_name ?? ''),
    p_email: String(body.email ?? ''),
    p_phone: String(body.phone ?? ''),
    p_children: ninos,
    p_user_id: usuario?.userId ?? null,
    p_origin: 'web',
    p_notes: body.notes ? String(body.notes) : null,
    p_max_sin_cupo: MAX_SIN_CUPO,
    p_hold_minutos: HOLD_MINUTOS,
  });

  if (error) {
    const traducido = traducirError(error);
    if (traducido) return json(traducido.body, traducido.status, origin);
    logError('create-reservation', error);
    return json({ error: 'INTERNAL_ERROR', message: 'No pudimos crear tu reserva.' }, 500, origin);
  }

  return json(data, 200, origin);
});
