import { PINTA } from '../contenido/oferta';
import { PRECIOS_EJEMPLO, type RegistroPieza } from '../contenido/piezasPinta';
import { diaSemana, hoy, sumarDias } from '../lib/calendario';
import { ErrorDatos } from './repositorio';
import type { PiezaPinta, Sesion } from './tipos';

// ===========================================================================
// Pinta tu pieza · reglas compartidas
// ---------------------------------------------------------------------------
// Las mismas para la demo y para Supabase: qué fechas se abren, cuándo se
// puede elegir una pieza. El anticipo es el mismo de toda reserva en línea
// (datos/cobro.ts y lib/anticipo.ts).
// ===========================================================================

/** `pinta-2026-10-09-1000` */
export const idSesionPinta = (fecha: string, inicio: string) => `pinta-${fecha}-${inicio.replace(':', '')}`;

/**
 * Sesiones del horario semanal entre dos fechas (incluidas). Lunes a
 * miércoles no hay. `cupos` = los ajustados desde el panel.
 */
export function sesionesPinta(desde: string, hasta: string): Sesion[] {
  const lista: Sesion[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const dia = PINTA.horario.find((h) => h.diaSemana === diaSemana(f));
    for (const h of dia?.horarios ?? []) {
      lista.push({ id: idSesionPinta(f, h.inicio), fecha: f, inicio: h.inicio, fin: h.fin, cupo: PINTA.cupo, disponibles: PINTA.cupo, agotada: false });
    }
  }
  return lista;
}

/** Las que se ofrecen: de hoy a las semanas abiertas. */
export function sesionesPintaAbiertas(): Sesion[] {
  const h = hoy();
  return sesionesPinta(h, sumarDias(h, PINTA.semanasAbiertas * 7));
}

/** Fecha y hora de una sesión de Pinta tu pieza a partir de su id (para el panel). */
export function sesionPintaDeId(id: string): Sesion | null {
  const m = /^pinta-(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})$/.exec(id);
  if (!m) return null;
  return sesionesPinta(m[1], m[1]).find((s) => s.inicio === `${m[2]}:${m[3]}`) ?? null;
}

// --- Piezas -------------------------------------------------------------------

/**
 * Registro del catálogo → pieza para las páginas. `ejemplos` = aplicar los
 * precios de ejemplo de la demo a las piezas que aún no tienen precio.
 */
export function aPiezaPinta(r: RegistroPieza, reservadas: number, ejemplos: boolean): PiezaPinta {
  const ejemplo = ejemplos && r.precio === null ? PRECIOS_EJEMPLO[r.id] ?? null : null;
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    categoria: r.categoria,
    fotos: r.fotos,
    precio: r.precio ?? ejemplo,
    tamano: r.tamano,
    acabado: r.acabado,
    requiereQuema: r.requiereQuema,
    stock: r.stock,
    disponibles: r.stock === null ? null : Math.max(0, r.stock - reservadas),
    activa: r.activa,
    demo: ejemplo !== null,
  };
}

export type EstadoPieza = 'disponible' | 'agotada' | 'precio_pendiente' | 'no_disponible';

/** Por qué una pieza se puede (o no) elegir. El orden importa: lo más claro primero. */
export function estadoPieza(p: PiezaPinta): EstadoPieza {
  if (!p.activa) return 'no_disponible';
  if (p.disponibles !== null && p.disponibles <= 0) return 'agotada';
  if (p.precio === null || !(p.precio > 0)) return 'precio_pendiente';
  return 'disponible';
}

export const sePuedeElegir = (p: PiezaPinta) => estadoPieza(p) === 'disponible';

/** Valida que la pieza se pueda reservar; si no, el mensaje para la persona. */
export function exigirPiezaReservable(p: PiezaPinta | undefined): asserts p is PiezaPinta & { precio: number } {
  if (!p) throw new ErrorDatos('SIN_PIEZA', 'Elige la pieza que quieres pintar.');
  const estado = estadoPieza(p);
  if (estado === 'agotada') throw new ErrorDatos('SIN_PIEZA', `«${p.nombre}» se agotó. Elige otra pieza.`);
  if (estado === 'no_disponible') throw new ErrorDatos('SIN_PIEZA', `«${p.nombre}» ya no está disponible. Elige otra pieza.`);
  if (estado === 'precio_pendiente') {
    throw new ErrorDatos('SIN_PIEZA', `«${p.nombre}» todavía no tiene precio publicado. Escríbenos para consultar disponibilidad.`);
  }
}
