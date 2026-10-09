import { describe, expect, it } from 'vitest';
import { CONFIG_RESERVAS } from '../config/reservas';
import { PORCENTAJE_ANTICIPO, calcularPagoReserva, montoEnLinea, saldoPendiente, totalReserva } from './anticipo';
import { pesosCortos } from './formato';

describe('anticipo de toda reserva en línea', () => {
  it('sale de una sola configuración: 50 %', () => {
    expect(CONFIG_RESERVAS.porcentajeAnticipo).toBe(50);
    expect(PORCENTAJE_ANTICIPO).toBe(50);
  });

  it('total → anticipo y saldo exactos (200, 680, 800, 1,600, 3,200)', () => {
    for (const [total, mitad] of [[200, 100], [680, 340], [800, 400], [1600, 800], [3200, 1600]]) {
      expect(calcularPagoReserva(total)).toMatchObject({ total, porcentajeAnticipo: 50, anticipo: mitad, saldo: mitad });
    }
  });

  it('primero el total (precio × personas) y luego el 50 %', () => {
    const total = totalReserva(800, 2);
    expect(total).toBe(1600);
    expect(calcularPagoReserva(total).anticipo).toBe(800);
    expect(calcularPagoReserva(totalReserva(680, 3))).toMatchObject({ total: 2040, anticipo: 1020, saldo: 1020 });
  });

  it('a Stripe va el anticipo en centavos: $680 → 34000', () => {
    expect(calcularPagoReserva(680).anticipoCentavos).toBe(34000);
    expect(calcularPagoReserva(3200).anticipoCentavos).toBe(160000);
  });

  it('un precio impar no pierde ni inventa centavos', () => {
    const p = calcularPagoReserva(455);
    expect(p.anticipo).toBe(227.5);
    expect(p.saldo).toBe(227.5);
    const q = calcularPagoReserva(455.01);
    expect(q.anticipo + q.saldo).toBeCloseTo(455.01, 10);
    expect(q.anticipo).toBeLessThanOrEqual(q.saldo);
    expect(totalReserva(0.1, 3)).toBe(0.3);
  });

  it('sin precio válido no hay anticipo (nunca $0 ni NaN)', () => {
    expect(() => calcularPagoReserva(0)).toThrow(RangeError);
    expect(() => calcularPagoReserva(-300)).toThrow(RangeError);
    expect(() => calcularPagoReserva(Number.NaN)).toThrow(RangeError);
  });

  it('en línea se cobra el anticipo, no el total', () => {
    expect(montoEnLinea({ total: 1600, cobro: { anticipo: 800 } })).toBe(800);
    expect(montoEnLinea({ total: 1600 })).toBe(1600);
  });

  it('saldo = precio final − total ya pagado (también al cambiar de pieza)', () => {
    expect(saldoPendiente(600, 200)).toBe(400);
    expect(saldoPendiente(600, 600)).toBe(0);
    expect(saldoPendiente(150, 200)).toBe(-50);
    expect(saldoPendiente(0.3, 0.1)).toBe(0.2);
  });

  it('los montos con centavos se muestran con centavos', () => {
    expect(pesosCortos(300)).toBe('$300 MXN');
    expect(pesosCortos(227.5)).toBe('$227.50 MXN');
  });
});
