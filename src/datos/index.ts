import { fuenteDatos } from '../config/site';
import { repoDemo } from './demo/repoDemo';
import { ErrorDatos, type Repositorio } from './repositorio';

export { ErrorDatos } from './repositorio';
export type { Repositorio } from './repositorio';

/**
 * Pendiente de integración: el backend real (Supabase + Stripe) ya existe en
 * supabase/, pero todavía no cubre membresía, NUMA Kids, tienda ni cuentas de
 * clientas. Mientras no se implemente `repoSupabase`, pedirlo falla con un
 * mensaje claro en vez de mezclar datos reales con simulados.
 * Ver docs/INTEGRACION.md.
 */
const noConectado: Repositorio = new Proxy({} as Repositorio, {
  get: () => () =>
    Promise.reject(
      new ErrorDatos('NO_CONECTADO', 'El sitio todavía no está conectado al sistema de reservas. Intenta más tarde.'),
    ),
});

export const repo: Repositorio = fuenteDatos === 'demo' ? repoDemo : noConectado;
