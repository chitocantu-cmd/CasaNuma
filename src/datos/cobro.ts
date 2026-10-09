import { calcularPagoReserva } from '../lib/anticipo';
import type { CobroAnticipo } from './tipos';

/**
 * Cobro de una reserva en línea recién apartada: nada pagado todavía. El
 * anticipo (50 % del total) es lo que se cobrará en línea; el saldo se
 * liquida en Casa Numa. Lo usan la demo y, con la misma regla, el servidor.
 */
export function cobroInicial(total: number): CobroAnticipo {
  const p = calcularPagoReserva(total);
  return { porcentaje: p.porcentajeAnticipo, anticipo: p.anticipo, pagado: 0, pagoFinal: null, saldo: p.total };
}
