import CeramicShape from '../marca/CeramicShape';

/** Mientras llega una página: una pieza que respira y el texto para lectores de pantalla. */
export function CargandoPagina({ alto = 'min-h-[80vh]' }: { alto?: string }) {
  return (
    <div className={`flex ${alto} items-center justify-center`} role="status" aria-busy="true">
      <CeramicShape nombre="olla" className="h-10 w-auto motion-safe:animate-pulse" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Bloque de sección mientras carga: esqueleto tenue del alto indicado. */
export function CargandoBloque({ className = 'h-40' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-suave bg-cafe/[0.045] ${className}`} role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
