import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ADMIN_DEMO, repoAdminDemo, repoDemo } from './repoDemo';
import { montoEnLinea } from '../../lib/anticipo';
import type { SolicitudReserva } from '../tipos';

// Pinta tu pieza en el backend de la demo: el anticipo sale del catálogo, se
// cobra solo el 50 %, el saldo se liquida en el estudio y el inventario no
// deja vender dos veces la última pieza.
// Hoy fijo: 25 sep 2026 (viernes). Precios de ejemplo: taza recta $300,
// florero dulce $600, sagrado corazón $900.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T12:00:00-06:00'));
});
afterAll(() => vi.useRealTimers());

const SABADO = 'pinta-2026-09-26-1600';
const contacto = (n: string) => ({ nombre: `Pinta ${n}`, email: `pinta-${n}@ejemplo.com`, telefono: '8112345678' });
const solicitud = (piezaId: string, n: string, sesion = SABADO): SolicitudReserva => ({
  tipo: 'pinta', referencia: 'pinta', sesionIds: [sesion], participantes: 1, piezaId, contacto: contacto(n),
});

async function comoClienta(n: string) {
  await repoDemo.salir();
  await repoDemo.registrar({ ...contacto(n), password: 'secreta123', novedades: false });
}

async function reservarYPagar(piezaId: string, n: string) {
  await comoClienta(n);
  const r = await repoDemo.apartar(solicitud(piezaId, n));
  const pago = await repoDemo.pagar(r.id, { simulacion: 'aprobado' });
  if (pago.tipo !== 'confirmado') throw new Error('la demo confirma sin redirección');
  return pago.reserva;
}

