import { useEffect, useState } from 'react';

/**
 * Estado que sobrevive a recargar la página (sessionStorage): lo que alguien
 * eligió en un checkout no se pierde por un refresh accidental. Se borra
 * solo al cerrar la pestaña. Sin almacenamiento, funciona como useState.
 */
export function useBorrador<T>(clave: string, inicial: T | (() => T)) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const crudo = sessionStorage.getItem(`numa:borrador:${clave}`);
      if (crudo !== null) return JSON.parse(crudo) as T;
    } catch {
      /* sin almacenamiento o dato viejo */
    }
    return typeof inicial === 'function' ? (inicial as () => T)() : inicial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(`numa:borrador:${clave}`, JSON.stringify(valor));
    } catch {
      /* sin almacenamiento */
    }
  }, [clave, valor]);

  return [valor, setValor] as const;
}

/** Al confirmarse una reserva, su borrador ya no sirve. */
export function borrarBorrador(clave: string) {
  try {
    sessionStorage.removeItem(`numa:borrador:${clave}`);
  } catch {
    /* sin almacenamiento */
  }
}
