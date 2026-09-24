import type { ReactNode } from 'react';
import CeramicShape, { type NombreSilueta } from './marca/CeramicShape';
import Revelar from './base/Revelar';

/**
 * Encabezado de sección: número en Bebas, etiqueta espaciada, titular en
 * Ivy Mode y una entrada opcional. El número da ritmo editorial al recorrido
 * (01 · Portafolio, 02 · Experiencias…), como las páginas de una revista.
 */
export default function SectionHeading({
  numero,
  eyebrow,
  titulo,
  intro,
  como: Etiqueta = 'h2',
  alineacion = 'izquierda',
  silueta,
  claro = false,
  tamano = 't1',
  className = '',
}: {
  numero?: string;
  eyebrow: string;
  titulo: ReactNode;
  intro?: ReactNode;
  como?: 'h1' | 'h2' | 'h3';
  alineacion?: 'izquierda' | 'centro';
  silueta?: NombreSilueta;
  claro?: boolean;
  tamano?: 'hero' | 't1' | 't2';
  className?: string;
}) {
  const centro = alineacion === 'centro';
  const tono = claro ? 'text-crema' : 'text-cafe';
  const tamanoTitulo = { hero: 'text-hero', t1: 'text-t1', t2: 'text-t2' }[tamano];

  return (
    <Revelar className={`${centro ? 'mx-auto text-center' : ''} ${className}`}>
      <div className={`flex items-center gap-4 ${centro ? 'justify-center' : ''} ${claro ? 'text-crema/75' : 'text-cafe/70'}`}>
        {numero && <span className="cifra text-[1.35rem] leading-none tracking-[0.04em]">{numero}</span>}
        {numero && <span className={`h-px w-10 ${claro ? 'bg-crema/40' : 'bg-cafe/30'}`} aria-hidden="true" />}
        <span className="eyebrow">{eyebrow}</span>
        {silueta && <CeramicShape nombre={silueta} className="h-5 w-auto" />}
      </div>
      <Etiqueta
        className={`mt-6 font-display font-light ${tamanoTitulo} ${tono} ${centro ? 'mx-auto' : ''} max-w-[18ch]`}
      >
        {titulo}
      </Etiqueta>
      {intro && (
        <div
          className={`mt-7 max-w-lectura text-cuerpo-l ${claro ? 'text-crema/80' : 'text-cafe/80'} ${centro ? 'mx-auto' : ''}`}
        >
          {intro}
        </div>
      )}
    </Revelar>
  );
}
