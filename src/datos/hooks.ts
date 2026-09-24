import { useCallback, useEffect, useRef, useState } from 'react';
import { repo } from '.';
import type { MesMembresia, Producto, Reserva, Sesion, Taller } from './tipos';

// ---------------------------------------------------------------------------
// Lectura de datos con caché breve en memoria
// ---------------------------------------------------------------------------
// Al ir de Inicio a Talleres y regresar, lo ya cargado se muestra al instante
// y se revalida detrás. Sin librería: el sitio lee cinco cosas, no cincuenta.
// ---------------------------------------------------------------------------

const cache = new Map<string, unknown>();

export interface Consulta<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

export function useConsulta<T>(clave: string | null, cargar: () => Promise<T>): Consulta<T> {
  const [datos, setDatos] = useState<T | null>(() => (clave ? (cache.get(clave) as T) ?? null : null));
  const [cargando, setCargando] = useState(clave !== null && !cache.has(clave));
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    if (!clave) return;
    let vivo = true;
    setDatos((cache.get(clave) as T) ?? null);
    if (!cache.has(clave)) setCargando(true);
    cargarRef.current()
      .then((d) => {
        if (!vivo) return;
        cache.set(clave, d);
        setDatos(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No pudimos cargar la información.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [clave, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, cargando, error, recargar };
}

/** Tras reservar, lo que dependía del cupo debe volver a pedirse. */
export function invalidarCupos() {
  for (const k of [...cache.keys()]) {
    if (/^(talleres|taller:|membresia|kids|reservas|admin)/.test(k)) cache.delete(k);
  }
}

export const useTalleres = () => useConsulta<Taller[]>('talleres', () => repo.talleres());
export const useTaller = (slug: string | undefined) =>
  useConsulta<Taller | null>(slug ? `taller:${slug}` : null, () => repo.taller(slug ?? ''));
export const useMesesMembresia = () => useConsulta<MesMembresia[]>('membresia', () => repo.mesesMembresia());
export const useSesionesKids = () => useConsulta<Sesion[]>('kids', () => repo.sesionesKids());
export const useProductos = () => useConsulta<Producto[]>('productos', () => repo.productos());
export const useProducto = (slug: string | undefined) =>
  useConsulta<Producto | null>(slug ? `producto:${slug}` : null, () => repo.producto(slug ?? ''));
export const useMisReservas = (usuarioId: string | null) =>
  useConsulta<Reserva[]>(usuarioId ? `reservas:${usuarioId}` : null, () => repo.misReservas());
