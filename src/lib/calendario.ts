// ---------------------------------------------------------------------------
// Aritmética de fechas 'YYYY-MM-DD' sin pasar por UTC.
// ---------------------------------------------------------------------------
// new Date('2026-10-24') se interpreta como UTC y en Monterrey (UTC-6) cae en
// el día anterior. Todo aquí trabaja con año/mes/día explícitos.
// ---------------------------------------------------------------------------

import { ZONA, inicioTaller } from './formato';

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const dos = (n: number) => String(n).padStart(2, '0');

export function aIso(a: number, m: number, d: number): string {
  return `${a}-${dos(m)}-${dos(d)}`;
}

export function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number);
  return [a, m, d];
}

/** Hoy en Monterrey, no en la zona del dispositivo. */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = partes(iso);
  const f = new Date(a, m - 1, d + dias);
  return aIso(f.getFullYear(), f.getMonth() + 1, f.getDate());
}

export function diaSemana(iso: string): number {
  const [a, m, d] = partes(iso);
  return new Date(a, m - 1, d).getDay();
}

export function diasDelMes(clave: string): string[] {
  const [a, m] = clave.split('-').map(Number);
  const total = new Date(a, m, 0).getDate();
  return Array.from({ length: total }, (_, i) => aIso(a, m, i + 1));
}

export function claveMes(iso: string): string {
  return iso.slice(0, 7);
}

export function sumarMeses(clave: string, n: number): string {
  const [a, m] = clave.split('-').map(Number);
  const f = new Date(a, m - 1 + n, 1);
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}`;
}

export function etiquetaMes(clave: string): string {
  const [a, m] = clave.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/** "sáb 24 oct" */
export function fechaCompacta(iso: string): string {
  const [, m, d] = partes(iso);
  return `${DIAS_CORTOS[diaSemana(iso)]} ${d} ${MESES[m - 1].slice(0, 3)}`;
}

/** "sábado 24 de octubre" */
export function fechaCompleta(iso: string): string {
  const [, m, d] = partes(iso);
  return `${DIAS_LARGOS[diaSemana(iso)]} ${d} de ${MESES[m - 1]}`;
}

/** "11:00 a.m.", como lo escribe Casa Numa. */
export function hora(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${dos(m)} ${h >= 12 ? 'p.m.' : 'a.m.'}`;
}

export function rango(inicio: string, fin: string): string {
  return `${hora(inicio)} – ${hora(fin)}`;
}

export function duracionTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} minutos`;
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${h} h ${m} min`;
}

export function yaPaso(fecha: string, inicio: string): boolean {
  return inicioTaller(fecha, inicio).getTime() <= Date.now();
}

/** Primer día >= `desde` que cae en `dia` (0 = domingo). */
export function proximoDia(desde: string, dia: number): string {
  const delta = (dia - diaSemana(desde) + 7) % 7;
  return sumarDias(desde, delta);
}
