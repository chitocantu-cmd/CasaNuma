import { useMemo } from 'react';
import type { Taller } from '../../datos/tipos';
import { diaSemana, diasDelMes, etiquetaMes, fechaCompleta, partes, yaPaso } from '../../lib/calendario';
import { Icono } from '../base/Iconos';

const ENCABEZADO = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const NUMEROS = ['', 'Una actividad', 'Dos actividades', 'Tres actividades', 'Cuatro actividades'];

/**
 * Calendario de la agenda de talleres. En escritorio cada día dice qué hay
 * ("Dos actividades", o el taller y sus horarios); en móvil, un punto por
 * actividad. Tocar un día muestra sus talleres (lo pinta la página).
 */
export default function AgendaMes({
  mes, talleres, diaActivo, onDia, onMes, puedeAnterior = false, puedeSiguiente = false,
}: {
  mes: string;
  talleres: Taller[];
  diaActivo: string | null;
  onDia: (fecha: string) => void;
  onMes?: (delta: -1 | 1) => void;
  puedeAnterior?: boolean;
  puedeSiguiente?: boolean;
}) {
  const porDia = useMemo(() => {
    const mapa = new Map<string, Taller[]>();
    for (const t of talleres) {
      for (const f of new Set(t.sesiones.map((s) => s.fecha))) {
        if (f.startsWith(mes)) mapa.set(f, [...(mapa.get(f) ?? []), t]);
      }
    }
    return mapa;
  }, [talleres, mes]);

  const dias = diasDelMes(mes);
  const huecos = (diaSemana(dias[0]) + 6) % 7;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-t3 font-light capitalize">{etiquetaMes(mes)}</h3>
        {onMes && (puedeAnterior || puedeSiguiente) && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onMes(-1)} disabled={!puedeAnterior} aria-label="Mes anterior"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/25 transition-colors hover:border-cafe disabled:opacity-30">
              <Icono.flechaIzq tam={17} />
            </button>
            <button type="button" onClick={() => onMes(1)} disabled={!puedeSiguiente} aria-label="Mes siguiente"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/25 transition-colors hover:border-cafe disabled:opacity-30">
              <Icono.flecha tam={17} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-1.5">
        {ENCABEZADO.map((d) => (
          <span key={d} className="eyebrow pb-2 text-center text-[0.58rem] text-cafe/55 lg:text-left lg:pl-2" aria-hidden="true">{d}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} aria-hidden="true" />)}

        {dias.map((fecha) => {
          const del = porDia.get(fecha) ?? [];
          const numero = partes(fecha)[2];
          if (!del.length) {
            return (
              <span key={fecha} className="flex min-h-12 items-start justify-center rounded-[0.6rem] p-2 text-[0.85rem] text-cafe/30 lg:min-h-[7.5rem] lg:justify-start" aria-hidden="true">
                {numero}
              </span>
            );
          }
          const activo = diaActivo === fecha;
          const pasado = del.every((t) => t.sesiones.filter((s) => s.fecha === fecha).every((s) => yaPaso(s.fecha, s.inicio)));
          const unico = del.length === 1 ? del[0] : null;
          const horas = unico?.sesiones.filter((s) => s.fecha === fecha).map((s) => s.inicio).join(' / ');
          const temporada = del.some((t) => t.categoria === 'temporada');

          return (
            <button
              key={fecha}
              type="button"
              onClick={() => onDia(fecha)}
              aria-pressed={activo}
              aria-label={`${fechaCompleta(fecha)}: ${del.map((t) => t.titulo).join(', ')}${pasado ? ' (ya pasó)' : ''}`}
              className={`relative flex min-h-12 flex-col items-center gap-1 overflow-hidden rounded-[0.6rem] p-2 text-left transition-colors lg:min-h-[7.5rem] lg:items-stretch lg:p-2.5 ${
                activo
                  ? 'bg-cafe text-crema'
                  : pasado
                    ? 'bg-cafe/[0.04] text-cafe/45'
                    : 'bg-terracota/[0.12] text-cafe hover:bg-terracota/25'
              }`}
            >
              {temporada && !activo && <span className="absolute inset-x-0 top-0 h-[3px] bg-naranja" aria-hidden="true" />}
              <span className="cifra text-[1.15rem] leading-none lg:text-[1.35rem]">{String(numero).padStart(2, '0')}</span>
              {/* Móvil: un punto por actividad */}
              <span className="flex gap-1 lg:hidden" aria-hidden="true">
                {del.map((t) => (
                  <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${t.categoria === 'temporada' ? 'bg-naranja' : activo ? 'bg-crema' : 'bg-cafe/60'}`} />
                ))}
              </span>
              {/* Escritorio: qué hay ese día */}
              <span className="mt-auto hidden lg:block">
                {unico ? (
                  <>
                    <span className="line-clamp-3 font-display text-[0.95rem] leading-tight">{unico.titulo}</span>
                    <span className={`mt-1 block text-[0.7rem] ${activo ? 'text-crema/75' : 'text-cafe/65'}`}>{horas}</span>
                  </>
                ) : (
                  <span className="font-display text-[0.95rem] leading-tight">{NUMEROS[del.length] ?? `${del.length} actividades`}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] text-cafe/70">
        <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cafe/60" />Taller o clase</li>
        <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-naranja" />Temporada</li>
      </ul>
    </div>
  );
}
