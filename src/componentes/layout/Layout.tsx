import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { m } from 'framer-motion';
import Header from '../Header';
import Footer from '../Footer';
import { fuenteDatos } from '../../config/site';
import { EASE_NUMA } from '../base/Revelar';
import LimiteError from '../base/LimiteError';
import { CargandoPagina } from '../base/Cargando';

/** Al cambiar de página: arriba; si la URL trae #ancla, a esa sección. */
function Desplazamiento() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
}

/** Recordatorio permanente de que la demo no cobra ni reserva de verdad. */
function AvisoDemo() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem('numa:aviso-demo') !== 'oculto';
    } catch {
      return true;
    }
  });
  if (fuenteDatos !== 'demo' || !visible) return null;
  return (
    <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-30 flex items-center gap-2 rounded-full border border-indigo/30 bg-crema/95 py-1.5 pl-3.5 pr-1.5 text-[0.7rem] text-indigo shadow-[0_8px_24px_-12px_rgb(96_47_22/0.35)] backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo" aria-hidden="true" />
      <span>Versión demo · reservas y pagos simulados</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          try {
            sessionStorage.setItem('numa:aviso-demo', 'oculto');
          } catch {
            /* sin almacenamiento */
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-indigo/10"
        aria-label="Ocultar aviso de demo"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <Desplazamiento />
      <Header />
      {/* Transición de entrada entre páginas: solo aparece, nunca retrasa la salida. */}
      <m.main
        id="contenido"
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: EASE_NUMA }}
      >
        <LimiteError key={pathname}>
          {/* Cada página se descarga al entrar. La espera va aquí y no arriba
              del Layout: si suspendía todo el árbol, el encabezado se ocultaba
              con el menú móvil a medio cerrar y este se quedaba encima. */}
          <Suspense fallback={<CargandoPagina />}>
            <Outlet />
          </Suspense>
        </LimiteError>
      </m.main>
      <Footer />
      <AvisoDemo />
    </>
  );
}
