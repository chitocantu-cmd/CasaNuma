import { useEffect, type RefObject } from 'react';

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mientras un modal está abierto, Tab y Shift+Tab dan la vuelta dentro de
 * él: el foco no se escapa a la página de atrás. Al cerrarse, el foco vuelve
 * al elemento que lo abrió.
 */
export function useAtraparFoco(ref: RefObject<HTMLElement>, activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const previo = document.activeElement as HTMLElement | null;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const lista = [...ref.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      previo?.focus?.();
    };
  }, [ref, activo]);
}
