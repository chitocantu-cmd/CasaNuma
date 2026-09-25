import { FOTOS, type EntradaFoto, type IdFoto } from '../contenido/fotos';
import { hoy } from '../lib/calendario';
import { ErrorDatos } from './repositorio';
import type { CambiosTaller, CategoriaTaller, TallerNuevo } from './tipos';

// ---------------------------------------------------------------------------
// Catálogo que administra el equipo: reglas compartidas por la demo y
// Supabase, para que un taller se valide igual en los dos.
// ---------------------------------------------------------------------------

export const CATEGORIA_DB = { adultos: 'adults', ninos: 'kids', temporada: 'seasonal' } as const satisfies Record<CategoriaTaller, string>;

export const ETIQUETA_CATEGORIA: Record<CategoriaTaller, string> = {
  adultos: 'Adultos',
  ninos: 'Niños',
  temporada: 'Temporada',
};

/** Fotos reales de Casa Numa que se pueden poner a un taller. */
export const FOTOS_TALLER = (Object.keys(FOTOS) as IdFoto[]).filter((id) => Boolean((FOTOS[id] as EntradaFoto).src));

const MESES_SLUG = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «Taza de Otoño», 2026-11-07 → taza-de-otono-07-nov (como los de la agenda). */
export function slugTaller(titulo: string, fecha: string): string {
  const base = titulo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'taller';
  const [, m, d] = fecha.split('-');
  return `${base}-${d}-${MESES_SLUG[Number(m) - 1]}`;
}

const invalido = (mensaje: string) => new ErrorDatos('DATOS_INVALIDOS', mensaje);

function validarComunes(c: CambiosTaller) {
  if (c.titulo !== undefined && !c.titulo.trim()) throw invalido('Escribe el nombre del taller.');
  if (c.resumen !== undefined && !c.resumen.trim()) throw invalido('Escribe una descripción corta.');
  if (c.precio !== undefined && c.precio !== null && !(Number.isFinite(c.precio) && c.precio > 0)) {
    throw invalido('El precio debe ser mayor a cero, o déjalo vacío para pedir información.');
  }
  if (c.foto !== undefined && !FOTOS_TALLER.includes(c.foto)) throw invalido('Elige una de las fotos del estudio.');
}

export function validarTallerNuevo(t: TallerNuevo) {
  validarComunes(t);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha)) throw invalido('Elige la fecha del taller.');
  if (t.fecha < hoy()) throw invalido('La fecha ya pasó: elige una de hoy en adelante.');
  if (!t.horarios.length) throw invalido('Agrega al menos un horario.');
  const inicios = new Set<string>();
  for (const h of t.horarios) {
    if (!HORA.test(h.inicio)) throw invalido('Revisa la hora de inicio (HH:MM).');
    if (h.fin !== null && (!HORA.test(h.fin) || h.fin <= h.inicio)) throw invalido('La hora de término debe ser después del inicio.');
    if (inicios.has(h.inicio)) throw invalido('Hay dos horarios a la misma hora.');
    inicios.add(h.inicio);
  }
  if (t.cupo !== null && !(Number.isInteger(t.cupo) && t.cupo >= 1)) throw invalido('El cupo debe ser un número entero, al menos 1.');
}

export function validarCambiosTaller(c: CambiosTaller) {
  validarComunes(c);
}
