import { Link } from 'react-router-dom';
import type { Taller } from '../datos/tipos';
import { duracionTexto, fechaCompacta, hora } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import Foto from './base/Foto';
import { BotonEnlace } from './base/Boton';
import { MarcaDemo } from './base/Pendiente';
import { textoLugares } from './reservas/TimeSlot';

/**
 * Ficha de taller: todo lo necesario para decidir sin abrir otra página —
 * foto, nombre, fecha, horarios con lugares, duración, precio e inclusiones.
 * Cada horario es un enlace directo al checkout con esa sesión ya elegida.
 */
export default function WorkshopCard({ taller: t, invertida = false }: { taller: Taller; invertida?: boolean }) {
  const fechas = [...new Set(t.sesiones.map((s) => s.fecha))];
  const quedan = t.sesiones.reduce((n, s) => n + s.disponibles, 0);

  return (
    <article className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
      <Link
        to={`/talleres/${t.slug}`}
        className={`group relative block lg:col-span-6 ${invertida ? 'lg:order-2 lg:col-start-7' : ''}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Foto id={t.foto} className="aspect-[4/3] w-full rounded-foto" sizes="(min-width:1024px) 45vw, 100vw" zoom />
        <p className="cifra absolute left-4 top-4 rounded-full bg-crema/95 px-3.5 py-1.5 text-[1.05rem] leading-none text-cafe">
          {fechas.map(fechaCompacta).join(' · ')}
        </p>
      </Link>

      <div className={`lg:col-span-5 ${invertida ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-8'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow text-cafe/60">Taller · {duracionTexto(t.duracionMin)}</p>
          {t.demo && <MarcaDemo />}
        </div>
        <h2 className="mt-4 font-display text-t2 font-light">
          <Link to={`/talleres/${t.slug}`} className="transition-colors hover:text-terracota">{t.titulo}</Link>
        </h2>
        <p className="mt-4 max-w-[44ch] text-cuerpo-l text-cafe/80">{t.resumen}</p>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-cafe/12 py-5 text-nota">
          <div>
            <dt className="eyebrow text-[0.6rem] text-cafe/55">Precio por persona</dt>
            <dd className="cifra mt-1 text-[1.7rem] leading-none text-cafe">{pesosCortos(t.precio)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.6rem] text-cafe/55">Incluye</dt>
            <dd className="mt-1 text-cafe/85">{t.incluye.join(' · ')}</dd>
          </div>
        </dl>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Horarios">
          {t.sesiones.map((s) => {
            const lleno = s.disponibles <= 0;
            return (
              <li key={s.id}>
                {lleno ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cafe/10 px-4 text-[0.78rem] text-cafe/40">
                    <span className="line-through">{fechas.length > 1 ? `${fechaCompacta(s.fecha)} · ` : ''}{hora(s.inicio)}</span>
                    <span className="eyebrow text-[0.55rem]">Lleno</span>
                  </span>
                ) : (
                  <Link
                    to={`/talleres/${t.slug}?sesion=${s.id}`}
                    className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-cafe/25 px-4 text-[0.78rem] text-cafe transition-colors hover:border-cafe hover:bg-cafe hover:text-crema"
                  >
                    {fechas.length > 1 ? `${fechaCompacta(s.fecha)} · ` : ''}{hora(s.inicio)}
                    <span className="flex items-center gap-1.5 text-[0.7rem] opacity-75">
                      {s.disponibles <= 3 && <span className="h-1.5 w-1.5 rounded-full bg-naranja" aria-hidden="true" />}
                      {textoLugares(s.disponibles)}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8">
          {quedan > 0 ? (
            <BotonEnlace to={`/talleres/${t.slug}`} flecha>Reservar mi lugar</BotonEnlace>
          ) : (
            <p className="text-nota text-cafe/70">Este taller se llenó. Revisa las otras fechas de la agenda.</p>
          )}
        </div>
      </div>
    </article>
  );
}
