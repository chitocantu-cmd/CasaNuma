import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { EstadoPago, EstadoReserva, MetodoPago, Reserva, TipoExperiencia, Usuario } from '../../datos/tipos';
import { DIAS_CORTOS, MESES, diaSemana, hora, partes } from '../../lib/calendario';

// ---------------------------------------------------------------------------
// Piezas compartidas del panel de Casa Numa
// ---------------------------------------------------------------------------

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  pendiente_pago: 'Pendiente de pago',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  expirada: 'Apartado vencido',
};

export const ETIQUETA_PAGO: Record<EstadoPago, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  reembolsado: 'Reembolsado',
  fallido: 'Rechazado',
};

export const ETIQUETA_TIPO: Record<TipoExperiencia, string> = {
  taller: 'Taller',
  membresia: 'Membresía',
  kids: 'NUMA Kids',
};

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

const TONO_ESTADO: Record<EstadoReserva, string> = {
  confirmada: 'bg-verde/25 text-cafe',
  pendiente_pago: 'bg-amarillo/35 text-cafe',
  completada: 'bg-indigo/12 text-indigo',
  cancelada: 'bg-cafe/[0.07] text-cafe/60',
  expirada: 'bg-cafe/[0.05] text-cafe/50',
};

const TONO_PAGO: Record<EstadoPago, string> = {
  pagado: 'border-verde/60 text-cafe',
  pendiente: 'border-naranja/70 text-cafe',
  reembolsado: 'border-indigo/40 text-indigo',
  fallido: 'border-naranja text-cafe',
};

export function EstadoPill({ estado }: { estado: EstadoReserva }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-[0.1em] ${TONO_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

export function PagoPill({ pago }: { pago: EstadoPago }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[0.62rem] font-medium uppercase tracking-[0.1em] ${TONO_PAGO[pago]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pago === 'pagado' ? 'bg-verde' : pago === 'reembolsado' ? 'bg-indigo' : 'bg-naranja'}`} aria-hidden="true" />
      {ETIQUETA_PAGO[pago]}
    </span>
  );
}

export function DemoPill() {
  return (
    <span className="inline-flex rounded-full border border-indigo/40 px-2 py-[2px] text-[0.55rem] font-medium uppercase tracking-[0.12em] text-indigo" title="Reserva de ejemplo de la demo">
      Demo
    </span>
  );
}

export function NuevaPill() {
  return <span className="inline-flex rounded-full bg-naranja px-2 py-[2px] text-[0.55rem] font-medium uppercase tracking-[0.12em] text-cafe">Nueva</span>;
}

export const esNueva = (r: Reserva) => Date.now() - new Date(r.creadaEn).getTime() < 24 * 3600_000;

/** "03 OCT" */
export function diaMes(iso: string) {
  const [, m, d] = partes(iso);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1].slice(0, 3).toUpperCase()}`;
}

/** "JUE 01 OCT" */
export function diaMesSemana(iso: string) {
  return `${DIAS_CORTOS[diaSemana(iso)].toUpperCase()} ${diaMes(iso)}`;
}

/** "4:00 PM" */
export function horaCorta(hhmm: string) {
  return hora(hhmm).replace('a.m.', 'AM').replace('p.m.', 'PM');
}

/** "01 oct 2026 · 12:41 p.m." en hora de Monterrey. */
export function fechaHora(isoInstante: string) {
  const f = new Date(isoInstante);
  const fecha = f.toLocaleDateString('es-MX', { timeZone: 'America/Monterrey', day: '2-digit', month: 'short', year: 'numeric' });
  const h = f.toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey', hour: 'numeric', minute: '2-digit' });
  return `${fecha.replace('.', '')} · ${h}`;
}

export function dinero(n: number) {
  return `$${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n)}`;
}

// --- Tarjetas ----------------------------------------------------------------

export function Kpi({ etiqueta, valor, nota, alerta = false }: { etiqueta: string; valor: ReactNode; nota?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-suave border p-5 ${alerta ? 'border-naranja/60 bg-naranja/[0.08]' : 'border-cafe/12 bg-crema'}`}>
      <p className="eyebrow text-[0.6rem] text-cafe/60">{etiqueta}</p>
      <p className="cifra mt-3 text-[2.6rem] leading-none tracking-[0.02em]">{valor}</p>
      {nota && <p className="mt-2 text-[0.72rem] text-cafe/60">{nota}</p>}
    </div>
  );
}

export function Tarjeta({ titulo, accion, children, className = '' }: { titulo?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-suave border border-cafe/12 bg-crema ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-4 border-b border-cafe/10 px-5 py-3.5">
          <h2 className="eyebrow text-[0.62rem] text-cafe/70">{titulo}</h2>
          {accion}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EncabezadoPanel({ titulo, eyebrow, accion }: { titulo: string; eyebrow?: string; accion?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-cafe/12 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow text-[0.62rem] text-cafe/60">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none">{titulo}</h1>
      </div>
      {accion}
    </header>
  );
}

export const claseTabla = {
  tabla: 'w-full border-collapse text-left text-[0.84rem]',
  th: 'eyebrow whitespace-nowrap border-b border-cafe/15 px-3 py-2.5 text-[0.58rem] font-medium text-cafe/60',
  td: 'border-b border-cafe/10 px-3 py-3 align-middle',
  fila: 'cursor-pointer transition-colors hover:bg-terracota/[0.07]',
};

export const claseCampo =
  'h-10 rounded-[0.5rem] border border-cafe/20 bg-crema px-3 text-[0.84rem] text-cafe outline-none transition-colors focus:border-cafe';

// --- Sesión del equipo ---------------------------------------------------------

interface CtxPanel {
  admin: Usuario;
  salir: () => Promise<void>;
}

export const ContextoPanel = createContext<CtxPanel | null>(null);

export function usePanel(): CtxPanel {
  const c = useContext(ContextoPanel);
  if (!c) throw new Error('usePanel necesita el layout del panel');
  return c;
}

/**
 * Refresca cada pocos segundos, al volver a la pestaña y cuando otra pestaña
 * cambia los datos: una reserva nueva aparece sola, sin recargar.
 */
export function useEnVivo(recargar: () => void, cadaMs = 8000) {
  useEffect(() => {
    const t = setInterval(recargar, cadaMs);
    const alVolver = () => document.visibilityState === 'visible' && recargar();
    window.addEventListener('storage', recargar);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      window.removeEventListener('storage', recargar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar, cadaMs]);
}
