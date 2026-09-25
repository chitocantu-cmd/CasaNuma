import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Sesion } from '../datos/tipos';
import { claveMes, etiquetaMes, rango, sumarDias, sumarMeses } from './calendario';
import { maximoPersonas, pocosLugares, sinLugar, textoLugares } from './cupo';
import { correoValido, pesosCortos, soloDigitos } from './formato';
import { slugTaller, validarTallerNuevo } from '../datos/catalogo';

// Hoy fijo: 25 sep 2026, antes de la agenda de octubre.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-25T12:00:00-06:00'));
});
afterAll(() => vi.useRealTimers());

const sesion = (x: Partial<Sesion>): Sesion => ({
  id: 's', fecha: '2026-10-03', inicio: '16:00', fin: null, cupo: 16, disponibles: 16, agotada: false, ...x,
});

describe('cupo', () => {
  it('cuenta lugares solo con cupo confirmado', () => {
    expect(textoLugares(sesion({}))).toBe('16 lugares');
    expect(textoLugares(sesion({ cupo: null, disponibles: null }))).toBe('Cupo limitado');
    expect(textoLugares(sesion({ disponibles: 1 }))).toBe('Solo queda 1 lugar');
    expect(textoLugares(sesion({ disponibles: 3 }))).toBe('Solo quedan 3 lugares');
  });

  it('agotado y fecha pasada no dejan reservar', () => {
    expect(sinLugar(sesion({ disponibles: 0 }))).toBe(true);
    expect(sinLugar(sesion({ agotada: true }))).toBe(true);
    expect(sinLugar(sesion({ fecha: '2026-09-20' }))).toBe(true);
    expect(textoLugares(sesion({ fecha: '2026-09-20' }))).toBe('Ya pasó');
    expect(pocosLugares(sesion({ disponibles: 2 }))).toBe(true);
  });

  it('el máximo de personas respeta el tope y los lugares libres', () => {
    expect(maximoPersonas(sesion({}), 6)).toBe(6);
    expect(maximoPersonas(sesion({ disponibles: 2 }), 6)).toBe(2);
    expect(maximoPersonas(sesion({ cupo: null, disponibles: null }), 6)).toBe(6);
    expect(maximoPersonas(null, 6)).toBe(6);
  });
});

describe('calendario y formato', () => {
  it('fechas sin pasar por UTC', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(claveMes('2026-10-03')).toBe('2026-10');
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(etiquetaMes('2026-10')).toBe('octubre 2026');
    expect(rango('16:00', null)).toBe('4:00 p.m.');
  });

  it('valida correo y teléfono sin bloquear de más', () => {
    expect(correoValido('ana@correo.com')).toBe(true);
    expect(correoValido('ana@correo')).toBe(false);
    expect(soloDigitos('81 2594-5907')).toBe('8125945907');
    expect(pesosCortos(1600)).toContain('1,600');
  });
});

describe('catálogo del panel', () => {
  it('slug como los de la agenda', () => {
    expect(slugTaller('Tazas de Otoño', '2026-11-07')).toBe('tazas-de-otono-07-nov');
  });

  const nuevo = {
    titulo: 'Tazas de otoño', resumen: 'Taza de temporada.', categoria: 'temporada' as const, precio: 800,
    foto: 'taller-van-gogh' as const, fecha: '2026-11-07', horarios: [{ inicio: '11:00', fin: '13:00' }], cupo: 16,
  };

  it('acepta un taller completo', () => {
    expect(() => validarTallerNuevo(nuevo)).not.toThrow();
  });

  it('rechaza fechas pasadas, horarios al revés, precio 0 y cupo 0', () => {
    expect(() => validarTallerNuevo({ ...nuevo, fecha: '2026-09-01' })).toThrow(/ya pasó/);
    expect(() => validarTallerNuevo({ ...nuevo, horarios: [{ inicio: '13:00', fin: '11:00' }] })).toThrow(/término/);
    expect(() => validarTallerNuevo({ ...nuevo, precio: 0 })).toThrow(/precio/);
    expect(() => validarTallerNuevo({ ...nuevo, cupo: 0 })).toThrow(/cupo/);
    expect(() => validarTallerNuevo({ ...nuevo, titulo: ' ' })).toThrow(/nombre/);
  });
});
