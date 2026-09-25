import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ADMIN_DEMO, repoAdminDemo, repoDemo } from './repoDemo';

// El repositorio de la demo, de punta a punta: lo mismo que recorre el sitio.
// Hoy fijo: 25 sep 2026, antes de la agenda de octubre (no caduca).
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T12:00:00-06:00'));
});
afterAll(() => vi.useRealTimers());

const SLUG = 'tazas-de-halloween-03-oct';
const SESION = 'tazas-halloween-03-oct-1600';
const contacto = { nombre: 'Prueba Vitest', email: 'vitest@ejemplo.com', telefono: '8112345678' };

describe('reserva en la demo', () => {
  let reservaId = '';
  let folio = '';
  let antes = 0;

  it('sin sesión no se aparta', async () => {
    await expect(
      repoDemo.apartar({ tipo: 'taller', referencia: SLUG, sesionIds: [SESION], participantes: 2, contacto }),
    ).rejects.toMatchObject({ codigo: 'SIN_SESION' });
  });

  it('apartar 2 lugares: $1,600, sin folio, y el cupo baja al instante', async () => {
    antes = (await repoDemo.disponibilidad([SESION]))[0].disponibles ?? 0;
    await repoDemo.registrar({ ...contacto, password: 'secreta123', novedades: false });
    const r = await repoDemo.apartar({ tipo: 'taller', referencia: SLUG, sesionIds: [SESION], participantes: 2, contacto });
    reservaId = r.id;
    expect(r.total).toBe(1600);
    expect(r.estado).toBe('pendiente_pago');
    expect(r.folio).toBeNull();
    expect((await repoDemo.disponibilidad([SESION]))[0].disponibles).toBe(antes - 2);
  });

  it('pago rechazado: no hay folio ni reserva confirmada', async () => {
    await expect(repoDemo.pagar(reservaId, { simulacion: 'rechazado' })).rejects.toMatchObject({ codigo: 'PAGO_RECHAZADO' });
    const r = (await repoDemo.misReservas()).find((x) => x.id === reservaId)!;
    expect(r.estado).toBe('pendiente_pago');
    expect(r.folio).toBeNull();
    expect(r.pago).toBe('fallido');
  });

  it('pago aprobado: folio, confirmada, y pagar otra vez no duplica', async () => {
    const res = await repoDemo.pagar(reservaId, { simulacion: 'aprobado' });
    expect(res.tipo).toBe('confirmado');
    if (res.tipo !== 'confirmado') return;
    folio = res.reserva.folio ?? '';
    expect(folio).toMatch(/^NUMA-\d{5}$/);
    expect(res.reserva.pago).toBe('pagado');
    const otra = await repoDemo.pagar(reservaId, { simulacion: 'aprobado' });
    expect(otra.tipo === 'confirmado' && otra.reserva.folio).toBe(folio);
    expect((await repoDemo.misReservas()).filter((x) => x.id === reservaId)).toHaveLength(1);
  });

  it('el panel ve la misma reserva, un solo pago y sus avisos', async () => {
    await expect(repoAdminDemo.reservas()).rejects.toMatchObject({ codigo: 'SIN_ACCESO' });
    await repoAdminDemo.entrarAdmin(ADMIN_DEMO.email, ADMIN_DEMO.password);
    const r = await repoAdminDemo.reserva(reservaId);
    expect(r?.folio).toBe(folio);
    expect(r?.contacto.email).toBe(contacto.email);
    const pagos = (await repoAdminDemo.pagos()).filter((p) => p.reservaId === reservaId);
    expect(pagos).toHaveLength(1);
    expect(pagos[0].estado).toBe('pagado');
    expect((await repoAdminDemo.avisos(reservaId)).length).toBe(3);
    const sesion = (await repoAdminDemo.agenda('2026-10')).find((s) => s.sesion.id === SESION);
    expect(sesion?.asistentes.some((a) => a.reservaId === reservaId)).toBe(true);
  });
});

describe('catálogo desde el panel', () => {
  const nuevo = {
    titulo: 'Tazas de otoño', resumen: 'Taza de temporada.', categoria: 'temporada' as const, precio: 800,
    foto: 'taller-van-gogh' as const, fecha: '2026-11-07', horarios: [{ inicio: '11:00', fin: '13:00' }], cupo: 2,
  };

  it('crear, editar, desactivar y volver a activar; el sitio lo refleja', async () => {
    const t = await repoAdminDemo.crearTaller(nuevo);
    expect(t.origen).toBe('panel');
    const pub = await repoDemo.taller(t.slug);
    expect(pub?.sesiones[0].cupo).toBe(2);
    expect(pub?.flujo).toBe('taller');

    await repoAdminDemo.editarTaller(t.id, { titulo: 'Tazas de otoño (edición)', precio: 850 });
    const editado = await repoDemo.taller(t.slug);
    expect(editado?.titulo).toBe('Tazas de otoño (edición)');
    expect(editado?.precio).toBe(850);

    await repoAdminDemo.activarTaller(t.id, false);
    expect(await repoDemo.taller(t.slug)).toBeNull();
    await repoAdminDemo.activarTaller(t.id, true);
    expect(await repoDemo.taller(t.slug)).not.toBeNull();
  });

  it('el cupo del taller nuevo se respeta al reservar', async () => {
    const t = (await repoAdminDemo.catalogo()).find((x) => x.titulo.startsWith('Tazas de otoño'))!;
    await expect(
      repoDemo.apartar({ tipo: 'taller', referencia: t.slug, sesionIds: [t.sesiones[0].id], participantes: 3, contacto }),
    ).rejects.toMatchObject({ codigo: 'SIN_CUPO' });
  });

  it('el precio de NUMA Kids no se cambia por fecha', async () => {
    const kids = (await repoAdminDemo.catalogo()).find((x) => x.flujo === 'kids')!;
    await expect(repoAdminDemo.editarTaller(kids.id, { precio: 1 })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });
});
