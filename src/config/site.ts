// ===========================================================================
// Configuración de Casa Numa
// ---------------------------------------------------------------------------
// Todo dato operativo que Casa Numa todavía no confirma vive AQUÍ y en ningún
// otro lugar. Un campo vacío significa "pendiente": el sitio lo detecta y
//   · en desarrollo (o con VITE_MOSTRAR_PENDIENTES=true) muestra un marcador
//     visible que dice qué falta;
//   · en producción oculta el elemento en vez de publicar algo inventado.
//
// Cada valor también puede llegar por variable de entorno (Vercel), para no
// tener que tocar código cuando Casa Numa lo confirme.
// ===========================================================================

const env = import.meta.env;

export interface Horario {
  dia: string;
  horas: string;
}

export const siteConfig = {
  nombre: 'Casa Numa',
  /** URL pública del sitio, sin diagonal final. Se usa en canonical y OpenGraph. */
  url: (env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ?? '',

  // --- Contacto ------------------------------------------------------------
  /**
   * Confirmado por Casa Numa (25 sep 2026): 81 2594 5907, el mismo de su ficha
   * de Google Maps. Solo dígitos con lada de país: 52 + 10 dígitos.
   */
  whatsapp: (env.VITE_NUMA_WHATSAPP as string | undefined) || '528125945907',
  /** PENDIENTE · correo de contacto. */
  email: (env.VITE_NUMA_EMAIL as string | undefined) ?? '',
  /** Confirmado por Casa Numa: instagram.com/casanumamx (sin @). */
  instagram: (env.VITE_NUMA_INSTAGRAM as string | undefined) || 'casanumamx',

  // --- Ubicación -----------------------------------------------------------
  /** Confirmado en el documento de contenido. */
  zona: 'Casco de San Pedro Garza García, Nuevo León',
  /**
   * Confirmado con la ficha de Google Maps de Casa NUMA (25 sep 2026):
   * Los Aldama 345a, Casco de San Pedro, 66200 San Pedro Garza García, N.L.
   */
  direccion: (env.VITE_NUMA_DIRECCION as string | undefined) || 'Los Aldama 345A',
  codigoPostal: '66200',
  /** true mientras la dirección no esté confirmada con su ficha de Google Maps. */
  direccionProvisional: false,
  /** Ficha de Google Maps de Casa NUMA: el botón "Cómo llegar" la abre. */
  googleMapsUrl: (env.VITE_NUMA_MAPS_URL as string | undefined) || 'https://maps.app.goo.gl/Uwmiy6q9Rc1PzUHB6',
  /** src del iframe del mapa. Vacío = se genera con el nombre y la dirección de la ficha. */
  googleMapsEmbedUrl: (env.VITE_NUMA_MAPS_EMBED as string | undefined) ?? '',
  /**
   * Horario de atención del estudio, tal como está en la ficha de Google Maps
   * (25 sep 2026). No confundir con los horarios de clase.
   */
  horarios: [
    { dia: 'Jueves y viernes', horas: '5:00 – 9:00 p.m.' },
    { dia: 'Sábado', horas: '10:00 a.m. – 5:00 p.m.' },
    { dia: 'Domingo', horas: '10:00 a.m. – 2:00 p.m.' },
    { dia: 'Lunes a miércoles', horas: 'Cerrado' },
  ] as Horario[],

  // --- Avisos al equipo -----------------------------------------------------
  /**
   * Confirmado por Casa Numa (25 sep 2026): correo donde el equipo recibe
   * cada reserva confirmada. Quien lo envía es el backend
   * (ADMIN_NOTIFICATION_EMAIL, secreto de Supabase); esta copia pública solo
   * sirve para que el panel muestre a dónde van los avisos.
   */
  correoAvisosEquipo: (env.VITE_ADMIN_NOTIFICATION_EMAIL as string | undefined) || 'casanuma5@gmail.com',

  // --- Tipografía ----------------------------------------------------------
  /**
   * ID del kit web de Adobe Fonts con Ivy Mode (p. ej. "abc1def").
   * Sin kit, los títulos usan Noto Serif Display.
   */
  adobeFontsKit: (env.VITE_ADOBE_FONTS_KIT as string | undefined) ?? '',
} as const;

/**
 * De dónde salen talleres, reservas y cuentas.
 *   'demo'     → datos simulados en el navegador (src/datos/demo). Pagos falsos.
 *   'supabase' → backend real (Supabase + Stripe). Ver docs/INTEGRACION.md.
 */
export const fuenteDatos = ((env.VITE_FUENTE_DATOS as string | undefined) ?? 'demo') as
  | 'demo'
  | 'supabase';

/** Marcadores de "pendiente" y fotos de referencia: solo fuera de producción. */
export const mostrarPendientes =
  env.DEV || (env.VITE_MOSTRAR_PENDIENTES as string | undefined) === 'true';

// ---------------------------------------------------------------------------
// Enlaces derivados
// ---------------------------------------------------------------------------

export function enlaceInstagram(): string | null {
  const u = siteConfig.instagram.replace(/^@/, '').trim();
  return u ? `https://instagram.com/${u}` : null;
}

/** Mensaje directo de Instagram ("Info DM"), o null sin usuario. */
export function enlaceInstagramDM(): string | null {
  const u = siteConfig.instagram.replace(/^@/, '').trim();
  return u ? `https://ig.me/m/${u}` : null;
}

/** wa.me con mensaje precargado, o null si el número aún no existe. */
export function enlaceWhatsapp(mensaje?: string): string | null {
  const d = siteConfig.whatsapp.replace(/\D/g, '');
  if (d.length < 12) return null;
  return `https://wa.me/${d}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

/** Mapa para insertar: el configurado, o uno generado desde la dirección. */
export function enlaceMapaEmbebido(): string | null {
  if (siteConfig.googleMapsEmbedUrl) return siteConfig.googleMapsEmbedUrl;
  if (!siteConfig.direccion) return null;
  const lugar = `Casa NUMA, ${siteConfig.direccion}, Casco de San Pedro, ${siteConfig.codigoPostal} San Pedro Garza García, N.L.`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(lugar)}&z=17&output=embed`;
}

export function enlaceComoLlegar(): string | null {
  if (siteConfig.googleMapsUrl) return siteConfig.googleMapsUrl;
  if (siteConfig.direccion) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${siteConfig.direccion}, San Pedro Garza García, Nuevo León`,
    )}`;
  }
  return null;
}
