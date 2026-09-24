import { useState } from 'react';
import { FOTOS, REFERENCIAS, type EntradaFoto, type IdFoto, type Tono } from '../../contenido/fotos';
import { mostrarPendientes } from '../../config/site';
import CeramicShape from '../marca/CeramicShape';
import { embebido, recurso } from '../../lib/recursos';

// ---------------------------------------------------------------------------
// <Foto>: la única manera de poner una fotografía en el sitio.
// ---------------------------------------------------------------------------
// El contenedor decide la proporción (aspect-*) y la forma (rounded-arco…);
// la imagen siempre lo llena con object-cover. Si la foto definitiva todavía
// no existe, dibuja un marcador con la silueta NUMA en vez de un hueco.
// ---------------------------------------------------------------------------

// Base crema opaca + tinte: el marcador se ve igual sobre fondo claro u oscuro.
const TINTES: Record<Tono, { fondo: string; silueta: string }> = {
  terracota: { fondo: 'bg-terracota/20', silueta: 'text-terracota/55' },
  crema: { fondo: 'bg-cafe/[0.06]', silueta: 'text-terracota/40' },
  amarillo: { fondo: 'bg-amarillo/25', silueta: 'text-amarillo' },
  verde: { fondo: 'bg-verde/20', silueta: 'text-verde' },
  indigo: { fondo: 'bg-indigo/[0.14]', silueta: 'text-indigo/55' },
  naranja: { fondo: 'bg-naranja/20', silueta: 'text-naranja/80' },
};

function srcsetReferencia(ref: keyof typeof REFERENCIAS) {
  const anchos = REFERENCIAS[ref];
  // En la presentación de un solo archivo va incrustado un tamaño por foto.
  if (embebido) {
    return { src: recurso(`/fotos/referencia/${ref}-${anchos[Math.min(1, anchos.length - 1)]}.webp`), srcSet: undefined };
  }
  return {
    src: `/fotos/referencia/${ref}-${anchos[Math.min(1, anchos.length - 1)]}.webp`,
    srcSet: anchos.map((w) => `/fotos/referencia/${ref}-${w}.webp ${w}w`).join(', '),
  };
}

/** Foto definitiva: varios anchos en /public, o una sola ruta/URL. */
function srcsetFoto(src: string, anchos?: readonly number[]) {
  if (!anchos?.length) return { src, srcSet: undefined };
  const media = `${src}-${anchos[Math.min(1, anchos.length - 1)]}.webp`;
  if (embebido) return { src: recurso(media), srcSet: undefined };
  return { src: media, srcSet: anchos.map((w) => `${src}-${w}.webp ${w}w`).join(', ') };
}

export default function Foto({
  id,
  foto: fotoDirecta,
  className = '',
  sizes = '100vw',
  prioridad = false,
  zoom = false,
}: {
  id?: IdFoto;
  foto?: EntradaFoto;
  className?: string;
  /** Atributo sizes de la imagen: cuánto ocupa en pantalla. */
  sizes?: string;
  /** La foto principal visible al cargar: sin lazy y con prioridad alta. */
  prioridad?: boolean;
  /** Zoom editorial al pasar el cursor por el contenedor. */
  zoom?: boolean;
}) {
  const foto: EntradaFoto | undefined = fotoDirecta ?? (id ? FOTOS[id] : undefined);
  const [fallo, setFallo] = useState(false);
  if (!foto) return null;

  const tono = foto.tono ?? 'crema';
  const base = `relative isolate overflow-hidden ${zoom ? 'zoom-suave' : ''} ${className}`;

  // 1 · Foto definitiva
  // 2 · Referencia del brandbook (solo fuera de producción)
  const fuente =
    foto.src && !fallo
      ? srcsetFoto(foto.src, foto.anchos)
      : mostrarPendientes && foto.referencia
        ? srcsetReferencia(foto.referencia)
        : null;

  if (fuente) {
    const esReferencia = !foto.src;
    return (
      <div className={`${base} bg-cafe/10`}>
        <img
          src={fuente.src}
          srcSet={fuente.srcSet}
          sizes={sizes}
          alt={foto.alt}
          loading={prioridad ? 'eager' : 'lazy'}
          decoding="async"
          // React 18 no conoce fetchPriority: va en minúsculas, como atributo HTML
          {...{ fetchpriority: prioridad ? 'high' : undefined }}
          onError={() => setFallo(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={foto.posicion ? { objectPosition: foto.posicion } : undefined}
        />
        {esReferencia && (
          <span
            className="eyebrow absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-crema/90 px-2.5 py-1 text-[0.56rem] tracking-[0.16em] text-cafe"
            title={`Foto de referencia, no es de Casa Numa. Sustituir por: ${foto.encuadre}`}
          >
            Referencia
          </span>
        )}
      </div>
    );
  }

  // 3 · Marcador: silueta NUMA sobre textura
  const tinte = TINTES[tono];
  return (
    <div className={`${base} bg-crema`} role="img" aria-label={foto.alt}>
      <div className={`absolute inset-0 ${tinte.fondo}`} aria-hidden="true" />
      <div
        className="absolute inset-0 opacity-25 mix-blend-multiply"
        style={{ backgroundImage: `url('${recurso('/texturas/lino.webp')}')`, backgroundSize: '300px' }}
        aria-hidden="true"
      />
      <CeramicShape
        nombre={foto.silueta ?? 'jarron'}
        color={tinte.silueta}
        className="absolute left-1/2 top-[44%] h-[34%] max-h-64 w-auto max-w-[46%] -translate-x-1/2 -translate-y-1/2"
      />
      {/* La leyenda va al centro, lejos de las esquinas: en un arco o una U
          las esquinas se recortan. */}
      {mostrarPendientes && (
        <span className="absolute inset-x-[12%] top-[66%] z-10 line-clamp-4 text-center text-[0.66rem] leading-snug text-cafe/75">
          <span className="eyebrow mb-1 block text-[0.54rem] text-indigo">Foto pendiente</span>
          {foto.encuadre}
        </span>
      )}
    </div>
  );
}
