import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { OPCIONES_RESERVA } from '../../contenido/navegacion';
import CeramicShape from '../marca/CeramicShape';
import { Icono } from '../base/Iconos';
import { EASE_NUMA } from '../base/Revelar';
import { clasesBoton } from '../base/Boton';

/**
 * "Reservar" no manda a una sola página: abre las cuatro puertas de entrada y
 * dice de una vez qué se paga en línea y qué se cotiza por WhatsApp.
 */
export default function ReservarMenu({ compacto = false }: { compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const { pathname } = useLocation();

  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector<HTMLElement>('a')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    const alClic = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false);
    };
    window.addEventListener('keydown', alTeclear);
    window.addEventListener('mousedown', alClic);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('mousedown', alClic);
    };
  }, [abierto]);

  return (
    <div className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={idPanel}
        className={clasesBoton('primario', 'chico', compacto ? 'px-4' : '')}
      >
        Reservar
        <svg
          viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"
          className={`-mr-1 transition-transform duration-media ease-numa ${abierto ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {abierto && (
          <m.div
            ref={panel}
            id={idPanel}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            transition={{ duration: 0.35, ease: EASE_NUMA }}
            className="fixed inset-x-3 top-[4.6rem] z-50 origin-top rounded-suave border border-cafe/10 bg-crema p-2 shadow-[0_24px_60px_-28px_rgb(96_47_22/0.45)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.75rem)] sm:w-[23rem]"
          >
            <p className="eyebrow px-4 pb-2 pt-3 text-cafe/60">¿Qué quieres hacer?</p>
            <ul>
              {OPCIONES_RESERVA.map((o) => (
                <li key={o.to}>
                  <Link
                    to={o.to}
                    className="group flex items-center gap-4 rounded-[0.6rem] px-4 py-3.5 transition-colors hover:bg-cafe/[0.06] focus-visible:bg-cafe/[0.06]"
                  >
                    <span className="flex h-11 w-9 shrink-0 items-end justify-center">
                      <CeramicShape nombre={o.silueta} className="max-h-full w-auto" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.22rem] leading-tight">{o.titulo}</span>
                      <span className="mt-0.5 block text-[0.78rem] text-cafe/70">{o.detalle}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className={`eyebrow text-[0.55rem] ${o.canal === 'WhatsApp' ? 'text-indigo' : 'text-cafe/55'}`}>
                        {o.canal}
                      </span>
                      <Icono.flecha tam={16} className="text-cafe/50 transition-transform duration-media ease-numa group-hover:translate-x-1 group-hover:text-cafe" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
