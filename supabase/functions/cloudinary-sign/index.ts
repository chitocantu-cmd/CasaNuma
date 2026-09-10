// ===========================================================================
// Casa Numa · cloudinary-sign
// ---------------------------------------------------------------------------
// Devuelve una firma para que el panel suba imágenes DIRECTO a Cloudinary,
// sin que el archivo pase por nuestro servidor ni por la base de datos.
//
// Por qué firmado y no un preset "unsigned": un preset sin firma es una puerta
// abierta —cualquiera que lea el bundle puede subir lo que quiera a la cuenta
// de Casa Numa—. Con firma, cada subida requiere que el servidor la autorice,
// y CLOUDINARY_API_SECRET nunca sale de aquí.
//
// El flujo completo:
//   1. El panel pide una firma (esta función, solo admins).
//   2. El navegador sube el archivo a Cloudinary con esa firma.
//   3. Cloudinary devuelve secure_url y public_id.
//   4. El panel los guarda en workshops.image_url / cloudinary_public_id.
// ===========================================================================

import { preflight, json } from '../_shared/cors.ts';
import { env, logError } from '../_shared/clients.ts';
import { adminDe } from '../_shared/admin.ts';

const CARPETA = 'casa-numa/talleres';

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get('origin');
  if (req.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  }

  const admin = await adminDe(req);
  if (!admin) {
    return json({ error: 'FORBIDDEN', message: 'No tienes permiso para subir imágenes.' }, 403, origin);
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary firma los parámetros ordenados alfabéticamente, unidos por &,
    // con el api_secret concatenado al final, en SHA-1.
    const params: Record<string, string> = {
      folder: CARPETA,
      timestamp: String(timestamp),
    };

    const aFirmar = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const signature = await sha1(aFirmar + env('CLOUDINARY_API_SECRET'));

    return json(
      {
        signature,
        timestamp,
        folder: CARPETA,
        api_key: env('CLOUDINARY_API_KEY'),
        cloud_name: env('CLOUDINARY_CLOUD_NAME'),
        upload_url: `https://api.cloudinary.com/v1_1/${env('CLOUDINARY_CLOUD_NAME')}/image/upload`,
      },
      200, origin,
    );
  } catch (e) {
    logError('cloudinary-sign', e);
    return json({ error: 'INTERNAL_ERROR', message: 'No pudimos preparar la subida.' }, 500, origin);
  }
});

async function sha1(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
