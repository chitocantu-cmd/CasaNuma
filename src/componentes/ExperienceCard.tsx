import { Link } from 'react-router-dom';
import type { IdFoto } from '../contenido/fotos';
import Foto from './base/Foto';
import { Icono } from './base/Iconos';
import CeramicShape, { type NombreSilueta } from './marca/CeramicShape';

/**
 * Tarjeta de experiencia: la foto manda. Toda la tarjeta es un solo enlace
 * (un botón dentro de un enlace sería HTML inválido y en móvil se pelean
 * por el toque); el "CTA" es la última línea, con su flecha.
 */
export default function ExperienceCard({
  numero, titulo, frase, detalle, cta, to, foto, silueta, forma = 'rounded-foto',
}: {
  numero: string;
  titulo: string;
  frase: string;
  detalle?: string;
  cta: string;
  to: string;
  foto: IdFoto;
  silueta: NombreSilueta;
  forma?: string;
}) {
  return (
    <Link to={to} className="group flex h-full flex-col">
      <div className="relative">
        <Foto id={foto} className={`aspect-[3/4] w-full ${forma}`} sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 82vw" zoom />
        <CeramicShape
          nombre={silueta}
          className="absolute -bottom-5 right-5 h-12 w-auto transition-transform duration-lenta ease-numa group-hover:-translate-y-1.5 group-hover:rotate-[-4deg]"
        />
      </div>
      <div className="flex flex-1 flex-col pt-7">
        <p className="flex items-center gap-3 text-cafe/65">
          <span className="cifra text-[1.2rem] leading-none">{numero}</span>
          <span className="h-px w-8 bg-cafe/25" aria-hidden="true" />
          {detalle && <span className="text-[0.74rem]">{detalle}</span>}
        </p>
        <h3 className="mt-4 font-display text-t3 font-light text-cafe transition-colors duration-media group-hover:text-terracota">
          {titulo}
        </h3>
        <p className="mt-3 max-w-[30ch] text-cuerpo text-cafe/80">{frase}</p>
        <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[0.74rem] font-medium uppercase tracking-[0.14em] text-cafe">
          <span className="subrayado-fijo pb-1">{cta}</span>
          <Icono.flecha tam={15} className="transition-transform duration-media ease-numa group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
