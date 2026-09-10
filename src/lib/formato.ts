const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
];

export const ZONA = 'America/Monterrey';

/**
 * Se parsea a mano en vez de usar new Date('2026-09-12').
 *
 * El constructor interpreta las fechas ISO sin hora como UTC, y en México
 * (UTC-6) eso corre la fecha un día hacia atrás: un taller del sábado 12
 * aparecería como viernes 11. Es un bug clásico, silencioso, y el tipo de cosa
 * que solo se nota cuando una clienta llega el día equivocado.
 */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`;
}

export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

export function mesDeFecha(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function rangoHorario(inicio: string, fin: string): string {
  return `${hora12(inicio)} — ${hora12(fin)}`;
}

export function duracion(inicio: string, fin: string): string {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** El precio llega como numeric(10,2) desde la base: 650 -> "$650 MXN". */
export function pesos(monto: number | string, moneda = 'MXN'): string {
  const n = Number(monto);
  if (n === 0) return 'Sobre cotización';
  return `${new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: moneda, maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)} ${moneda}`;
}

/** Fecha y hora del taller como instante absoluto, en su zona horaria. */
export function inicioTaller(fecha: string, hora: string): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  // Monterrey es UTC-6 fijo desde que México eliminó el horario de verano
  // en 2022.
  return new Date(Date.UTC(a, m - 1, d, hh + 6, mm));
}

export function yaOcurrio(fecha: string, hora: string): boolean {
  return inicioTaller(fecha, hora).getTime() <= Date.now();
}

export type EstadoCupo = 'lleno' | 'ultimos' | 'disponible';

export function estadoCupo(disponibles: number): EstadoCupo {
  if (disponibles <= 0) return 'lleno';
  if (disponibles <= 3) return 'ultimos';
  return 'disponible';
}

export function textoCupo(disponibles: number): string {
  const estado = estadoCupo(disponibles);
  if (estado === 'lleno') return 'Cupo lleno';
  if (estado === 'ultimos') {
    return `Últimos ${disponibles} ${disponibles === 1 ? 'lugar' : 'lugares'}`;
  }
  return `${disponibles} lugares disponibles`;
}

export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function correoValido(valor: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor.trim());
}

/** Número normalizado para enlaces de wa.me. */
export function enlaceWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const d = soloDigitos(telefono);
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? '52' + d : d}`;
}

/** Cuenta regresiva legible: "8 min 24 s". */
export function restante(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return min > 0 ? `${min} min ${seg} s` : `${seg} s`;
}

export function fechaHoraCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
