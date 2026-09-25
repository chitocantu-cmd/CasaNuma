import { fuenteDatos } from '../config/site';
import { repoAdminDemo, repoDemo } from './demo/repoDemo';
import type { Repositorio, RepositorioAdmin } from './repositorio';

export { ErrorDatos } from './repositorio';
export type { Repositorio, RepositorioAdmin } from './repositorio';

/**
 * El backend real se descarga solo cuando se usa: con la demo, el cliente
 * de Supabase no entra al bundle. Los componentes no notan la diferencia:
 * todos los métodos ya son asíncronos.
 */
function perezoso<T extends object>(cargar: () => Promise<T>): T {
  let modulo: Promise<T> | null = null;
  return new Proxy({} as T, {
    get: (_, metodo) =>
      async (...args: unknown[]) => {
        const real = await (modulo ??= cargar());
        return (real[metodo as keyof T] as (...a: unknown[]) => unknown)(...args);
      },
  });
}

const supabase = () => import('./supabase/repoSupabase');

/** Sitio público y Mi cuenta. VITE_FUENTE_DATOS elige demo o Supabase (ver docs/INTEGRACION.md). */
export const repo: Repositorio =
  fuenteDatos === 'demo' ? repoDemo : perezoso(() => supabase().then((m) => m.repoSupabase));
/** Panel de Casa Numa. Exige sesión con rol 'admin' en cada llamada. */
export const repoAdmin: RepositorioAdmin =
  fuenteDatos === 'demo' ? repoAdminDemo : perezoso(() => supabase().then((m) => m.repoAdminSupabase));
