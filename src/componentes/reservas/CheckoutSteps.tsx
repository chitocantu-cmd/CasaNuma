import { Icono } from '../base/Iconos';

/**
 * Pasos de la reserva. En escritorio, la ruta completa; en móvil, "Paso 2
 * de 5 · Sesiones" con una barra: la ruta entera no cabe y no hace falta.
 */
export default function CheckoutSteps({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <nav aria-label="Pasos de la reserva">
      <div className="sm:hidden">
        <p className="eyebrow text-cafe/70">
          Paso {actual + 1} de {pasos.length} · <span className="text-cafe">{pasos[actual]}</span>
        </p>
        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-cafe/10">
          <div
            className="h-full rounded-full bg-cafe transition-[width] duration-media ease-numa"
            style={{ width: `${((actual + 1) / pasos.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden items-center gap-3 sm:flex">
        {pasos.map((p, i) => {
          const hecho = i < actual;
          const ahora = i === actual;
          return (
            <li key={p} className="flex items-center gap-3" aria-current={ahora ? 'step' : undefined}>
              <span
                className={`cifra flex h-8 w-8 items-center justify-center rounded-full text-[0.95rem] ${
                  ahora ? 'bg-cafe text-crema' : hecho ? 'bg-terracota/30 text-cafe' : 'border border-cafe/25 text-cafe/50'
                }`}
              >
                {hecho ? <Icono.check tam={14} /> : i + 1}
              </span>
              <span className={`text-[0.8rem] ${ahora ? 'text-cafe' : 'text-cafe/60'}`}>{p}</span>
              {i < pasos.length - 1 && <span className="h-px w-6 bg-cafe/20 lg:w-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
