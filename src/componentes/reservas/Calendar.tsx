import { useMemo } from 'react';
import type { Sesion } from '../../datos/tipos';
import { diaSemana, diasDelMes, etiquetaMes, fechaCompleta, partes, yaPaso } from '../../lib/calendario';
import { pocosLugares, sinLugar } from '../../lib/cupo';
import { Icono } from '../base/Iconos';

const ENCABEZADO = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/**
 * Calendario mensual. Solo los días con sesiones son botones; cada uno dice
 * con texto accesible cuántos lugares quedan. En móvil las celdas miden al
 * menos 44 px para tocarse con el pulgar.
 */
export default function Calendar({
  mes,
  sesiones,
  seleccionadas = [],
  diaActivo,
  onDia,
  onMes,
  puedeAnterior = false,
  puedeSiguiente = false,
}: {
  mes: string;
  sesiones: Sesion[];
  seleccionadas?: string[];
  diaActivo?: string | null;
  onDia: (fecha: string) => void;
  onMes?: (delta: -1 | 1) => void;
  puedeAnterior?: boolean;
  puedeSiguiente?: boolean;
}) {
  const porDia = useMemo(() => {
    const mapa = new Map<string, Sesion[]>();
    for (const s of sesiones) {
      if (!s.fecha.startsWith(mes)) continue;
      mapa.set(s.fecha, [...(mapa.get(s.fecha) ?? []), s]);
    }
    return mapa;
  }, [sesiones, mes]);

  const dias = diasDelMes(mes);
  // Lunes primero: domingo (0) pasa a la séptima columna.
  const huecos = (diaSemana(dias[0]) + 6) % 7;

  return (
    <div className="max-w-[34rem]">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-t3 font-light capitalize" aria-live="polite">{etiquetaMes(mes)}</h3>
        {onMes && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onMes(-1)}
              disabled={!puedeAnterior}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/25 text-cafe transition-colors hover:border-cafe disabled:opacity-30"
              aria-label="Mes anterior"
            >
              <Icono.flechaIzq tam={17} />
            </button>
            <button
              type="button"
              onClick={() => onMes(1)}
              disabled={!puedeSiguiente}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/25 text-cafe transition-colors hover:border-cafe disabled:opacity-30"
              aria-label="Mes siguiente"
            >
              <Icono.flecha tam={17} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-1.5" role="presentation">
        {ENCABEZADO.map((d) => (
          <span key={d} className="eyebrow pb-2 text-center text-[0.58rem] text-cafe/55" aria-hidden="true">{d}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} aria-hidden="true" />)}

        {dias.map((fecha) => {
          const del = porDia.get(fecha);
          const numero = partes(fecha)[2];
          // Días sin sesiones o ya pasados: solo el número, sin botón.
          if (!del || del.every((s) => yaPaso(s.fecha, s.inicio))) {
            return (
              <span key={fecha} className="flex aspect-square min-h-11 items-center justify-center text-[0.85rem] text-cafe/30" aria-hidden="true">
                {numero}
              </span>
            );
          }
          const abiertas = del.filter((s) => !sinLugar(s));
          const lleno = abiertas.length === 0;
          const pocos = !lleno && abiertas.every(pocosLugares);
          // Si alguna sesión no tiene cupo confirmado, no se suma nada.
          const lugares = abiertas.every((s) => s.disponibles !== null)
            ? abiertas.reduce((n, s) => n + (s.disponibles ?? 0), 0)
            : null;
          const elegido = del.some((s) => seleccionadas.includes(s.id));
          const activo = diaActivo === fecha;

          return (
            <button
              key={fecha}
              type="button"
              onClick={() => onDia(fecha)}
              disabled={lleno && !elegido}
              aria-pressed={elegido || activo}
              aria-label={`${fechaCompleta(fecha)}: ${
                lleno
                  ? 'sin lugares'
                  : `${del.length > 1 ? `${del.length} horarios, ` : ''}${
                      lugares === null ? 'cupo limitado' : `${lugares} ${lugares === 1 ? 'lugar' : 'lugares'}`
                    }`
              }${elegido ? ', elegido' : ''}`}
              className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-full text-[0.92rem] transition-colors duration-rapida ${
                elegido
                  ? 'bg-cafe text-crema'
                  : lleno
                    ? 'cursor-not-allowed text-cafe/35 line-through'
                    : activo
                      ? 'bg-terracota/25 text-cafe ring-1 ring-cafe'
                      : 'bg-terracota/[0.12] text-cafe hover:bg-terracota/25'
              }`}
            >
              {numero}
              {!lleno && !elegido && (
                <span className={`absolute bottom-[18%] h-1 w-1 rounded-full ${pocos ? 'bg-naranja' : 'bg-cafe/60'}`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] text-cafe/70">
        <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cafe/60" />Con lugares</li>
        <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-naranja" />Últimos lugares</li>
        <li className="flex items-center gap-2"><span className="line-through">12</span>Lleno</li>
      </ul>
    </div>
  );
}
