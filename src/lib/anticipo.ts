// ===========================================================================
// Pinta tu pieza · reserva con anticipo
// ---------------------------------------------------------------------------
// Para reservar se paga el 50 % del valor de la pieza elegida; el resto se
// paga en Casa Numa. Toda cuenta de anticipo y saldo sale de aquí: las
// páginas, el panel y el backend de la demo usan estas mismas funciones, y el
// servidor real debe repetirlas (docs/INTEGRACION.md). Nunca se escribe un
// anticipo a mano ni se calcula en un componente.
//
// Nombres del modelo de datos: total = totalPrice, porcentajeAnticipo =
// depositPercentage, anticipo = depositAmount, saldo = remainingBalance.
// ===========================================================================

/** Qué parte del valor de la pieza se paga en línea para reservar. */
export const PORCENTAJE_ANTICIPO = 50;

export interface PagoReserva {
  /** Precio de la pieza. */
  total: number;
  /** 50 → «el 50 % del valor de tu pieza». */
  porcentajeAnticipo: number;
  /** Lo que se paga hoy para reservar. */
  anticipo: number;
  /** Lo que se paga después, en Casa Numa. */
  saldo: number;
}

// Las cuentas se hacen en centavos: 0.1 + 0.2 no debe decidir un cobro.
const centavos = (pesos: number) => Math.round(pesos * 100);

/**
 * Anticipo y saldo de una pieza. Con un precio impar el centavo de más queda
 * en el saldo: el anticipo nunca supera la mitad.
 */
export function calcularPagoReserva(precioPieza: number, porcentaje = PORCENTAJE_ANTICIPO): PagoReserva {
  if (!Number.isFinite(precioPieza) || precioPieza <= 0) {
    throw new RangeError('La pieza necesita un precio mayor a cero para calcular el anticipo.');
  }
  const total = centavos(precioPieza);
  const anticipo = Math.floor((total * porcentaje) / 100);
  return { total: total / 100, porcentajeAnticipo: porcentaje, anticipo: anticipo / 100, saldo: (total - anticipo) / 100 };
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
  return (centavos(precioFinal) - centavos(pagado)) / 100;
}
