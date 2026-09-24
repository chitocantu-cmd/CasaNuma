import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTalleres } from '../datos/hooks';
import type { CategoriaTaller, Taller } from '../datos/tipos';
import WorkshopCard from '../componentes/WorkshopCard';
import AgendaMes from '../componentes/reservas/AgendaMes';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { Pendiente } from '../componentes/base/Pendiente';
import { Aviso } from '../componentes/base/Campos';
import { Boton, EnlaceFlecha } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import CeramicShape from '../componentes/marca/CeramicShape';
import { MESES, claveMes, fechaCompleta, partes, rango, sumarMeses } from '../lib/calendario';
import { FILTROS, esProximo, precioTaller, publicoTaller, semanaDelMes } from '../lib/talleres';
import { useSeo } from '../lib/seo';

interface Semana {
  clave: string;
  numero: number;
  desde: string;
  hasta: string;
  talleres: Taller[];
}

/** Agrupa por mes y, dentro, por semana (lunes a domingo). */
function agrupar(talleres: Taller[]) {
  const meses = new Map<string, Map<number, Taller[]>>();
  for (const t of talleres) {
    const f = t.sesiones[0].fecha;
    const mes = claveMes(f);
    const semanas = meses.get(mes) ?? new Map<number, Taller[]>();
    const n = semanaDelMes(f);
    semanas.set(n, [...(semanas.get(n) ?? []), t]);
    meses.set(mes, semanas);
  }
  return [...meses.entries()].map(([mes, semanas]) => ({
    mes,
    semanas: [...semanas.entries()].map<Semana>(([numero, lista]) => {
      const fechas = lista.flatMap((t) => t.sesiones.map((s) => s.fecha)).sort();
      return { clave: `${mes}-${numero}`, numero, desde: fechas[0], hasta: fechas[fechas.length - 1], talleres: lista };
    }),
  }));
}

function nombreMes(clave: string) {
  const [, m] = clave.split('-').map(Number);
  return MESES[m - 1];
}

