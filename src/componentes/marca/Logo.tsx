import { LOGO, ICONO } from './trazos';

/**
 * Logotipo completo: "casa" vertical + NU / MA.
 * Toma el color del texto (`currentColor`), así funciona en las seis
 * aplicaciones de color del brandbook (p. 12) sin variantes aparte.
 */
export function Logo({ className = '', titulo = 'Casa Numa' }: { className?: string; titulo?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO.ancho} ${LOGO.alto}`}
      className={className}
      fill="currentColor"
      role="img"
      aria-label={titulo}
    >
      {LOGO.trazos.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Ícono: la U de NUMA. Decorativo salvo que reciba `titulo`. */
export function IconoU({ className = '', titulo }: { className?: string; titulo?: string }) {
  return (
    <svg
      viewBox={`0 0 ${ICONO.ancho} ${ICONO.alto}`}
      className={className}
      fill="currentColor"
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <path d={ICONO.exterior} />
      <path d={ICONO.interior} />
    </svg>
  );
}
