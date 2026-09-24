import type { CategoriaTaller, Taller } from '../datos/tipos';
import { diaSemana, fechaCompleta, hora, partes, yaPaso } from './calendario';

export const FILTROS: { id: CategoriaTaller | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'adultos', label: 'Adultos' },
  { id: 'ninos', label: 'Niños' },
  { id: 'temporada', label: 'Temporada' },
];

/** "$800 p/p", o la etiqueta que publica Casa Numa cuando no hay precio ("Info DM"). */
export function precioTaller(t: Taller): string {
  if (t.precio !== null) return `$${new Intl.NumberFormat('es-MX').format(t.precio)} p/p`;
  return t.etiquetaPrecio ?? 'Precio por confirmar';
}

/** "Niños · 10 a 14 años" */
export function publicoTaller(t: Taller): string {
  return t.edad ? `${t.etiqueta} · ${t.edad.min} a ${t.edad.max} años` : t.etiqueta;
}

/** "jueves 1 de octubre, 5:00 p.m." — para mensajes. */
export function cuandoTaller(t: Taller): string {
  const s = t.sesiones[0];
  if (!s) return '';
  return `${fechaCompleta(s.fecha)}, ${t.sesiones.map((x) => hora(x.inicio)).join(' o ')}`;
}

/** Tiene al menos un horario que todavía no pasa. */
export function esProximo(t: Taller): boolean {
  return t.sesiones.some((s) => !yaPaso(s.fecha, s.inicio));
}

/**
 * Semana del mes contando de lunes a domingo: del 1 al primer domingo es la
 * semana 1 (así lo publica Casa Numa: "Semana 1" = jueves 1 a domingo 4).
 */
export function semanaDelMes(fecha: string): number {
  const [a, m, d] = partes(fecha);
  const desfase = (diaSemana(`${a}-${String(m).padStart(2, '0')}-01`) + 6) % 7;
  return Math.floor((d + desfase - 1) / 7) + 1;
}