/** "1 al 4 de octubre" */
function rangoFechas(desde: string, hasta: string) {
  const [, m1, d1] = partes(desde);
  const [, m2, d2] = partes(hasta);
  if (desde === hasta) return `${d1} de ${MESES[m1 - 1]}`;
  return m1 === m2 ? `${d1} al ${d2} de ${MESES[m1 - 1]}` : `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

export default function Talleres() {
  useSeo({
    titulo: 'Talleres de Cerámica | Casa Numa',
    descripcion:
      'Agenda de talleres de cerámica en San Pedro Garza García: tardes de cerámica para niños y adultos, clases y talleres de temporada.',
  });

  const { datos: talleres, cargando, error, recargar } = useTalleres();
  const [vista, setVista] = useState<'fichas' | 'calendario'>('fichas');
  const [filtro, setFiltro] = useState<CategoriaTaller | 'todos'>('todos');

  const filtrados = useMemo(
    () => (talleres ?? []).filter((t) => filtro === 'todos' || t.categoria === filtro),
    [talleres, filtro],
  );
  const proximos = useMemo(() => filtrados.filter(esProximo), [filtrados]);
  const grupos = useMemo(() => agrupar(proximos), [proximos]);

  // Calendario: meses con actividades; arranca en el primero con algo próximo.
  const meses = useMemo(
    () => [...new Set(filtrados.flatMap((t) => t.sesiones.map((s) => claveMes(s.fecha))))].sort(),
    [filtrados],
  );
  const [mes, setMes] = useState<string | null>(null);
  const mesActivo = mes && meses.includes(mes) ? mes : grupos[0]?.mes ?? meses[0] ?? null;
  const [dia, setDia] = useState<string | null>(null);

  // Al abrir el calendario, mostrar de una vez el primer día con talleres.
  useEffect(() => {
    if (vista !== 'calendario' || !mesActivo) return;
    const delMes = filtrados
      .flatMap((t) => t.sesiones.map((s) => s.fecha))
      .filter((f) => f.startsWith(mesActivo))
      .sort();
    if (!dia || !delMes.includes(dia)) setDia(delMes[0] ?? null);
  }, [vista, mesActivo, filtrados, dia]);

  const delDia = filtrados.filter((t) => t.sesiones.some((s) => s.fecha === dia));
  const mesPortada = grupos[0]?.mes ?? mesActivo;

  return (
    <>
      {/* Portada compacta: la agenda tiene que verse de inmediato */}
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-8">
          <Revelar className="lg:col-span-7">
            <p className="eyebrow text-cafe/70">Talleres · Agenda</p>
            <h1 className="mt-6 max-w-[18ch] font-display text-t1 font-light">Cada fin de semana, una nueva experiencia.</h1>
            <p className="mt-6 max-w-lectura text-cuerpo-l text-cafe/85">
              Descubre nuestros talleres de cerámica, elige tu proyecto favorito y disfruta de un momento creativo en Casa
              Numa. Selecciona la fecha y el horario que más te gusten y reserva tu lugar.
            </p>
          </Revelar>
          {mesPortada && (
            <Revelar retraso={0.1} className="lg:col-span-4 lg:col-start-9">
              <div className="relative overflow-hidden rounded-suave border border-cafe/15 p-6">
                <span className="absolute inset-x-0 top-0 h-1 bg-naranja" aria-hidden="true" />
                <p className="cifra text-[3.4rem] uppercase leading-none tracking-[0.02em]">{nombreMes(mesPortada)}</p>
                <p className="mt-2 font-display text-t4 font-light">Una nueva experiencia cada semana.</p>
                <div className="mt-5 flex items-end gap-3" aria-hidden="true">
                  <CeramicShape nombre="taza" color="text-naranja" className="h-7 w-auto" />
                  <CeramicShape nombre="tarro" className="h-9 w-auto" />
                  <CeramicShape nombre="cuenco" className="h-5 w-auto" />
                </div>
              </div>
            </Revelar>
          )}
        </div>

        {/* Vista y filtros */}
        <div className="mt-12 flex flex-col gap-4 border-t border-cafe/12 pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex self-start rounded-full border border-cafe/20 p-1" role="tablist" aria-label="Vista de la agenda">
            {([['fichas', 'Próximos talleres'], ['calendario', 'Ver calendario']] as const).map(([v, t]) => (
              <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
                className={`min-h-11 rounded-full px-5 text-[0.8rem] transition-colors ${vista === v ? 'bg-cafe text-crema' : 'text-cafe/75 hover:text-cafe'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="carril -mx-canal flex gap-2 overflow-x-auto px-canal lg:mx-0 lg:px-0" role="group" aria-label="Filtrar talleres">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-5 text-[0.76rem] uppercase tracking-[0.12em] transition-colors ${
                  filtro === f.id ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 text-cafe/80 hover:border-cafe'
                }`}>
                {f.id === 'temporada' && <span className="h-1.5 w-1.5 rounded-full bg-naranja" aria-hidden="true" />}
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="contenedor pb-seccion pt-10" aria-live="polite">
        {cargando && !talleres && <div className="h-96" aria-busy="true" />}
        {error && (
          <div className="max-w-xl">
            <Aviso>No pudimos cargar la agenda. {error}</Aviso>
            <Boton variante="secundario" className="mt-4" onClick={recargar}>Reintentar</Boton>
          </div>
        )}

        {/* --- Próximos talleres, por mes y semana ------------------------------ */}
        {talleres && vista === 'fichas' && (
          grupos.length === 0 ? (
            <p className="max-w-lectura py-10 text-cuerpo-l text-cafe/80">
              {filtro === 'todos'
                ? 'Estamos preparando las próximas fechas. Suscríbete a las novedades para enterarte primero.'
                : 'No hay talleres de esta categoría en la agenda por ahora.'}
            </p>
          ) : (
            <div className="space-y-20">
              {grupos.map((g) => (
                <div key={g.mes}>
                  <Revelar className="flex flex-wrap items-end justify-between gap-4">
                    <h2 className="font-display text-t2 font-light capitalize">{nombreMes(g.mes)}</h2>
                    <p className="text-nota text-cafe/70">Una nueva experiencia cada semana.</p>
                  </Revelar>
                  {g.semanas.map((s) => (
                    <div key={s.clave} className="mt-10">
                      <p className="flex items-center gap-4 text-cafe/70">
                        <span className="cifra text-[1.25rem] leading-none tracking-[0.04em] text-cafe">Semana {s.numero}</span>
                        <span className="h-px flex-1 bg-cafe/15" aria-hidden="true" />
                        <span className="text-[0.78rem]">{rangoFechas(s.desde, s.hasta)}</span>
                      </p>
                      <div className="mt-8 grid gap-x-6 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
                        {s.talleres.map((t, i) => (
                          <Revelar key={t.id} retraso={(i % 3) * 0.06} className="h-full">
                            <WorkshopCard taller={t} />
                          </Revelar>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        )}

        {/* --- Calendario ------------------------------------------------------- */}
        {talleres && vista === 'calendario' && mesActivo && (
          <div className="grid gap-12 xl:grid-cols-12 xl:gap-8">
            <div className="xl:col-span-8">
              <AgendaMes
                mes={mesActivo}
                talleres={filtrados}
                diaActivo={dia}
                onDia={setDia}
                onMes={(d) => { setMes(sumarMeses(mesActivo, d)); setDia(null); }}
                puedeAnterior={meses.indexOf(mesActivo) > 0}
                puedeSiguiente={meses.indexOf(mesActivo) < meses.length - 1}
              />
            </div>
            <div className="xl:col-span-4">
              {dia && delDia.length > 0 ? (
                <>
                  <p className="eyebrow text-cafe/60 first-letter:uppercase">{fechaCompleta(dia)}</p>
                  <ul className="mt-5 space-y-3">
                    {delDia.map((t) => (
                      <li key={t.id}>
                        <Link
                          to={`/talleres/${t.slug}`}
                          className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 rounded-suave border border-cafe/15 p-3 pr-4 transition-colors hover:border-cafe"
                        >
                          <Foto id={t.foto} className="aspect-square w-full rounded-[0.5rem]" sizes="88px" />
                          <span className="min-w-0">
                            <span className="eyebrow block text-[0.56rem] text-cafe/60">{publicoTaller(t)}</span>
                            <span className="mt-1 block font-display text-t4 font-light leading-tight">{t.titulo}</span>
                            <span className="mt-1 block text-[0.78rem] text-cafe/70">
                              {t.sesiones.filter((s) => s.fecha === dia).map((s) => rango(s.inicio, s.fin)).join(' · ')}
                              {' · '}{precioTaller(t)}
                            </span>
                          </span>
                          <Icono.flecha tam={17} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-cuerpo text-cafe/70">Elige un día marcado para ver sus talleres.</p>
              )}
            </div>
          </div>
        )}

        <Pendiente className="mt-14">
          Semana 1 de octubre confirmada. Faltan las semanas 2 a 4, el precio de las tardes y clases de cerámica
          (publicado como «Info DM»), el cupo de cada taller y la hora de término de los talleres de Halloween.
        </Pendiente>
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
