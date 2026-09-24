import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import type { SesionAdmin } from '../../datos/tipos';
import { AGENDA } from '../../datos/agenda';
import { DIAS_LARGOS, MESES, claveMes, diaSemana, etiquetaMes, hoy, partes, rango, sumarMeses, yaPaso } from '../../lib/calendario';
import { Icono } from '../../componentes/base/Iconos';
import { ETIQUETA_TIPO, EncabezadoPanel, PagoPill, useEnVivo } from './ui';

/** Ocupación visible solo con cupo confirmado; nunca se inventa una capacidad. */
function Ocupacion({ s }: { s: SesionAdmin }) {
  const cupo = s.sesion.cupo;
  if (cupo === null) {
    return <span className="text-[0.8rem] text-cafe/75">{s.ocupados} {s.ocupados === 1 ? 'reservado' : 'reservados'} · <span className="text-cafe/55">cupo por confirmar</span></span>;
  }
  const lleno = s.ocupados >= cupo;
  return (
    <span className="flex items-center gap-3">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-cafe/10" aria-hidden="true">
        <span className={`block h-full rounded-full ${lleno ? 'bg-naranja' : 'bg-cafe'}`} style={{ width: `${Math.min(100, (s.ocupados / Math.max(cupo, 1)) * 100)}%` }} />
      </span>
      <span className="text-[0.8rem]">{s.ocupados} / {cupo} lugares</span>
      {lleno && <span className="rounded-full bg-naranja px-2 py-[2px] text-[0.56rem] font-medium uppercase tracking-[0.12em] text-cafe">Agotado</span>}
    </span>
  );
}

export default function PanelCalendario() {
  // Arranca en el mes de la agenda más próximo (si hoy no hay nada, el primero con talleres).
  const primerMes = useMemo(() => {
    const actual = claveMes(hoy());
    const conAgenda = AGENDA.map((a) => claveMes(a.date)).filter((m) => m >= actual).sort()[0];
    return conAgenda ?? actual;
  }, []);
  const [mes, setMes] = useState(primerMes);
  const { datos, recargar } = useConsulta(`admin:agenda:${mes}`, () => repoAdmin.agenda(mes));
  useEnVivo(recargar);

  const porDia = useMemo(() => {
    const mapa = new Map<string, SesionAdmin[]>();
    for (const s of datos ?? []) mapa.set(s.sesion.fecha, [...(mapa.get(s.sesion.fecha) ?? []), s]);
    return [...mapa.entries()];
  }, [datos]);

  return (
    <div className="space-y-6">
      <EncabezadoPanel
        eyebrow="Agenda del estudio"
        titulo={etiquetaMes(mes).replace(/^./, (c) => c.toUpperCase())}
        accion={
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cafe/25 hover:border-cafe">
              <Icono.flechaIzq tam={16} />
            </button>
            <button type="button" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cafe/25 hover:border-cafe">
              <Icono.flecha tam={16} />
            </button>
          </div>
        }
      />
      <p className="text-[0.78rem] text-cafe/65">
        Talleres de la agenda, más las sesiones de NUMA Kids y membresía que tienen reservas. Toca una sesión para ver la lista.
      </p>

      {!datos ? (
        <div className="h-60" aria-busy="true" />
      ) : porDia.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/65">Sin sesiones ni reservas este mes.</p>
      ) : (
        <div className="space-y-8">
          {porDia.map(([fecha, sesiones]) => {
            const [, m, d] = partes(fecha);
            return (
              <section key={fecha} aria-label={fecha}>
                <h2 className={`flex items-baseline gap-3 border-b border-cafe/15 pb-2 ${fecha === hoy() ? 'text-terracota' : ''}`}>
                  <span className="cifra text-[2rem] leading-none">{String(d).padStart(2, '0')}</span>
                  <span className="eyebrow text-[0.62rem]">{DIAS_LARGOS[diaSemana(fecha)]} · {MESES[m - 1]}</span>
                  {fecha === hoy() && <span className="eyebrow text-[0.58rem]">Hoy</span>}
                </h2>
                <ul className="mt-3 space-y-2">
                  {sesiones.map((s) => (
                    <li key={s.sesion.id}>
                      <details className={`rounded-suave border border-cafe/12 bg-crema ${yaPaso(s.sesion.fecha, s.sesion.inicio) ? 'opacity-70' : ''}`}>
                        <summary className="grid cursor-pointer list-none gap-2 p-4 sm:grid-cols-[6.5rem_1fr_auto] sm:items-center">
                          <span className="text-[0.86rem] font-medium">{rango(s.sesion.inicio, s.sesion.fin)}</span>
                          <span>
                            <span className="block">{s.titulo}</span>
                            <span className="eyebrow text-[0.55rem] text-cafe/55">{ETIQUETA_TIPO[s.tipo]}{!s.reservaEnLinea ? ' · Info DM' : ''}</span>
                          </span>
                          <Ocupacion s={s} />
                        </summary>
                        <div className="border-t border-cafe/10 px-4 py-3">
                          {s.asistentes.length === 0 ? (
                            <p className="text-[0.8rem] text-cafe/60">Sin reservas todavía.</p>
                          ) : (
                            <ul className="divide-y divide-cafe/10 text-[0.84rem]">
                              {s.asistentes.map((a) => (
                                <li key={a.reservaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                  <Link to={`/admin/reservas/${a.reservaId}`} className="hover:text-terracota">
                                    <span className="font-medium">{a.nombre}</span>
                                    <span className="text-cafe/60"> · {a.personas} {a.personas === 1 ? 'persona' : 'personas'} · {a.folio ?? 'en proceso'}</span>
                                    {a.ninos?.length ? <span className="block text-[0.74rem] text-cafe/60">{a.ninos.map((n) => `${n.nombre} (${n.edad})`).join(', ')}</span> : null}
                                  </Link>
                                  <span className="flex items-center gap-3 text-[0.78rem] text-cafe/70">
                                    {a.telefono}
                                    <PagoPill pago={a.pago} />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
