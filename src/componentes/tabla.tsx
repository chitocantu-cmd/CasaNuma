import type { ReactNode } from 'react';

/** Envoltura con scroll horizontal propio: la página nunca se desplaza de lado. */
export function Tabla({ children, min = '48rem' }: { children: ReactNode; min?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.88rem]" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, num }: { children?: ReactNode; num?: boolean }) {
  return (
    <th className={`dato whitespace-nowrap border-b border-tinta/15 pb-2 pr-4 text-left font-semibold text-tinta/45 ${num ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

export function Td({ children, num, className = '' }: {
  children?: ReactNode; num?: boolean; className?: string;
}) {
  return (
    <td className={`border-b border-tinta/8 py-2.5 pr-4 align-top ${num ? 'text-right tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  );
}

const TONOS: Record<string, string> = {
  ok: 'bg-olivo/15 text-olivo',
  aviso: 'bg-terracota/12 text-terracota',
  neutro: 'bg-tinta/8 text-tinta/60',
  apagado: 'bg-tinta/5 text-tinta/40',
};

export function Etiqueta({ children, tono = 'neutro' }: {
  children: ReactNode; tono?: keyof typeof TONOS | string;
}) {
  return (
    <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${TONOS[tono] ?? TONOS.neutro}`}>
      {children}
    </span>
  );
}

/** Color semántico por estado de reserva o de pago. */
export function tonoEstado(estado: string): string {
  if (estado === 'confirmed' || estado === 'paid') return 'ok';
  if (estado === 'pending_payment' || estado === 'pending') return 'aviso';
  if (estado === 'expired' || estado === 'cancelled') return 'apagado';
  return 'neutro';
}
