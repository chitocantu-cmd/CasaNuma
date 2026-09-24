import type { ReactNode } from 'react';
import { enlaceWhatsapp, mostrarPendientes } from '../../config/site';
import { clasesBoton, type Variante } from './Boton';
import { Icono } from './Iconos';

/**
 * Botón a WhatsApp con mensaje precargado.
 *
 * Sin número configurado no inventa uno: en desarrollo se ve el botón
 * deshabilitado con la nota de qué falta; en producción muestra `sinNumero`
 * (otra vía de contacto) o nada.
 */
export default function CtaWhatsapp({
  mensaje,
  children,
  variante = 'primario',
  className = '',
  sinNumero = null,
}: {
  mensaje: string;
  children: ReactNode;
  variante?: Variante;
  className?: string;
  sinNumero?: ReactNode;
}) {
  const href = enlaceWhatsapp(mensaje);

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={clasesBoton(variante, 'normal', className)}>
        <Icono.whatsapp tam={18} className="-ml-1" />
        <span>{children}</span>
      </a>
    );
  }

  if (!mostrarPendientes) return <>{sinNumero}</>;

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" disabled className={clasesBoton(variante, 'normal', `${className} opacity-60`)}>
        <Icono.whatsapp tam={18} className="-ml-1" />
        <span>{children}</span>
      </button>
      <span className="text-[0.72rem] text-indigo">
        Falta el número oficial de WhatsApp para activar este botón.
      </span>
    </span>
  );
}
