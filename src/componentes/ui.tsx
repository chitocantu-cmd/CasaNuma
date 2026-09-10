import { useState } from 'react';
import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Iconos en línea. El demo cargaba lucide-react entero para usar cinco iconos;
// aquí van como SVG directo y ahorran una dependencia completa.
// ---------------------------------------------------------------------------
const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const Icono = {
  menu: (p: { size?: number }) => (
    <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" {...trazo} aria-hidden="true">
      <path d="M4 5h16M4 12h16M4 19h16" />
    </svg>
  ),
  cerrar: (p: { size?: number }) => (
    <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" {...trazo} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  mas: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" {...trazo} aria-hidden="true">
      <path d="M5 12h14M12 5v14" />
    </svg>
  ),
  menos: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" {...trazo} aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  ),
  flecha: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" {...trazo} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
type Variante = 'primario' | 'secundario';

const estilos: Record<Variante, string> = {
  primario:
    'bg-tinta text-crema hover:bg-terracota disabled:bg-tinta/30',
  secundario:
    'border border-tinta/25 text-tinta hover:border-tinta disabled:opacity-40',
};

const base =
  'inline-flex items-center justify-center gap-2 px-6 py-3 text-[0.92rem] font-semibold transition-colors duration-300 ease-casa disabled:cursor-not-allowed';

export function Boton({
  children,
  variante = 'primario',
  className = '',
  ...props
}: {
  children: ReactNode;
  variante?: Variante;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${estilos[variante]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function BotonEnlace({
  children,
  to,
  variante = 'primario',
  className = '',
}: {
  children: ReactNode;
  to: string;
  variante?: Variante;
  className?: string;
}) {
  return (
    <Link to={to} className={`${base} ${estilos[variante]} ${className}`}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Campos de formulario
// ---------------------------------------------------------------------------
function Etiqueta({
  id, label, requerido, ayuda,
}: { id: string; label: string; requerido?: boolean; ayuda?: string }) {
  return (
    <span className="mb-1 flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="dato text-tinta/55">
        {label}
        {requerido && <span className="text-terracota"> *</span>}
      </label>
      {ayuda && (
        <span className="text-[0.7rem] normal-case tracking-normal text-tinta/40">
          {ayuda}
        </span>
      )}
    </span>
  );
}

const campoBase =
  'w-full border-b border-tinta/25 bg-transparent pb-2 text-[1rem] text-tinta outline-none transition-colors placeholder:text-tinta/30 focus:border-terracota';

export function Campo({
  label, id, requerido, ayuda, ...props
}: {
  label: string;
  id: string;
  requerido?: boolean;
  ayuda?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col">
      <Etiqueta id={id} label={label} requerido={requerido} ayuda={ayuda} />
      <input id={id} name={id} required={requerido} className={campoBase} {...props} />
    </div>
  );
}

export function AreaTexto({
  label, id, requerido, ayuda, ...props
}: {
  label: string;
  id: string;
  requerido?: boolean;
  ayuda?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col">
      <Etiqueta id={id} label={label} requerido={requerido} ayuda={ayuda} />
      <textarea id={id} name={id} required={requerido} rows={4} className={`${campoBase} resize-none`} {...props} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marcador de imagen
// ---------------------------------------------------------------------------
// Las 38 fotos del sitio todavía no existen. En vez de romper el diseño con
// imágenes rotas, se dibuja un marcador con el encuadre que hace falta — así
// también sirve de brief para la sesión de fotos.
// ---------------------------------------------------------------------------
const TONOS: Record<string, string> = {
  terracota: 'from-terracota/25 to-arcilla/20',
  olivo: 'from-olivo/25 to-olivo/10',
  arcilla: 'from-arcilla/30 to-arcilla/10',
  azul: 'from-[#8FA1CE]/25 to-[#8FA1CE]/10',
};

export function ImagenPendiente({
  encuadre, tono = 'terracota', className = '', alt,
}: {
  encuadre: string;
  tono?: string | null;
  className?: string;
  alt?: string;
}) {
  const degradado = TONOS[tono ?? 'terracota'] ?? TONOS.terracota;
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${degradado} ${className}`}
      role="img"
      aria-label={alt ?? encuadre}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_22%_18%,rgba(251,249,245,0.35)_0%,transparent_58%)]" />
      <span className="absolute bottom-0 left-0 right-0 bg-tinta/25 px-3 py-2 text-[0.62rem] leading-snug tracking-[0.08em] text-crema/90 backdrop-blur-[1px]">
        Foto pendiente — {encuadre}
      </span>
    </div>
  );
}

/**
 * Imagen de taller que cae al marcador si no carga.
 *
 * Las rutas /images/... del catalogo original apuntan a fotos que todavia no
 * existen, y una imagen rota se ve peor que un marcador. Tambien cubre el caso
 * de una URL de Cloudinary que falle: el diseno nunca se rompe por una foto.
 */
export function ImagenTaller({
  src, alt, encuadre, tono, className = '',
}: {
  src: string | null;
  alt: string;
  encuadre: string;
  tono?: string | null;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!src || fallo) {
    return <ImagenPendiente encuadre={encuadre} tono={tono} alt={alt} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      onError={() => setFallo(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'info'; children: ReactNode }) {
  const estilo =
    tipo === 'error'
      ? 'border-terracota/40 bg-terracota/8 text-terracota'
      : 'border-tinta/20 bg-tinta/5 text-tinta/70';
  return (
    <p role={tipo === 'error' ? 'alert' : undefined} className={`border px-4 py-3 text-[0.88rem] ${estilo}`}>
      {children}
    </p>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="contenedor py-32 text-center">
      <p className="dato text-tinta/45">{texto}</p>
    </div>
  );
}
