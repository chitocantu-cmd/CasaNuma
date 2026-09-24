import type { Sesion } from '../datos/tipos';
import { yaPaso } from './calendario';

// ---------------------------------------------------------------------------
// Cupo de una sesión, en un solo lugar.
// ---------------------------------------------------------------------------
// Una sesión puede tener cupo conocido (se cuentan lugares) o todavía no
// (cupo null: "Cupo limitado", sin inventar un número). Toda la interfaz
// pregunta aquí en vez de comparar `disponibles` a mano.
// ---------------------------------------------------------------------------

export function sinLugar(s: Sesion): boolean {
  return s.agotada || yaPaso(s.fecha, s.inicio) || (s.disponibles !== null && s.disponibles <= 0);
}

/** Tres lugares o menos, solo si el cupo es conocido. */
export function pocosLugares(s: Sesion): boolean {
  return !sinLugar(s) && s.disponibles !== null && s.disponibles <= 3;
}

export function textoLugares(s: Sesion): string {
  if (yaPaso(s.fecha, s.inicio)) return 'Ya pasó';
  if (sinLugar(s)) return 'Lleno';
  if (s.disponibles === null) return 'Cupo limitado';
  if (s.disponibles === 1) return 'Último lugar';
  if (s.disponibles <= 3) return `Últimos ${s.disponibles} lugares`;
  return `${s.disponibles} lugares`;
}

/** Máximo de personas que se pueden elegir en una reserva. */
export function maximoPersonas(s: Sesion | null, tope: number): number {
  if (!s || s.disponibles === null) return tope;
  return Math.max(0, Math.min(tope, s.disponibles));
}
