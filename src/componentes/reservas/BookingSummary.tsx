import { useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { IdFoto } from '../../contenido/fotos';
import type { SesionReservada } from '../../datos/tipos';
import { fechaCompacta, rango } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import Foto from '../base/Foto';
import { Boton } from '../base/Boton';
import { EASE_NUMA } from '../base/Revelar';

export interface Fila {
  k: string;
  v: ReactNode;
}

export interface AccionResumen {
  texto: string;
  onClick: () => void;
  deshabilitada?: boolean;
  cargando?: boolean;
}

/**
 * Resumen de la reserva, siempre a la vista: precio, fechas, personas, total.
 * Escritorio: tarjeta fija al costado. Móvil: barra inferior con el total y
 * el botón al alcance del pulgar; el detalle se despliega si se toca.
 */
export default function BookingSummary({
  titulo, foto, filas, sesiones = [], total, accion, nota,
}: {
  titulo: string;
  foto?: IdFoto;
  filas: Fila[];
  sesiones?: SesionReservada[];
  total: number | null;
  accion?: AccionResumen;
  nota?: ReactNode;
}) {
  const [detalle, setDetalle] = useState(false);

  const cuerpo = (
    <>
      <dl className="space-y-3 text-[0.88rem]">
        {filas.map((f) => (
          <div key={f.k} className="flex items-baseline justify-between gap-6">
            <dt className="text-cafe/65">{f.k}</dt>
            <dd className="text-right text-cafe">{f.v}</dd>
          </div>
        ))}
      </dl>
      {sesiones.length > 0 && (
        <ol className="mt-5 space-y-2 border-t border-cafe/10 pt-5">
          {sesiones.map((s, i) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 text-[0.85rem]">
              <span className="flex items-baseline gap-3">
                <span className="cifra w-5 text-[0.95rem] text-cafe/45">{i + 1}</span>
                <span className="capitalize">{fechaCompacta(s.fecha)}</span>
              </span>
              <span className="text-cafe/65">{rango(s.inicio, s.fin)}</span>
            </li>
          ))}
        </ol>
      )}
      {nota && <div className="mt-5 text-[0.76rem] leading-relaxed text-cafe/65">{nota}</div>}
    </>
  );

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-28 hidden overflow-hidden rounded-suave border border-cafe/12 bg-crema lg:block" aria-label="Resumen de tu reserva">
        {foto && <Foto id={foto} className="aspect-[16/9] w-full" sizes="24rem" />}
        <div className="p-7">
          <p className="eyebrow text-cafe/55">Tu reserva</p>
          <h2 className="mt-2 font-display text-t4 font-light">{titulo}</h2>
          <div className="mt-6">{cuerpo}</div>
          <div className="mt-6 flex items-baseline justify-between border-t border-cafe/15 pt-5">
            <span className="eyebrow text-cafe/60">Total</span>
            <span className="cifra text-[2.1rem] leading-none">{total !== null ? pesosCortos(total) : '—'}</span>
          </div>
          {accion && (
            <Boton
              className="mt-6 w-full"
              onClick={accion.onClick}
              disabled={accion.deshabilitada || accion.cargando}
              flecha={!accion.cargando}
            >
              {accion.cargando ? 'Un momento…' : accion.texto}
            </Boton>
          )}
        </div>
      </aside>

      {/* Móvil */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cafe/15 bg-crema/[0.97] pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
        <AnimatePresence initial={false}>
          {detalle && (
            <m.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.35, ease: EASE_NUMA }}
              className="overflow-hidden"
            >
              <div className="max-h-[50svh] overflow-y-auto border-b border-cafe/10 px-5 py-5">
                <p className="font-display text-[1.2rem] font-light">{titulo}</p>
                <div className="mt-4">{cuerpo}</div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-4 px-5 py-3">
          <button
            type="button"
            onClick={() => setDetalle((v) => !v)}
            aria-expanded={detalle}
            className="flex min-h-12 flex-1 flex-col items-start justify-center text-left"
          >
            <span className="eyebrow flex items-center gap-1.5 text-[0.56rem] text-cafe/60">
              {detalle ? 'Ocultar detalle' : 'Ver detalle'}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" className={detalle ? '' : 'rotate-180'} aria-hidden="true">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="cifra text-[1.6rem] leading-none">{total !== null ? pesosCortos(total) : '—'}</span>
          </button>
          {accion && (
            <Boton onClick={accion.onClick} disabled={accion.deshabilitada || accion.cargando} className="shrink-0">
              {accion.cargando ? 'Un momento…' : accion.texto}
            </Boton>
          )}
        </div>
      </div>
    </>
  );
}
