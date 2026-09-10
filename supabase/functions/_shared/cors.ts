// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// El navegador llama a estas funciones desde otro origen (el sitio en Vercel),
// así que hay que declarar CORS explícitamente.
//
// Se usa APP_URL en vez de '*' para no dejar la API abierta a cualquier página.
// En desarrollo se permite localhost.
// ---------------------------------------------------------------------------

const permitidos = [
  Deno.env.get('APP_URL') ?? '',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin && permitidos.includes(origin) ? origin : permitidos[0] ?? '';
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }
  return null;
}
