import type { CategoriaTaller, Taller } from '../datos/tipos';
import { AGENDA, flujoAgenda } from '../datos/agenda';
import { MEMBRESIA } from '../contenido/oferta';
import { diaSemana, fechaCompleta, hora, partes, yaPaso } from './calendario';
import { sinLugar } from './cupo';

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

/**
 * A dónde lleva "Reservar": el checkout del taller, NUMA Kids (con la fecha
 * ya elegida) o la membresía, según el camino del taller.
 */
export function rutaReserva(t: Taller, sesionId?: string): string {
  if (t.flujo === 'membresia') return '/membresia/reservar';
  if (t.flujo === 'kids') {
    const id = sesionId ?? t.sesiones.find((s) => !sinLugar(s))?.id;
    return `/numa-kids/reservar${id ? `?sesion=${id}` : ''}`;
  }
  return `/talleres/${t.slug}${sesionId ? `?sesion=${sesionId}` : ''}`;
}

export interface HorarioMembresia {
  diaSemana: number;
  /** "Viernes", "Sábados" */
  dia: string;
  inicio: string;
  fin: string | null;
}

const DIAS_PLURAL = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

/**
 * Días y horarios de la membresía según las Clases de Cerámica publicadas en
 * la agenda, de hoy en adelante (en octubre 2026: solo viernes). Si todavía no
 * hay clases publicadas, los del PDF.
 */
export function horariosMembresia(): HorarioMembresia[] {
  const vistos = new Map<string, HorarioMembresia>();
  for (const r of AGENDA) {
    if (!r.is_active || flujoAgenda(r) !== 'membresia') continue;
    for (const s of r.sessions) {
      if (yaPaso(r.date, s.start_time)) continue;
      const d = diaSemana(r.date);
      const clave = `${d}|${s.start_time}|${s.end_time}`;
      if (!vistos.has(clave)) vistos.set(clave, { diaSemana: d, dia: DIAS_PLURAL[d], inicio: s.start_time, fin: s.end_time });
    }
  }
  const lista = vistos.size ? [...vistos.values()] : [...MEMBRESIA.horarios];
  // Lunes primero: viernes, sábados, domingos.
  return lista.sort((a, b) => (a.diaSemana + 6) % 7 - (b.diaSemana + 6) % 7 || a.inicio.localeCompare(b.inicio));
}
