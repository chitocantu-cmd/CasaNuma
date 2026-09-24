import { SILUETAS, type NombreSilueta } from './trazos';

export type { NombreSilueta };

/**
 * Silueta de pieza NUMA (brandbook p. 26).
 *
 * Se usa como acento: junto a un título, en un separador, en el footer o como
 * marcador de una foto que falta. Nunca como ilustración protagonista.
 * Por defecto conserva el color con el que aparece en el brandbook.
 */
export default function CeramicShape({
  nombre,
  color,
  className = '',
}: {
  nombre: NombreSilueta;
  /** Clase de color de Tailwind ("text-verde"). Sin ella, color del brandbook. */
  color?: string;
  className?: string;
}) {
  const s = SILUETAS[nombre];
  return (
    <svg
      viewBox={`0 0 ${s.ancho} ${s.alto}`}
      className={`${color ?? ''} ${className}`}
      fill={color ? 'currentColor' : s.color}
      aria-hidden="true"
      focusable="false"
    >
      <path d={s.d} />
    </svg>
  );
}
