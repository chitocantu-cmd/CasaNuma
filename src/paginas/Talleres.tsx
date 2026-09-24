import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTalleres } from '../datos/hooks';
import SectionHeading from '../componentes/SectionHeading';
import WorkshopCard from '../componentes/WorkshopCard';
import Calendar from '../componentes/reservas/Calendar';
import { textoLugares } from '../componentes/reservas/TimeSlot';
import Revelar from '../componentes/base/Revelar';
import { Pendiente } from '../componentes/base/Pendiente';
import { Aviso } from '../componentes/base/Campos';
import { Boton, EnlaceFlecha } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import CeramicShape from '../componentes/marca/CeramicShape';
import { claveMes, fechaCompleta, hora, sumarMeses } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { useSeo } from '../lib/seo';

export default function Talleres() {
  useSeo({
    titulo: 'Talleres de Cerámica | Casa Numa',
    descripcion:
      'Talleres de cerámica de fin de semana en San Pedro Garza García. Elige tu proyecto, fecha y horario, y reserva tu lugar en línea.',
  });

  const { datos: talleres, cargando, error, recargar } = useTalleres();
  const [vista, setVista] = useState<'fichas' | 'calendario'>('fichas');

  const sesiones = useMemo(
    () => (talleres ?? []).flatMap((t) => t.sesiones.map((s) => ({ ...s, taller: t }))),
    [talleres],
  );
  const meses = useMemo(() => [...new Set(sesiones.map((s) => claveMes(s.fecha)))].sort(), [sesiones]);
  const [mes, setMes] = useState<string | null>(null);
  const mesActivo = mes ?? meses[0] ?? null;
  const [dia, setDia] = useState<string | null>(null);
  const delDia = sesiones.filter((s) => s.fecha === dia);

  return (
    <>
      <section className="contenedor pb-seccion-s pt-[calc(theme(spacing.header)+3.5rem)]">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionHeading
              como="h1"
              eyebrow="Clases de fin de semana"
              titulo="Cada fin de semana, una nueva experiencia."
              intro={
                <p>
                  Descubre nuestros talleres de cerámica, elige tu proyecto favorito y disfruta de un momento creativo en
                  Casa Numa. Selecciona la fecha y el horario que más te gusten y reserva tu lugar.
                </p>
              }
            />
          </div>
          <Revelar retraso={0.2} className="hidden justify-end gap-4 lg:col-span-4 lg:flex">
            <CeramicShape nombre="taza" className="h-16 w-auto" />
            <CeramicShape nombre="jarron" className="h-24 w-auto" />
            <CeramicShape nombre="tarro" className="h-14 w-auto" />
          </Revelar>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-cafe/12 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-full border border-cafe/20 p-1" role="tablist" aria-label="Vista de la agenda">
            {([
              ['fichas', 'Próximos talleres'],
              ['calendario', 'Calendario'],
            ] as const).map(([v, t]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vista === v}
                onClick={() => setVista(v)}
                className={`min-h-11 rounded-full px-5 text-[0.8rem] transition-colors ${vista === v ? 'bg-cafe text-crema' : 'text-cafe/75 hover:text-cafe'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-2.5 text-nota text-cafe/75">
            <Icono.candado tam={17} className="text-terracota" />
            Reserva y paga en línea. Cada taller tiene su propio precio.
          </p>
        </div>

        <Pendiente className="mt-6">
          Agenda de ejemplo con los tres talleres que comunicó Casa Numa (Halloween, Catrina, Cerámica libre). Fechas,
          precios, duraciones, inclusiones y cupos son de demostración: la agenda completa de octubre se carga desde el
          panel.
        </Pendiente>
      </section>

      <section className="contenedor pb-seccion" aria-live="polite">
        {cargando && !talleres && <div className="h-96" aria-busy="true" />}
        {error && (
          <div className="max-w-xl">
            <Aviso>No pudimos cargar la agenda. {error}</Aviso>
            <Boton variante="secundario" className="mt-4" onClick={recargar}>Reintentar</Boton>
          </div>
        )}

        {talleres && talleres.length === 0 && (
          <p className="max-w-lectura text-cuerpo-l text-cafe/80">
            Estamos preparando las próximas fechas. Suscríbete a las novedades para enterarte primero.
          </p>
        )}

        {talleres && vista === 'fichas' && (
          <div className="space-y-24 lg:space-y-32">
            {talleres.map((t, i) => (
              <Revelar key={t.id}>
                <WorkshopCard taller={t} invertida={i % 2 === 1} />
              </Revelar>
            ))}
          </div>
        )}

        {talleres && vista === 'calendario' && mesActivo && (
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-6">
              <Calendar
                mes={mesActivo}
                sesiones={sesiones}
                diaActivo={dia}
                onDia={setDia}
                onMes={(d) => { setMes(sumarMeses(mesActivo, d)); setDia(null); }}
                puedeAnterior={meses.indexOf(mesActivo) > 0}
                puedeSiguiente={meses.indexOf(mesActivo) < meses.length - 1}
              />
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              {dia ? (
                <>
                  <p className="eyebrow text-cafe/60 first-letter:uppercase">{fechaCompleta(dia)}</p>
                  <ul className="mt-5 space-y-3">
                    {delDia.map((s) => (
                      <li key={s.id}>
                        <Link
                          to={s.disponibles > 0 ? `/talleres/${s.taller.slug}?sesion=${s.id}` : `/talleres/${s.taller.slug}`}
                          className="group flex items-center justify-between gap-4 rounded-suave border border-cafe/15 p-5 transition-colors hover:border-cafe"
                        >
                          <span>
                            <span className="block font-display text-t4 font-light">{s.taller.titulo}</span>
                            <span className="mt-1 block text-nota text-cafe/70">
                              {hora(s.inicio)} · {pesosCortos(s.taller.precio)} por persona
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-2">
                            <span className="eyebrow text-[0.58rem] text-cafe/65">{textoLugares(s.disponibles)}</span>
                            <Icono.flecha tam={17} className="transition-transform group-hover:translate-x-1" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-cuerpo text-cafe/70">Elige un día marcado en el calendario para ver sus talleres.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Otras formas de crear */}
      <section className="border-t border-cafe/10 bg-cafe/[0.03]">
        <div className="contenedor grid gap-10 py-seccion-s md:grid-cols-2">
          <Revelar>
            <p className="eyebrow text-cafe/60">¿Quieres venir cada semana?</p>
            <p className="mt-4 font-display text-t3 font-light">Haz de la cerámica parte de tu rutina.</p>
            <EnlaceFlecha to="/membresia" className="mt-6">Conocer la membresía</EnlaceFlecha>
          </Revelar>
          <Revelar retraso={0.08}>
            <p className="eyebrow text-cafe/60">¿Vienen en grupo?</p>
            <p className="mt-4 font-display text-t3 font-light">Celebra diferente. Crea recuerdos que duran para siempre.</p>
            <EnlaceFlecha to="/eventos" className="mt-6">Cotizar un evento privado</EnlaceFlecha>
          </Revelar>
        </div>
      </section>
    </>
  );
}
