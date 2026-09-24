import type { EntradaFoto } from './fotos';

// ===========================================================================
// Testimonios · SOLO reseñas reales, con permiso de quien las escribió.
// ---------------------------------------------------------------------------
// Vacío a propósito: no existe todavía ninguna reseña confirmada y el
// documento de contenido pide "mostrar únicamente reseñas reales".
//
// Mientras la lista esté vacía, en desarrollo se ven espacios marcados como
// "TESTIMONIO REAL PENDIENTE" y en producción la sección muestra solo su
// encabezado con una invitación a Instagram (o se omite si tampoco hay).
// ===========================================================================

export interface Testimonio {
  cita: string;
  nombre: string;
  /** Qué vivió: "Membresía", "Taller de fin de semana", "Cumpleaños"… */
  experiencia?: string;
  foto?: EntradaFoto;
}

export const TESTIMONIOS: Testimonio[] = [];
