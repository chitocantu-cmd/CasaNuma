import { useEffect, useState, type ReactNode, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorDatos, repoAdmin } from '../../datos';
import type { CambiosReserva } from '../../datos/repositorio';
import { invalidarCupos, useConsulta } from '../../datos/hooks';
import type { Aviso as AvisoT, MetodoPago, Reserva } from '../../datos/tipos';
import { sePuedeElegir } from '../../datos/pinta';
import { saldoPendiente } from '../../lib/anticipo';
import { fechaCompleta, rango, yaPaso } from '../../lib/calendario';
import { enlaceWhatsapp as waDe, soloDigitos } from '../../lib/formato';
import { Icono } from '../../componentes/base/Iconos';
import { Aviso } from '../../componentes/base/Campos';
import ErrorCarga from '../../componentes/base/ErrorCarga';
import { CargandoBloque } from '../../componentes/base/Cargando';
import {
  DemoPill, ETIQUETA_AVISO, ETIQUETA_METODO, ETIQUETA_TIPO, EstadoPill, PagoPill, Tarjeta, claseCampo, dinero, fechaHora, horaCorta,
} from './ui';

const mayuscula = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

function Dato({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-cafe/10 py-2.5 last:border-0">
      <dt className="text-[0.78rem] text-cafe/60">{k}</dt>
      <dd className="text-right text-[0.9rem]">{children}</dd>
    </div>
  );
}

