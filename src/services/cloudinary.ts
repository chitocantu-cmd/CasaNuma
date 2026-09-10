import { llamar } from './api';

// ---------------------------------------------------------------------------
// Subida firmada a Cloudinary
// ---------------------------------------------------------------------------
// El archivo va DIRECTO del navegador a Cloudinary: no pasa por nuestro
// servidor ni por la base de datos. Lo único que pedimos al backend es la
// firma que autoriza esa subida.
//
// CLOUDINARY_API_SECRET nunca sale de la Edge Function.
// ---------------------------------------------------------------------------

interface Firma {
  signature: string;
  timestamp: number;
  folder: string;
  api_key: string;
  cloud_name: string;
  upload_url: string;
}

export interface ImagenSubida {
  url: string;
  publicId: string;
}

export async function subirImagen(archivo: File): Promise<ImagenSubida> {
  const firma = await llamar<Firma>('cloudinary-sign', {}, { conSesion: true });

  const form = new FormData();
  form.append('file', archivo);
  form.append('api_key', firma.api_key);
  form.append('timestamp', String(firma.timestamp));
  form.append('folder', firma.folder);
  form.append('signature', firma.signature);

  const res = await fetch(firma.upload_url, { method: 'POST', body: form });

  if (!res.ok) {
    throw new Error('No pudimos subir la imagen. Intenta de nuevo.');
  }

  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

/** Transformación de Cloudinary para servir la imagen al tamaño justo. */
export function optimizar(url: string | null, ancho = 800): string | null {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${ancho}/`);
}
