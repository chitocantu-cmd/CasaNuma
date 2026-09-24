import type { AnchorHTMLAttributes, MouseEvent } from 'react';

/**
 * Enlace a una sección de la misma página. Desplaza con JavaScript en vez de
 * cambiar el #: así funciona igual con rutas normales y con las rutas con #
 * de la presentación de un solo archivo.
 */
export default function EnlaceAncla({
  destino, onClick, ...props
}: { destino: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  function ir(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    const el = document.getElementById(destino);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return <a href={`#${destino}`} onClick={ir} {...props} />;
}
