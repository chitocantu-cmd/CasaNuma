// ===========================================================================
// Anticipo de las reservas en línea
// ---------------------------------------------------------------------------
// Toda reserva en línea se confirma pagando el 50 % del total (el porcentaje
// vive en config/reservas.ts); el resto se liquida en Casa Numa. Toda cuenta
// de anticipo y saldo sale de aquí: los checkouts, Mi cuenta, el panel, los
// avisos y el backend de la demo usan estas funciones, y el servidor real
// repite la misma regla (docs/INTEGRACION.md). Nunca se escribe un anticipo a
// mano ni se calcula en un componente.
//
// Primero el TOTAL (precio × personas) y luego el anticipo: 2 × $800 =
// $1,600 → hoy $800, no el 50 % de una sola persona.
//
// Nombres del modelo de datos (calculateBookingPayment): total = total,
// porcentajeAnticipo = depositPercentage, anticipo = depositAmount,
// saldo = remainingBalance.
// ===========================================================================

import { CONFIG_RESERVAS } from '../config/reservas';

/** Qué parte del total se paga en línea para reservar. */
export const PORCENTAJE_ANTICIPO = CONFIG_RESERVAS.porcentajeAnticipo;

export interface PagoReserva {
  total: number;
  /** 50 → «el 50 % del total». */
  porcentajeAnticipo: number;
  /** Lo que se paga hoy para confirmar la reservación. */
  anticipo: number;
  /** Lo que se liquida después, en Casa Numa. */
  saldo: number;
}

/** Pesos → centavos enteros. Las cuentas de dinero se hacen en centavos. */
export const aCentavos = (pesos: number) => Math.round(pesos * 100);

/**
 * Anticipo y saldo de un total (calculateBookingPayment). Con un total
 * impar el centavo de más queda en el saldo: el anticipo nunca supera la
 * mitad. `anticipoCentavos` es lo que recibe el proveedor de pagos (Stripe
 * trabaja en centavos: $340 → 34000).
 */
export function calcularPagoReserva(total: number, porcentaje: number = PORCENTAJE_ANTICIPO): PagoReserva & { anticipoCentavos: number } {
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError('La reserva necesita un total mayor a cero para calcular el anticipo.');
  }
  const centavos = aCentavos(total);
  const anticipo = Math.floor((centavos * porcentaje) / 100);
  return { total: centavos / 100, porcentajeAnticipo: porcentaje, anticipo: anticipo / 100, saldo: (centavos - anticipo) / 100, anticipoCentavos: anticipo };
}

/** Total de una reserva: precio unitario × cantidad, en centavos exactos. */
export function totalReserva(precioUnitario: number, cantidad: number): number {
  return (aCentavos(precioUnitario) * cantidad) / 100;
}

/**
 * Lo que se cobra en línea: el anticipo si la reserva se paga en partes, o
 * el total. Es lo único que debe recibir el proveedor de pagos (Stripe).
 */
export function montoEnLinea(r: { total: number; cobro?: { anticipo: number } }): number {
  return r.cobro ? r.cobro.anticipo : r.total;
}

interface ConCobro {
  total: number;
  pago: string;
  cobro?: { pagado: number; saldo: number };
}

/** Lo recibido de una reserva hasta hoy (anticipo + saldo, o el total). */
export function montoPagado(r: ConCobro): number {
  if (r.pago === 'reembolsado') return 0;
  if (r.cobro) return r.cobro.pagado;
  return r.pago === 'pagado' ? r.total : 0;
}

/** Lo que falta cobrar de una reserva. Negativo = pagó de más (revisión manual). */
export function saldoDe(r: ConCobro): number {
  if (r.cobro) return r.cobro.saldo;
  return r.pago === 'pagado' || r.pago === 'reembolsado' ? 0 : r.total;
}

/**
 * SALDO = PRECIO FINAL − TOTAL YA PAGADO. Sirve también cuando la persona
 * cambia de pieza en el estudio: no se cobra «el otro 50 %», se cobra lo que
 * falta. Negativo = ya pagó más de lo que vale la pieza nueva.
 */
export function saldoPendiente(precioFinal: number, pagado: number): number {
  return (aCentavos(precioFinal) - aCentavos(pagado)) / 100;
}
