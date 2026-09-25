import { Component, type ErrorInfo, type ReactNode } from 'react';
import CeramicShape from '../marca/CeramicShape';
import { clasesBoton } from './Boton';

// ---------------------------------------------------------------------------
// Si una parte de la interfaz truena, se ve esto en vez de una página blanca.
// ---------------------------------------------------------------------------
// «Intentar de nuevo» recarga: el caso más común en producción es un pedazo
// del sitio que ya no existe tras publicar una versión nueva, y recargar lo
// resuelve. El detalle técnico solo se muestra en desarrollo.
// ---------------------------------------------------------------------------

const INICIO = import.meta.env.VITE_ROUTER === 'hash' ? '#/' : '/';

export default class LimiteError extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[Casa Numa] Error de interfaz:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section role="alert" className="contenedor flex min-h-[75vh] flex-col items-start justify-center pb-seccion-s pt-[calc(theme(spacing.header)+3rem)]">
        <CeramicShape nombre="olla" className="h-14 w-auto" />
        <h1 className="mt-10 font-display text-t1 font-light">Algo salió mal.</h1>
        <p className="mt-5 max-w-lectura text-cuerpo-l text-cafe/80">No pudimos cargar esta parte de Casa Numa.</p>
        {import.meta.env.DEV && (
          <pre className="mt-6 max-w-full overflow-x-auto whitespace-pre-wrap rounded-[0.5rem] bg-cafe/[0.05] p-4 text-[0.72rem] text-cafe/70">
            {error.message}
          </pre>
        )}
        <div className="mt-10 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.location.reload()} className={clasesBoton('primario')}>
            Intentar de nuevo
          </button>
          <a href={INICIO} className={clasesBoton('secundario')}>Volver al inicio</a>
        </div>
      </section>
    );
  }
}
