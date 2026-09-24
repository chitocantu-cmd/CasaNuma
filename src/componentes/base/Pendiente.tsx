import type { ReactNode } from 'react';
import { fuenteDatos, mostrarPendientes } from '../../config/site';

/**
 * Nota de desarrollo: algo que Casa Numa todavía debe confirmar.
 * En producción no se renderiza — el sitio nunca publica "[PENDIENTE]".
 */
export function Pendiente({
  children, className = '', claro = false,
}: { children: ReactNode; className?: string; claro?: boolean }) {
  if (!mostrarPendientes) return null;
  const tono = claro
    ? 'border-crema/40 bg-crema/[0.06] text-crema/85'
    : 'border-indigo/45 bg-indigo/[0.05] text-indigo';
  return (
    <div
      className={`rounded-suave border border-dashed px-4 py-3 text-nota ${tono} ${className}`}
      data-pendiente
    >
      <span className="eyebrow mr-2 text-[0.6rem]">Pendiente</span>
      {children}
    </div>
  );
}

/** Marca un dato simulado (taller, precio o producto de demostración). */
export function MarcaDemo({ className = '' }: { className?: string }) {
  if (fuenteDatos !== 'demo') return null;
  return (
    <span
      className={`eyebrow inline-flex items-center gap-1.5 rounded-full border border-indigo/40 px-2.5 py-1 text-[0.56rem] tracking-[0.16em] text-indigo ${className}`}
      title="Dato de demostración: no está confirmado por Casa Numa"
    >
      <span className="h-1 w-1 rounded-full bg-indigo" aria-hidden="true" />
      Demo
    </span>
  );
}
