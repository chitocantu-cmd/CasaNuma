import { describe, expect, it } from 'vitest';
import { PORCENTAJE_ANTICIPO, calcularPagoReserva, saldoPendiente } from './anticipo';
import { pesosCortos } from './formato';

describe('anticipo de Pinta tu pieza', () => {
  it('es siempre el 50 % del valor de la pieza elegida', () => {
    expect(PORCENTAJE_ANTICIPO).toBe(50);
    for (const [precio, anticipo] of [[200, 100], [500, 250], [800, 400], [1200, 600]]) {
      expect(calcularPagoReserva(precio)).toEqual({ total: precio, porcentajeAnticipo: 50, anticipo, saldo: anticipo });
    }
  });

  it('un precio impar no pierde ni inventa centavos', () => {
    const p = calcularPagoReserva(455);
    expect(p.anticipo).toBe(227.5);
    expect(p.saldo).toBe(227.5);
    const q = calcularPagoReserva(455.01);
    expect(q.anticipo + q.saldo).toBeCloseTo(455.01, 10);
    expect(q.anticipo).toBeLessThanOrEqual(q.saldo);
  });

  it('sin precio válido no hay anticipo (nunca $0)', () => {
    expect(() => calcularPagoReserva(0)).toThrow(RangeError);
    expect(() => calcularPagoReserva(-300)).toThrow(RangeError);
    expect(() => calcularPagoReserva(Number.NaN)).toThrow(RangeError);
  });

  it('saldo = precio final − total ya pagado (también al cambiar de pieza)', () => {
    // Reservó una pieza de $400 y pagó $200; en el estudio cambia a una de $600.
    expect(saldoPendiente(600, 200)).toBe(400);
    // Liquidó todo.
    expect(saldoPendiente(600, 600)).toBe(0);
    // Cambió a una más barata que lo ya pagado: queda a favor (revisión manual).
    expect(saldoPendiente(150, 200)).toBe(-50);
    expect(saldoPendiente(0.3, 0.1)).toBe(0.2);
  });

  it('los montos con centavos se muestran con centavos', () => {
    expect(pesosCortos(300)).toBe('$300 MXN');
    expect(pesosCortos(227.5)).toBe('$227.50 MXN');
  });
});
