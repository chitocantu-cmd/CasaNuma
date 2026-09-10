// ===========================================================================
// Casa Numa · submit-form
// ---------------------------------------------------------------------------
// Contacto y membresía. En el demo estos botones ejecutaban
// `onClick: () => setEnviado(true)`: mostraban el "gracias" y descartaban lo
// que la persona había escrito. Cada prospecto se perdía.
//
// El lead se guarda PRIMERO y el correo se encola. Si Resend falla, el
// prospecto ya está en la base: nunca se pierde por una caída del proveedor
// de correo.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { db, traducirError, logError } from '../_shared/clients.ts';

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

  // -------------------------------------------------------------------------
  // Campo trampa: invisible para las personas, los robots lo llenan.
  //
  // Se responde 200 a propósito. Si devolviéramos un error, quien programó el
  // robot lo notaría y ajustaría; así cree que funcionó y no insiste.
  // -------------------------------------------------------------------------
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return json({ ok: true }, 200, origin);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sin-ip';
  const { data: permitido } = await db.rpc('permitir', {
    p_clave: `form:${ip}`, p_maximo: 5, p_minutos: 10,
  });
  if (permitido === false) {
    return json(
      { error: 'TOO_MANY_REQUESTS', message: 'Espera unos minutos antes de volver a enviar.' },
      429, origin,
    );
  }

  const tipo = String(body.tipo ?? '');
  if (tipo !== 'contacto' && tipo !== 'membresia') {
    return json({ error: 'INVALID_INPUT' }, 400, origin);
  }

  const { data: id, error } = await db.rpc('guardar_prospecto', {
    p_tipo: tipo,
    p_name: String(body.name ?? ''),
    p_email: String(body.email ?? ''),
    p_phone: body.phone ? String(body.phone) : null,
    p_message: body.message ? String(body.message) : null,
    p_interests: Array.isArray(body.interests) ? body.interests : [],
  });

  if (error) {
    const traducido = traducirError(error);
    if (traducido) return json(traducido.body, traducido.status, origin);
    logError('submit-form', error);
    return json({ error: 'INTERNAL_ERROR', message: 'No pudimos enviar tu mensaje.' }, 500, origin);
  }

  return json({ ok: true, id }, 200, origin);
});
