// ---------------------------------------------------------------------------
// Rutas de imágenes de /public
// ---------------------------------------------------------------------------
// En el sitio normal se sirven tal cual. En la presentación de un solo archivo
// (npm run presentacion) no hay servidor: dev/presentacion.mjs incrusta las
// imágenes como data: URIs en window.__NUMA_RECURSOS__ y aquí se resuelven.
// ---------------------------------------------------------------------------

const incrustados = (globalThis as { __NUMA_RECURSOS__?: Record<string, string> }).__NUMA_RECURSOS__;

/** true en la presentación de un solo archivo. */
export const embebido = Boolean(incrustados);

export function recurso(ruta: string): string {
  return incrustados?.[ruta] ?? ruta;
}