describe('Pinta tu pieza en la demo', () => {
  it('abre jueves 7 p.m., viernes 10 a.m., sábado 11 y 4, domingo 11; nada de lunes a miércoles', async () => {
    const sesiones = await repoDemo.sesionesPinta();
    // El viernes 25 a las 10:00 ya pasó (son las 12:00): no se ofrece.
    const primeras = sesiones.slice(0, 5).map((s) => `${s.fecha} ${s.inicio}`);
    expect(primeras).toEqual(['2026-09-26 11:00', '2026-09-26 16:00', '2026-09-27 11:00', '2026-10-01 19:00', '2026-10-02 10:00']);
    expect(sesiones.every((s) => s.cupo === 16)).toBe(true);
    const dias = new Set(sesiones.map((s) => new Date(`${s.fecha}T12:00:00`).getDay()));
    expect([...dias].sort()).toEqual([0, 4, 5, 6]);
    expect(sesiones.find((s) => s.inicio === '19:00')?.fin).toBe('21:00');
  });

  it('las piezas sin precio no se pueden apartar', async () => {
    await comoClienta('sin-precio');
    const jarra = (await repoDemo.piezasPinta()).find((p) => p.id === 'jarra')!;
    expect(jarra.precio).toBeNull();
    await expect(repoDemo.apartar(solicitud('jarra', 'sin-precio'))).rejects.toMatchObject({ codigo: 'SIN_PIEZA' });
    await expect(repoDemo.apartar({ ...solicitud('taza-recta', 'sin-precio'), piezaId: undefined })).rejects.toMatchObject({ codigo: 'SIN_PIEZA' });
  });

  it('apartar: total = precio de la pieza, anticipo exactamente 50 %, nada pagado', async () => {
    await comoClienta('apartar');
    const r = await repoDemo.apartar(solicitud('florero-dulce', 'apartar'));
    expect(r.total).toBe(600);
    expect(r.pieza).toMatchObject({ id: 'florero-dulce', precio: 600, cambios: [] });
    expect(r.cobro).toEqual({ porcentaje: 50, anticipo: 300, pagado: 0, pagoFinal: null, saldo: 600 });
    expect(montoEnLinea(r)).toBe(300);
    expect(r.estado).toBe('pendiente_pago');
  });

  it('pago aprobado: confirma con folio, cobra solo el anticipo y deja el saldo pendiente', async () => {
    const r = await reservarYPagar('florero-dulce', 'paga');
    expect(r.folio).toMatch(/^NUMA-\d{5}$/);
    expect(r.estado).toBe('confirmada');
    expect(r.pago).toBe('anticipo_pagado');
    expect(r.cobro).toMatchObject({ anticipo: 300, pagado: 300, saldo: 300, pagoFinal: null });
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    const pagos = (await repoAdminDemo.pagos()).filter((p) => p.reservaId === r.id);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({ monto: 300, concepto: 'anticipo', estado: 'pagado' });
  });

  it('marcar saldo como pagado: pagado completo, saldo $0 y el anticipo se conserva', async () => {
    const r = await reservarYPagar('taza-recta', 'liquida');
    expect(r.cobro).toMatchObject({ anticipo: 150, saldo: 150 });
    const resumenAntes = await repoAdminDemo.resumen();
    const liquidada = await repoAdminDemo.liquidarSaldo(r.id, 'efectivo');
    expect(liquidada.pago).toBe('pagado');
    expect(liquidada.total).toBe(300);
    expect(liquidada.cobro).toEqual({ porcentaje: 50, anticipo: 150, pagado: 300, pagoFinal: 150, saldo: 0 });
    const pagos = (await repoAdminDemo.pagos()).filter((p) => p.reservaId === r.id);
    expect(pagos.map((p) => [p.concepto, p.monto]).sort()).toEqual([['anticipo', 150], ['saldo', 150]]);
    expect((await repoAdminDemo.resumen()).saldoPorCobrar).toBe(resumenAntes.saldoPorCobrar - 150);
    await expect(repoAdminDemo.liquidarSaldo(r.id, 'efectivo')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });

  it('cambio a una pieza más cara: saldo = precio final − ya pagado (no «el otro 50 %»)', async () => {
    // Reservó la taza de $300 y pagó $150; en el estudio cambia al florero de $600.
    const r = await reservarYPagar('taza-recta', 'cambia');
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    const cambiada = await repoAdminDemo.cambiarPieza(r.id, 'florero-dulce');
    expect(cambiada.total).toBe(600);
    expect(cambiada.cobro).toMatchObject({ anticipo: 150, pagado: 150, saldo: 450 });
    expect(cambiada.pago).toBe('anticipo_pagado');
    expect(cambiada.pieza?.cambios).toHaveLength(1);
    expect(cambiada.pieza?.cambios[0]).toMatchObject({ de: { id: 'taza-recta', precio: 300 }, a: { id: 'florero-dulce', precio: 600 } });
    const final = await repoAdminDemo.liquidarSaldo(r.id, 'tarjeta');
    expect(final.cobro).toMatchObject({ pagado: 600, pagoFinal: 450, saldo: 0 });
  });

  it('cambio a una más barata que lo ya pagado: saldo negativo y revisión manual, sin reembolso automático', async () => {
    const r = await reservarYPagar('sagrado-corazon', 'barata');
    expect(r.cobro?.pagado).toBe(450);
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    const antes = (await repoAdminDemo.resumen()).revisionManual;
    const cambiada = await repoAdminDemo.cambiarPieza(r.id, 'taza-recta');
    expect(cambiada.cobro?.saldo).toBe(-150);
    expect(cambiada.cobro?.pagado).toBe(450);
    expect((await repoAdminDemo.resumen()).revisionManual).toBe(antes + 1);
    await expect(repoAdminDemo.liquidarSaldo(r.id, 'efectivo')).rejects.toThrow(/revisión manual/);
  });

  it('inventario: la última pieza no se vende dos veces y vuelve al cancelar', async () => {
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    await repoAdminDemo.editarPieza('sagrado-corazon', { stock: 1 });
    await comoClienta('ultima-a');
    const a = await repoDemo.apartar(solicitud('sagrado-corazon', 'ultima-a'));
    expect((await repoDemo.piezasPinta()).find((p) => p.id === 'sagrado-corazon')?.disponibles).toBe(0);

    // Otra persona, al mismo tiempo: agotada.
    await comoClienta('ultima-b');
    await expect(repoDemo.apartar(solicitud('sagrado-corazon', 'ultima-b'))).rejects.toMatchObject({ codigo: 'SIN_PIEZA' });

    // A paga: la pieza sale del inventario.
    await repoDemo.salir();
    await repoDemo.entrar(contacto('ultima-a').email, 'secreta123');
    await repoDemo.pagar(a.id, { simulacion: 'aprobado' });
    const piezas = await repoAdminDemo.piezas();
    expect(piezas.find((p) => p.id === 'sagrado-corazon')).toMatchObject({ stock: 0, disponibles: 0 });

    // El equipo la cancela: vuelve a haber una.
    await repoAdminDemo.actualizarReserva(a.id, { estado: 'cancelada' });
    expect((await repoAdminDemo.piezas()).find((p) => p.id === 'sagrado-corazon')).toMatchObject({ stock: 1, disponibles: 1 });
  });

  it('el equipo pone precio a una pieza pendiente y ya se puede apartar', async () => {
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    await expect(repoAdminDemo.editarPieza('jarra', { precio: 0 })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    const jarra = await repoAdminDemo.editarPieza('jarra', { precio: 455 });
    expect(jarra).toMatchObject({ precio: 455, demo: false });
    await comoClienta('jarra');
    const r = await repoDemo.apartar(solicitud('jarra', 'jarra'));
    expect(r.cobro).toMatchObject({ anticipo: 227.5, saldo: 455 });
  });
});
