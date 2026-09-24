import type { SVGProps } from 'react';

// ---------------------------------------------------------------------------
// Pictogramas NUMA
// ---------------------------------------------------------------------------
// Trazo fino con puntas redondas, dibujados para este sitio: piezas, manos,
// barro, horno. Nada de iconos corporativos genéricos ni emojis.
// ---------------------------------------------------------------------------

type P = SVGProps<SVGSVGElement> & { tam?: number };

function Base({ tam = 24, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...p}
    >
      {children}
    </svg>
  );
}

export const Icono = {
  flecha: (p: P) => <Base {...p}><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" /></Base>,
  flechaIzq: (p: P) => <Base {...p}><path d="M20 12H5M10.5 6.5 5 12l5.5 5.5" /></Base>,
  flechaDiagonal: (p: P) => <Base {...p}><path d="M7 17 17 7M9 7h8v8" /></Base>,
  cerrar: (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>,
  menu: (p: P) => <Base {...p}><path d="M3.5 8h17M3.5 16h11" /></Base>,
  mas: (p: P) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>,
  menos: (p: P) => <Base {...p}><path d="M5 12h14" /></Base>,
  check: (p: P) => <Base {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>,
  usuario: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" />
    </Base>
  ),
  instagram: (p: P) => (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
    </Base>
  ),
  whatsapp: (p: P) => (
    <Base {...p}>
      <path d="M4.2 19.8 5.3 16A8.2 8.2 0 1 1 8.2 19l-4 .8Z" />
      <path d="M9.2 8.6c.2-.4.5-.5.8-.4l.6 1.4c.1.3 0 .5-.2.7l-.4.4c.5 1.1 1.4 2 2.5 2.5l.4-.4c.2-.2.4-.3.7-.2l1.4.6c.2.3.1.6-.3.9-.6.5-1.5.6-2.3.2a7.4 7.4 0 0 1-3.6-3.6c-.4-.8-.2-1.6.4-2.1Z" />
    </Base>
  ),
  calendario: (p: P) => (
    <Base {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth={2} />
    </Base>
  ),
  reloj: (p: P) => (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  ),
  personas: (p: P) => (
    <Base {...p}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.7-3 2.8-4.6 5.5-4.6s4.8 1.6 5.5 4.6" />
      <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.6c1.6.6 2.7 2 3 4.4" />
    </Base>
  ),
  pin: (p: P) => (
    <Base {...p}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </Base>
  ),
  candado: (p: P) => (
    <Base {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </Base>
  ),
  salir: (p: P) => <Base {...p}><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l4-4-4-4M14 12H4" /></Base>,

  // --- Pictogramas de inclusiones (membresía, kids, talleres) ---------------
  /** Bola de barro. */
  arcilla: (p: P) => (
    <Base {...p}>
      <path d="M5 15.5c-.6-4 2.2-8 6.6-8.4 4.6-.4 7.9 2.8 7.5 7-.3 3.3-3.2 5.4-7.4 5.4-3.6 0-6.3-1.5-6.7-4Z" />
      <path d="M9 11.5c1-.8 2.4-1.1 3.6-.7M8.5 15c1.4.8 3.3 1 5 .4" />
    </Base>
  ),
  /** Estiques y herramientas. */
  herramientas: (p: P) => (
    <Base {...p}>
      <path d="M5 19 15.5 8.5" />
      <path d="M15.5 8.5c.6-2.2 2-3.8 4-4-.2 2-1.8 3.4-4 4Z" />
      <path d="M19 19 9 9" />
      <circle cx="7.5" cy="7.5" r="2.1" />
    </Base>
  ),
  /** Pincel. */
  pincel: (p: P) => (
    <Base {...p}>
      <path d="M13.5 4.5 19.5 10.5l-7 7-6-6 7-7Z" />
      <path d="M6.5 11.5 4 20l8.5-2.5" />
      <path d="m10 8 6 6" />
    </Base>
  ),
  /** Gota de esmalte: vidriado. */
  vidriado: (p: P) => (
    <Base {...p}>
      <path d="M12 3.5s-5.5 6.2-5.5 10.2a5.5 5.5 0 0 0 11 0C17.5 9.7 12 3.5 12 3.5Z" />
      <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.4" />
    </Base>
  ),
  /** Horno: llama dentro de un arco. */
  horno: (p: P) => (
    <Base {...p}>
      <path d="M4 20.5V11a8 8 0 0 1 16 0v9.5H4Z" />
      <path d="M12 17.5c-1.6 0-2.6-1-2.6-2.4 0-1.7 1.6-2.6 2-4.3 1.6 1 3.2 2.8 3.2 4.3 0 1.4-1 2.4-2.6 2.4Z" />
    </Base>
  ),
  /** Dos manos: acompañamiento. */
  acompanamiento: (p: P) => (
    <Base {...p}>
      <path d="M3.5 13.5 7 10l3 1.5 2.5-2 3 .5" />
      <path d="M20.5 13.5 17 10" />
      <path d="M7 10v4.5c0 1 .5 1.8 1.4 2.3l2.6 1.4c.9.5 2 .5 2.9 0l2.9-1.7c.7-.4 1.2-1.2 1.2-2V10" />
    </Base>
  ),
  /** Pieza sobre la mesa: materiales. */
  pieza: (p: P) => (
    <Base {...p}>
      <path d="M9 4.5h6M9.8 4.5c.2 2-2.8 3.4-2.8 7.2 0 4.2 2.4 6.8 5 6.8s5-2.6 5-6.8c0-3.8-3-5.2-2.8-7.2" />
      <path d="M3.5 20.5h17" />
    </Base>
  ),
  estrella: (p: P) => (
    <Base {...p}>
      <path d="M12 3.8 14.2 9l5.3.4-4 3.5 1.2 5.3L12 15.5l-4.7 2.7 1.2-5.3-4-3.5L9.8 9 12 3.8Z" />
    </Base>
  ),
};

export type NombreIcono = keyof typeof Icono;
