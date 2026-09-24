import type { Sesion } from '../../datos/tipos';
import { hora, rango } from '../../lib/calendario';
import { pocosLugares, sinLugar, textoLugares } from '../../lib/cupo';

/**
 * Un horario reservable. Botón real con aria-pressed; lleno = deshabilitado,
 * con el texto "Lleno" (no solo un color) para quien no distingue colores.
 */
export default function TimeSlot({
  sesion,
  seleccionada,
  onElegir,
  etiqueta,
  deshabilitada = false,
}: {
  sesion: Sesion;
  seleccionada: boolean;
  onElegir: (s: Sesion) => void;
  /** Texto principal; por defecto el horario. */
  etiqueta?: string;
  deshabilitada?: boolean;
}) {
  const lleno = sinLugar(sesion);
  const pocos = pocosLugares(sesion);
  const bloqueada = lleno || deshabilitada;

  return (
    <button
      type="button"
      onClick={() => onElegir(sesion)}
      disabled={bloqueada}
      aria-pressed={seleccionada}
      className={`flex min-h-14 w-full items-center justify-between gap-4 rounded-[0.6rem] border px-4 py-3 text-left transition-colors duration-rapida ${
        seleccionada
          ? 'border-cafe bg-cafe text-crema'
          : bloqueada
            ? 'cursor-not-allowed border-cafe/10 bg-cafe/[0.03] text-cafe/40'
            : 'border-cafe/25 text-cafe hover:border-cafe'
      }`}
    >
      <span>
        <span className={`block text-[0.95rem] ${lleno ? 'line-through' : ''}`}>{etiqueta ?? rango(sesion.inicio, sesion.fin)}</span>
        {etiqueta && <span className="block text-[0.74rem] opacity-75">{hora(sesion.inicio)}</span>}
      </span>
      <span
        className={`eyebrow flex shrink-0 items-center gap-1.5 text-[0.58rem] ${
          seleccionada ? 'text-crema/85' : lleno ? '' : pocos ? 'text-cafe' : 'text-cafe/60'
        }`}
      >
        {pocos && <span className="h-1.5 w-1.5 rounded-full bg-naranja" aria-hidden="true" />}
        {textoLugares(sesion)}
      </span>
    </button>
  );
}
