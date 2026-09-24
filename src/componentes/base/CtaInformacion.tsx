import { enlaceInstagramDM, enlaceWhatsapp, mostrarPendientes } from '../../config/site';
import { clasesBoton, type Variante } from './Boton';
import { Icono } from './Iconos';

/**
 * "Solicitar información" para lo que no se cobra en línea (precio "Info DM").
 *
 * Abre WhatsApp con el mensaje listo; si no hay número, un mensaje directo de
 * Instagram. Sin ninguno de los dos no inventa un contacto: en desarrollo
 * avisa qué falta y en producción no se muestra.
 */
export default function CtaInformacion({
  mensaje,
  texto = 'Solicitar información',
  variante = 'primario',
  tamano = 'normal',
  className = '',
}: {
  mensaje: string;
  texto?: string;
  variante?: Variante;
  tamano?: 'normal' | 'chico';
  className?: string;
}) {
  const whatsapp = enlaceWhatsapp(mensaje);
  const dm = enlaceInstagramDM();
  const href = whatsapp ?? dm;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={clasesBoton(variante, tamano, className)}>
        {whatsapp ? <Icono.whatsapp tam={17} className="-ml-1" /> : <Icono.instagram tam={17} className="-ml-1" />}
        <span>{texto}</span>
      </a>
    );
  }

  if (!mostrarPendientes) return null;

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" disabled className={clasesBoton(variante, tamano, `${className} opacity-60`)}>
        <Icono.whatsapp tam={17} className="-ml-1" />
        <span>{texto}</span>
      </button>
      <span className="text-[0.72rem] text-indigo">Falta el WhatsApp o el Instagram oficial para activar este botón.</span>
    </span>
  );
}
