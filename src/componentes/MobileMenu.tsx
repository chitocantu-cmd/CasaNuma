import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { NAV } from '../contenido/navegacion';
import { enlaceInstagram, enlaceWhatsapp, siteConfig } from '../config/site';
import { useSesion } from '../features/cuenta/sesion';
import { Logo } from './marca/Logo';
import CeramicShape from './marca/CeramicShape';
import { Icono } from './base/Iconos';
import { EASE_NUMA } from './base/Revelar';

const SILUETAS_PIE = ['olla', 'guaje', 'taza', 'doble', 'jarron', 'anfora'] as const;

/**
 * Menú móvil a pantalla completa: índice editorial con números en Bebas y
 * titulares en Ivy Mode, las piezas NUMA al pie. No es un cajón genérico.
 */
export default function MobileMenu({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const { usuario } = useSesion();
  const instagram = enlaceInstagram();
  const whatsapp = enlaceWhatsapp();

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, onCerrar]);

  const items = [{ label: 'Inicio', to: '/' }, ...NAV];

  return (
    <AnimatePresence>
      {abierto && (
        <m.div
          id="menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-crema lg:hidden"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.35, ease: EASE_NUMA } }}
          transition={{ duration: 0.55, ease: EASE_NUMA }}
        >
          <div className="contenedor flex h-header shrink-0 items-center justify-between">
            <Link to="/" onClick={onCerrar} className="text-cafe" aria-label="Casa Numa, ir al inicio">
              <Logo className="h-11 w-auto" />
            </Link>
            <button
              ref={cerrarRef}
              type="button"
              onClick={onCerrar}
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-cafe"
              aria-label="Cerrar menú"
            >
              <Icono.cerrar tam={26} />
            </button>
          </div>

          <nav aria-label="Principal" className="contenedor flex-1 pb-8 pt-6">
            <ul className="border-t border-cafe/15">
              {items.map((item, i) => (
                <m.li
                  key={item.to}
                  className="border-b border-cafe/15"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE_NUMA, delay: 0.12 + i * 0.045 }}
                >
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onCerrar}
                    className={({ isActive }) =>
                      `group flex items-baseline gap-5 py-3.5 ${isActive ? 'text-terracota' : 'text-cafe'}`
                    }
                  >
                    <span className="cifra w-7 text-[1rem] text-cafe/55">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-display text-[2.05rem] font-light leading-none">{item.label}</span>
                    <Icono.flecha tam={18} className="ml-auto self-center text-cafe/40 transition-transform group-active:translate-x-1" />
                  </NavLink>
                </m.li>
              ))}
            </ul>

            <m.div
              className="mt-8 grid grid-cols-2 gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Link
                to="/cuenta"
                onClick={onCerrar}
                className="flex min-h-12 items-center gap-2.5 rounded-full border border-cafe/25 px-5 text-[0.8rem] text-cafe"
              >
                <Icono.usuario tam={18} />
                <span className="truncate">{usuario ? usuario.nombre.split(' ')[0] : 'Mi cuenta'}</span>
              </Link>
              {instagram ? (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-2.5 rounded-full border border-cafe/25 px-5 text-[0.8rem] text-cafe"
                >
                  <Icono.instagram tam={18} /> Instagram
                </a>
              ) : whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-2.5 rounded-full border border-cafe/25 px-5 text-[0.8rem] text-cafe"
                >
                  <Icono.whatsapp tam={18} /> WhatsApp
                </a>
              ) : null}
            </m.div>

            <p className="eyebrow mt-8 text-cafe/60">{siteConfig.zona}</p>
          </nav>

          <div className="contenedor flex shrink-0 items-end justify-between gap-3 pb-8" aria-hidden="true">
            {SILUETAS_PIE.map((s, i) => (
              <m.span
                key={s}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE_NUMA, delay: 0.35 + i * 0.05 }}
              >
                <CeramicShape nombre={s} className="h-12 w-auto" />
              </m.span>
            ))}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
