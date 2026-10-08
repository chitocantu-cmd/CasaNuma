import { describe, expect, it } from 'vitest';

// Pinta tu pieza se reserva con el 50 % del valor de la pieza. Nada del
// esquema anterior (un anticipo fijo de $100) debe volver, y el anticipo
// nunca se presenta como descuento ni oferta.
const PROHIBIDO: [RegExp, string][] = [
  [/reservationDeposit/, 'reservationDeposit (anticipo fijo)'],
  [/Reserv\w*\s*(con|·)\s*\$\s?100\b/i, '«Reserva con $100» / «Reservar · $100»'],
  [/\$\s?100\s*(MXN)?\s*de\s*(reserva|anticipo)/i, '«$100 de reserva»'],
  [/anticipo\s+fijo/i, 'anticipo fijo'],
  [/50\s*%\s*de\s*descuento/i, '«50 % de descuento»'],
  [/mitad\s+de\s+precio/i, '«mitad de precio»'],
  [/oferta\s*50/i, '«oferta 50 %»'],
];

// Todo el código del sitio como texto (sin este archivo, que nombra lo prohibido).
const archivos = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}', '!/src/contenido/textos.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('textos de Pinta tu pieza', () => {
  it('ningún archivo del sitio trae el anticipo fijo de $100 ni llama descuento al 50 %', () => {
    expect(Object.keys(archivos).length).toBeGreaterThan(50);
    const hallazgos: string[] = [];
    for (const [f, texto] of Object.entries(archivos)) {
      for (const [patron, nombre] of PROHIBIDO) if (patron.test(texto)) hallazgos.push(`${f}: ${nombre}`);
    }
    expect(hallazgos).toEqual([]);
  });
});
