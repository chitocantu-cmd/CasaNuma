import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from './Iconos';

// ---------------------------------------------------------------------------
// Botones y enlaces de acción
// ---------------------------------------------------------------------------
// Píldora de tamaño contenido, texto en versalitas espaciadas. Nada de botones
// gigantes de app: la fotografía es la que grita, el botón acompaña.
// ---------------------------------------------------------------------------

export type Variante = 'primario' | 'secundario' | 'claro' | 'contorno-claro';
type Tamano = 'normal' | 'chico';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-cafe text-crema hover:bg-cafe/[0.88] disabled:bg-cafe/35',
  secundario: 'border border-cafe/35 text-cafe hover:border-cafe hover:bg-cafe hover:text-crema disabled:opacity-40',
  claro: 'bg-crema text-cafe hover:bg-crema/85 disabled:opacity-50',
  'contorno-claro': 'border border-crema/45 text-crema hover:border-crema hover:bg-crema hover:text-cafe',
};

const TAMANOS: Record<Tamano, string> = {
  normal: 'min-h-12 px-6 text-[0.76rem]',
  chico: 'min-h-10 px-5 text-[0.7rem]',
};

export function clasesBoton(variante: Variante = 'primario', tamano: Tamano = 'normal', extra = '') {
  return `group/boton inline-flex items-center justify-center gap-2.5 rounded-full font-medium uppercase tracking-[0.14em] transition-colors duration-media ease-numa disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;
}

function Contenido({ children, flecha }: { children: ReactNode; flecha?: boolean }) {
  return (
    <>
      <span>{children}</span>
      {flecha && (
        <Icono.flecha
          tam={16}
          className="-mr-1 transition-transform duration-media ease-numa group-hover/boton:translate-x-1"
        />
      )}
    </>
  );
}

interface Comunes {
  children: ReactNode;
  variante?: Variante;
  tamano?: Tamano;
  flecha?: boolean;
  className?: string;
}

export function Boton({
  children, variante, tamano, flecha, className = '', type = 'button', ...props
}: Comunes & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={clasesBoton(variante, tamano, className)} {...props}>
      <Contenido flecha={flecha}>{children}</Contenido>
    </button>
  );
}

export function BotonEnlace({
  children, to, variante, tamano, flecha, className = '', state,
}: Comunes & { to: string; state?: unknown }) {
  return (
    <Link to={to} state={state} className={clasesBoton(variante, tamano, className)}>
      <Contenido flecha={flecha}>{children}</Contenido>
    </Link>
  );
}

/** Enlace a otro sitio (WhatsApp, Maps, Instagram): abre en pestaña nueva. */
export function BotonExterno({
  children, href, variante, tamano, flecha, className = '', icono,
}: Comunes & { href: string; icono?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clasesBoton(variante, tamano, className)}>
      {icono}
      <Contenido flecha={flecha}>{children}</Contenido>
    </a>
  );
}

/** Enlace de texto con subrayado que se dibuja y flecha que avanza. */
export function EnlaceFlecha({
  children, to, className = '',
}: { children: ReactNode; to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={`group/enlace inline-flex items-center gap-2 text-[0.76rem] font-medium uppercase tracking-[0.14em] ${className}`}
    >
      <span className="subrayado-fijo pb-1">{children}</span>
      <Icono.flecha tam={15} className="transition-transform duration-media ease-numa group-hover/enlace:translate-x-1" />
    </Link>
  );
}