export default function PanelReserva() {
  const { id = '' } = useParams();
  const { datos: r, cargando, error, recargar } = useConsulta(`admin:reserva:${id}`, () => repoAdmin.reserva(id));
  const { datos: avisos, recargar: recargarAvisos } = useConsulta(`admin:avisos:${id}`, () => repoAdmin.avisos(id));
  const { datos: pagos, recargar: recargarPagos } = useConsulta('admin:pagos', () => repoAdmin.pagos());
  const movimientos = (pagos ?? []).filter((p) => p.reservaId === id).sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false);

  // Al cargar (o recargar) la reserva, el campo toma la nota guardada.
  const notaGuardada = r?.notasInternas;
  useEffect(() => {
    if (notaGuardada !== undefined) setNotas(notaGuardada);
  }, [notaGuardada]);

  const enCurso = useRef(false);
  async function cambiar(cambios: CambiosReserva, exito: string) {
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(exito);
    setMensaje(null);
    try {
      await repoAdmin.actualizarReserva(id, cambios);
      invalidarCupos();
      recargar();
      recargarAvisos();
      setMensaje({ tipo: 'exito', texto: exito });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof ErrorDatos ? e.message : 'No pudimos guardar el cambio.' });
    } finally {
      enCurso.current = false;
      setGuardando(null);
      setConfirmarCancelacion(false);
    }
  }

  if (cargando && !r) return <CargandoBloque className="h-80" />;
  if (error && !r) return <ErrorCarga onReintentar={recargar} />;
  if (!r) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-[1.8rem] font-light">No encontramos esa reserva.</p>
        <Link to="/admin/reservas" className="subrayado-fijo mt-6 inline-block pb-0.5 text-nota">Volver a reservas</Link>
      </div>
    );
  }

  const tel = soloDigitos(r.contacto.telefono);
  const wa = waDe(r.contacto.telefono);
  const todasPasaron = r.sesiones.every((s) => yaPaso(s.fecha, s.inicio));

  return (
    <div className="space-y-6">
      <Link to="/admin/reservas" className="group inline-flex items-center gap-2 text-nota text-cafe/70 hover:text-cafe">
        <Icono.flechaIzq tam={16} className="transition-transform group-hover:-translate-x-1" /> Reservas
      </Link>

      <header className="flex flex-col gap-4 border-b border-cafe/12 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[0.62rem] text-cafe/60">
            {ETIQUETA_TIPO[r.tipo]} · {r.origen === 'panel' ? 'Registrada en el panel' : 'Reservada en la web'}
          </p>
          <h1 className="cifra mt-2 text-[3rem] leading-none tracking-[0.03em]">{r.folio ?? 'Pago en proceso'}</h1>
          <p className="mt-2 text-[0.8rem] text-cafe/65">Compra: {fechaHora(r.creadaEn)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoPill estado={r.estado} />
          <PagoPill pago={r.pago} />
          {r.demo && <DemoPill />}
        </div>
      </header>

      {mensaje && <Aviso tipo={mensaje.tipo === 'exito' ? 'exito' : 'error'}>{mensaje.texto}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Tarjeta titulo={r.ninos?.length ? 'Mamá, papá o tutor' : 'Cliente'}>
            <p className="font-display text-[1.6rem] font-light leading-tight">{r.contacto.nombre}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[0.82rem]">
              <a href={`tel:${tel}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cafe/20 px-4 hover:border-cafe">
                <Icono.telefono tam={15} /> {r.contacto.telefono}
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cafe/20 px-4 hover:border-cafe">
                  <Icono.whatsapp tam={15} /> WhatsApp
                </a>
              )}
              <a href={`mailto:${r.contacto.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-cafe/20 px-4 hover:border-cafe">
                <Icono.sobre tam={15} /> {r.contacto.email}
              </a>
            </div>
            {r.ninos?.length ? (
              <div className="mt-5 border-t border-cafe/10 pt-4">
                <p className="eyebrow text-[0.58rem] text-cafe/60">Niños</p>
                <ul className="mt-2 space-y-1 text-[0.9rem]">
                  {r.ninos.map((n) => <li key={n.nombre}>{n.nombre} · {n.edad} años</li>)}
                </ul>
              </div>
            ) : null}
            {!r.usuarioId && <p className="mt-4 text-[0.74rem] text-cafe/55">Sin cuenta en el sitio.</p>}
          </Tarjeta>

          <Tarjeta titulo="Experiencia">
            <p className="font-display text-[1.5rem] font-light leading-tight">{r.titulo}</p>
            {r.tipo === 'membresia' ? (
              <ol className="mt-4 space-y-2">
                {Array.from({ length: 4 }, (_, i) => r.sesiones[i] ?? null).map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-[0.5rem] border border-cafe/10 px-3 py-2 text-[0.86rem]">
                    <span className="flex items-baseline gap-3">
                      <span className="cifra w-8 text-cafe/50">{i + 1}/4</span>
                      {s ? `${mayuscula(fechaCompleta(s.fecha))} · ${horaCorta(s.inicio)}` : 'Sin fecha'}
                    </span>
                    <span className="eyebrow text-[0.56rem] text-cafe/65">
                      {!s ? 'Disponible' : yaPaso(s.fecha, s.inicio) ? 'Utilizada' : 'Reservada'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <dl className="mt-4">
                {r.sesiones.map((s) => (
                  <Dato key={s.id} k="Fecha y horario">{mayuscula(fechaCompleta(s.fecha))} · {rango(s.inicio, s.fin)}</Dato>
                ))}
                {r.pieza ? (
                  <Dato k="Pieza"><span className="font-medium">{r.pieza.nombre}</span> · {dinero(r.pieza.precio)}</Dato>
                ) : (
                  <Dato k={r.tipo === 'kids' ? 'Niños' : 'Participantes'}>{r.participantes}</Dato>
                )}
              </dl>
            )}
            {r.pieza && r.pieza.cambios.length > 0 && (
              <div className="mt-4 border-t border-cafe/10 pt-4">
                <p className="eyebrow text-[0.58rem] text-cafe/60">Cambios de pieza en el estudio</p>
                <ol className="mt-2 space-y-1.5 text-[0.82rem]">
                  {r.pieza.cambios.map((c, i) => (
                    <li key={`${i}-${c.en}`}>
                      {c.de.nombre} ({dinero(c.de.precio)}) → <span className="font-medium">{c.a.nombre}</span> ({dinero(c.a.precio)})
                      <span className="text-cafe/55"> · {fechaHora(c.en)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Pago">
            {r.cobro ? (
              <>
                {r.cobro.saldo < 0 && r.estado !== 'cancelada' && (
                  <div role="alert" className="mb-4 rounded-[0.6rem] border border-naranja bg-naranja/[0.12] p-3 text-[0.82rem]">
                    <p className="eyebrow text-[0.62rem] text-cafe">Revisión manual requerida</p>
                    <p className="mt-1 text-cafe/80">
                      Pagó {dinero(r.cobro.pagado)} y la pieza actual vale {dinero(r.total)}: {dinero(-r.cobro.saldo)} a su favor.
                      No hay reembolsos automáticos; resuélvelo según la política de Casa Numa.
                    </p>
                  </div>
                )}
                <dl>
                  {r.tipo !== 'pinta' && <Dato k={r.tipo === 'membresia' ? 'Precio mensual' : r.tipo === 'kids' ? 'Precio por niño' : 'Precio por persona'}>{dinero(r.precioUnitario)} MXN</Dato>}
                  <Dato k={r.pieza ? 'Precio total (pieza)' : 'Precio total'}><span className="cifra text-[1.4rem]" data-total-panel>{dinero(r.total)} MXN</span></Dato>
                  <Dato k={`Anticipo recibido (${r.cobro.porcentaje} %)`}>{r.estado === 'pendiente_pago' ? '—' : `${dinero(r.cobro.anticipo)} MXN`}</Dato>
                  <Dato k="Pago final en el estudio">{r.cobro.pagoFinal !== null ? `${dinero(r.cobro.pagoFinal)} MXN` : '—'}</Dato>
                  <Dato k="Pagado hasta hoy">{dinero(r.cobro.pagado)} MXN</Dato>
                  <Dato k="Saldo pendiente">
                    <span className={`cifra text-[1.4rem] ${r.cobro.saldo > 0 ? 'text-terracota' : ''}`} data-saldo-panel>
                      {r.cobro.saldo < 0 ? 'Revisión' : `${dinero(r.cobro.saldo)} MXN`}
                    </span>
                  </Dato>
                  <Dato k="Estado"><PagoPill pago={r.pago} /></Dato>
                </dl>
                {movimientos.length > 0 && (
                  <div className="mt-4 border-t border-cafe/10 pt-4">
                    <p className="eyebrow text-[0.58rem] text-cafe/60">Movimientos</p>
                    <ul className="mt-2 space-y-1.5 text-[0.82rem]">
                      {movimientos.map((p) => (
                        <li key={p.id} className="flex flex-wrap justify-between gap-2">
                          <span>
                            {p.concepto === 'saldo' ? 'Saldo en el estudio' : p.concepto === 'anticipo' ? 'Anticipo en línea' : 'Pago'}
                            <span className="text-cafe/55"> · {p.metodo ? ETIQUETA_METODO[p.metodo] : '—'} · {fechaHora(p.creadoEn)}</span>
                          </span>
                          <span className="flex items-center gap-2">{dinero(p.monto)} <PagoPill pago={p.estado} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <dl>
                <Dato k="Precio unitario">{dinero(r.precioUnitario)} MXN</Dato>
                <Dato k="Subtotal">{dinero(r.subtotal)} MXN</Dato>
                <Dato k="Total"><span className="cifra text-[1.4rem]">{dinero(r.total)} MXN</span></Dato>
                <Dato k="Método">{r.metodoPago ? ETIQUETA_METODO[r.metodoPago] : '—'}</Dato>
                <Dato k="Referencia"><span className="font-mono text-[0.8rem]">{r.referenciaPago ?? '—'}</span></Dato>
                <Dato k="Estado"><PagoPill pago={r.pago} /></Dato>
                {r.pagadaEn && <Dato k="Pagado el">{fechaHora(r.pagadaEn)}</Dato>}
              </dl>
            )}
          </Tarjeta>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {r.cobro && (r.estado === 'confirmada' || r.estado === 'completada') && (
            <AccionesCobro
              reserva={r}
              onListo={(texto, error = false) => {
                setMensaje({ tipo: error ? 'error' : 'exito', texto });
                if (!error) {
                  invalidarCupos();
                  recargar();
                  recargarPagos();
                }
              }}
            />
          )}
          <Tarjeta titulo="Estado">
            <div className="flex flex-wrap gap-2">
              <EstadoPill estado={r.estado} />
              <PagoPill pago={r.pago} />
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {r.pago === 'pendiente' && r.estado === 'pendiente_pago' && r.origen === 'panel' && (
                <button type="button" disabled={!!guardando} onClick={() => cambiar({ pago: 'pagado' }, 'Pago registrado: la reserva quedó confirmada.')}
                  className="min-h-10 rounded-full bg-cafe px-5 text-[0.76rem] font-medium uppercase tracking-[0.12em] text-crema disabled:opacity-50">
                  Registrar pago recibido
                </button>
              )}
              {r.estado === 'pendiente_pago' && r.origen === 'web' && (
                <p className="text-[0.78rem] text-cafe/70">
                  La clienta está pagando en línea. La reserva se confirma sola cuando el proveedor de pagos confirme el cobro.
                </p>
              )}
              {r.estado === 'confirmada' && (
                <button type="button" disabled={!!guardando} onClick={() => cambiar({ estado: 'completada' }, 'Reserva marcada como completada.')}
                  className="min-h-10 rounded-full border border-cafe/25 px-5 text-[0.76rem] font-medium uppercase tracking-[0.12em] hover:border-cafe disabled:opacity-50">
                  {todasPasaron ? 'Marcar como completada' : 'Marcar como completada (antes de la fecha)'}
                </button>
              )}
              {(r.estado === 'confirmada' || r.estado === 'pendiente_pago') && (
                confirmarCancelacion ? (
                  <div className="rounded-[0.6rem] border border-naranja/60 bg-naranja/[0.08] p-3 text-[0.8rem]">
                    <p>¿Cancelar esta reserva? Los lugares se liberan de inmediato{r.pieza ? ' y la pieza vuelve al inventario' : ''}.</p>
                    {(r.pago === 'pagado' || r.pago === 'anticipo_pagado') && (
                      <p className="mt-1 text-cafe/70">
                        El pago queda registrado: si corresponde reembolso, hazlo en el proveedor y márcalo aquí.
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button type="button" disabled={!!guardando} onClick={() => cambiar({ estado: 'cancelada' }, 'Reserva cancelada: los lugares quedaron libres.')}
                        className="min-h-9 rounded-full bg-cafe px-4 text-[0.72rem] font-medium uppercase tracking-[0.1em] text-crema">Sí, cancelar</button>
                      <button type="button" onClick={() => setConfirmarCancelacion(false)} className="min-h-9 rounded-full px-4 text-[0.72rem] uppercase tracking-[0.1em]">No</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmarCancelacion(true)}
                    className="min-h-10 rounded-full px-5 text-[0.76rem] font-medium uppercase tracking-[0.12em] text-cafe/75 hover:text-cafe">
                    Cancelar reserva
                  </button>
                )
              )}
              {r.estado === 'cancelada' && (r.pago === 'pagado' || r.pago === 'anticipo_pagado') && (
                <button type="button" disabled={!!guardando} onClick={() => cambiar({ pago: 'reembolsado' }, 'Pago marcado como reembolsado.')}
                  className="min-h-10 rounded-full border border-cafe/25 px-5 text-[0.76rem] font-medium uppercase tracking-[0.12em] hover:border-cafe">
                  Marcar como reembolsado
                </button>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Notas internas">
            <label htmlFor="notas" className="sr-only">Notas internas</label>
            <textarea
              id="notas"
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. Avisó que llegará 10 minutos tarde."
              className="w-full resize-none rounded-[0.5rem] border border-cafe/20 bg-crema p-3 text-[0.86rem] outline-none focus:border-cafe"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[0.72rem] text-cafe/55">Solo las ve el equipo.</p>
              <button type="button" disabled={notas === r.notasInternas || !!guardando} onClick={() => cambiar({ notasInternas: notas }, 'Nota guardada.')}
                className="min-h-9 rounded-full border border-cafe/25 px-4 text-[0.72rem] font-medium uppercase tracking-[0.1em] hover:border-cafe disabled:opacity-40">
                Guardar nota
              </button>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Avisos">
            {!avisos?.length ? (
              <p className="text-[0.8rem] text-cafe/65">
                {r.estado === 'confirmada' || r.estado === 'completada'
                  ? r.demo ? 'Reserva de ejemplo: se cargó sin avisos.' : 'Sin avisos registrados.'
                  : 'Los avisos salen cuando la reserva se confirma.'}
              </p>
            ) : (
              <ul className="space-y-2">{avisos.map((a) => <AvisoFila key={a.id} aviso={a} />)}</ul>
            )}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

/**
 * Reserva en línea en el estudio: cobrar el saldo que dejó el anticipo y, en
 * Pinta tu pieza, cambiar de pieza (saldo = precio final − total ya pagado).
 */
function AccionesCobro({ reserva: r, onListo }: { reserva: Reserva; onListo: (texto: string, error?: boolean) => void }) {
  const { datos: piezas } = useConsulta(r.pieza ? 'admin:piezas' : null, () => repoAdmin.piezas());
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [piezaId, setPiezaId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const cobro = r.cobro!;

  const opciones = (piezas ?? []).filter((p) => p.id !== r.pieza?.id && sePuedeElegir(p));
  const nueva = opciones.find((p) => p.id === piezaId);
  const nuevoSaldo = nueva?.precio != null ? saldoPendiente(nueva.precio, cobro.pagado) : null;

  async function correr(accion: () => Promise<unknown>, exito: string) {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    try {
      await accion();
      setMetodo('');
      setPiezaId('');
      onListo(exito);
    } catch (e) {
      onListo(e instanceof ErrorDatos ? e.message : 'No pudimos guardar el cambio.', true);
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  return (
    <Tarjeta titulo="Cobro en el estudio">
      {cobro.saldo > 0 ? (
        <>
          <p className="text-[0.86rem]">
            Falta cobrar <span className="cifra text-[1.4rem]">{dinero(cobro.saldo)}</span>
            <span className="block text-[0.76rem] text-cafe/65">
              Precio final {dinero(r.total)} − ya pagado {dinero(cobro.pagado)}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago | '')} className={`${claseCampo} min-w-0 flex-1`} aria-label="Cómo pagó el saldo">
              <option value="">¿Cómo pagó?</option>
              {(['efectivo', 'tarjeta', 'transferencia', 'otro'] as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETA_METODO[m]}</option>)}
            </select>
            <button
              type="button"
              disabled={!metodo || ocupado}
              onClick={() => metodo && correr(() => repoAdmin.liquidarSaldo(r.id, metodo), `Saldo de ${dinero(cobro.saldo)} cobrado: la reserva quedó pagada completa.`)}
              className="min-h-10 rounded-full bg-cafe px-5 text-[0.74rem] font-medium uppercase tracking-[0.12em] text-crema disabled:opacity-40"
            >
              Marcar saldo como pagado
            </button>
          </div>
        </>
      ) : cobro.saldo === 0 ? (
        <p className="flex items-center gap-2 text-[0.86rem]"><Icono.check tam={16} className="text-verde" /> Saldo liquidado: pagó {dinero(cobro.pagado)}.</p>
      ) : (
        <p className="text-[0.86rem] text-cafe/80">Revisión manual requerida: pagó {dinero(-cobro.saldo)} más de lo que vale su pieza.</p>
      )}

      {r.pieza && (
      <div className="mt-5 border-t border-cafe/10 pt-4">
        <label htmlFor="cambiar-pieza" className="eyebrow text-[0.58rem] text-cafe/60">¿Cambió de pieza?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <select id="cambiar-pieza" value={piezaId} onChange={(e) => setPiezaId(e.target.value)} className={`${claseCampo} min-w-0 flex-1`}>
            <option value="">Elige la nueva pieza</option>
            {opciones.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {dinero(p.precio ?? 0)}</option>)}
          </select>
          <button
            type="button"
            disabled={!nueva || ocupado}
            onClick={() => nueva && correr(() => repoAdmin.cambiarPieza(r.id, nueva.id), `Pieza cambiada a «${nueva.nombre}».`)}
            className="min-h-10 rounded-full border border-cafe/25 px-5 text-[0.74rem] font-medium uppercase tracking-[0.12em] hover:border-cafe disabled:opacity-40"
          >
            Cambiar pieza
          </button>
        </div>
        {nueva && nueva.precio !== null && nuevoSaldo !== null && (
          <p className={`mt-3 rounded-[0.5rem] px-3 py-2 text-[0.8rem] ${nuevoSaldo < 0 ? 'border border-naranja bg-naranja/10' : 'bg-cafe/[0.04]'}`} data-vista-cambio>
            Nuevo total {dinero(nueva.precio)} · ya pagó {dinero(cobro.pagado)} ·{' '}
            {nuevoSaldo < 0 ? (
              <strong className="font-medium">REVISIÓN MANUAL REQUERIDA ({dinero(-nuevoSaldo)} a su favor)</strong>
            ) : (
              <strong className="font-medium">saldo {dinero(nuevoSaldo)}</strong>
            )}
          </p>
        )}
      </div>
      )}
    </Tarjeta>
  );
}

function AvisoFila({ aviso: a }: { aviso: AvisoT }) {
  return (
    <li>
      <details className="group rounded-[0.6rem] border border-cafe/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[0.82rem]">
          <span className="flex items-center gap-2">
            {a.canal === 'email' ? <Icono.sobre tam={15} /> : <Icono.whatsapp tam={15} />}
            {a.canal === 'email' ? 'Correo' : 'WhatsApp'} {a.destinatario === 'equipo' ? 'al equipo' : 'a la clienta'}
          </span>
          <span className="text-[0.7rem] text-cafe/60">
            {ETIQUETA_AVISO[a.estado]}
          </span>
        </summary>
        <div className="border-t border-cafe/10 px-3 py-3 text-[0.78rem]">
          <p className="text-cafe/60">Para: {a.para ?? (a.canal === 'email' ? 'ADMIN_NOTIFICATION_EMAIL (sin configurar)' : 'API de WhatsApp (por conectar)')}</p>
          <p className="mt-1 font-medium">{a.asunto}</p>
          {a.error && <p className="mt-1 text-naranja">{a.error}</p>}
        </div>
      </details>
    </li>
  );
}

