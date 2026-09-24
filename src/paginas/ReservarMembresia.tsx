import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMesesMembresia } from '../datos/hooks';
import type { Contacto, MesMembresia, Sesion } from '../datos/tipos';
import CheckoutLayout, { comprobarCupo, useApartado } from '../componentes/reservas/CheckoutLayout';
import BookingSummary from '../componentes/reservas/BookingSummary';
import Calendar from '../componentes/reservas/Calendar';
import TimeSlot from '../componentes/reservas/TimeSlot';
import PasoCuenta from '../componentes/reservas/PasoCuenta';
import PasoPago from '../componentes/reservas/PasoPago';
import Confirmacion from '../componentes/reservas/Confirmacion';
import { Aviso } from '../componentes/base/Campos';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import { MEMBRESIA } from '../contenido/oferta';
import { horariosMembresia } from '../lib/talleres';
import { diaSemana, fechaCompleta, rango, yaPaso } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { sinLugar } from '../lib/cupo';
import { useSeo } from '../lib/seo';

const PASOS = ['Mes', 'Tus 4 clases', 'Resumen', 'Tus datos', 'Pago'];
const CLASES = MEMBRESIA.clasesPorMes;

/** Un mes se ofrece si todavía caben 4 clases con lugar. */
function reservable(m: MesMembresia) {
  return m.sesiones.filter((s) => !sinLugar(s)).length >= CLASES;
}

export default function ReservarMembresia() {
  useSeo({
    titulo: 'Reservar membresía | Casa Numa',
    descripcion: 'Elige tus cuatro clases del mes entre viernes, sábados y domingos y reserva tu membresía NUMA.',
    indexar: false,
  });

  const { datos: meses, cargando, recargar } = useMesesMembresia();
  const disponibles = useMemo(() => (meses ?? []).filter(reservable), [meses]);
  const [paso, setPaso] = useState(0);
  const [clave, setClave] = useState<string | null>(null);
  const [elegidas, setElegidasEstado] = useState<string[]>([]);
  // Copia síncrona de la selección: dos toques seguidos, antes de que React
  // vuelva a pintar, no pueden colar una quinta clase.
  const elegidasRef = useRef<string[]>([]);
  const setElegidas = useCallback((nuevo: string[] | ((v: string[]) => string[])) => {
    const valor = typeof nuevo === 'function' ? nuevo(elegidasRef.current) : nuevo;
    elegidasRef.current = valor;
    setElegidasEstado(valor);
  }, []);
  const [dia, setDia] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const { reserva, setReserva, error, setError, apartando, apartar } = useApartado();

  useEffect(() => {
    if (!clave && disponibles[0]) setClave(disponibles[0].clave);
  }, [clave, disponibles]);

  const mes = disponibles.find((m) => m.clave === clave) ?? null;
  const porId = useMemo(() => new Map((mes?.sesiones ?? []).map((s) => [s.id, s])), [mes]);
  const seleccion = elegidas.map((id) => porId.get(id)).filter(Boolean) as Sesion[];
  const ordenadas = [...seleccion].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Si al recargar el cupo una clase elegida se llenó, se quita y se avisa.
  useEffect(() => {
    const llenas = seleccion.filter(sinLugar);
    if (llenas.length && paso <= 2) {
      setElegidas((v) => v.filter((id) => !llenas.some((s) => s.id === id)));
      setAviso(`${llenas.length === 1 ? 'Una de tus clases se llenó' : 'Algunas de tus clases se llenaron'}. Elige otra fecha.`);
    }
  }, [seleccion, paso, setElegidas]);

  function alternar(s: Sesion) {
    setAviso(null);
    setError(null);
    const actual = elegidasRef.current;
    if (actual.includes(s.id)) {
      setElegidas(actual.filter((x) => x !== s.id));
      return;
    }
    if (sinLugar(s)) return setAviso('Esa sesión está llena. Elige otra fecha.');
    if (yaPaso(s.fecha, s.inicio)) return setAviso('Esa fecha ya pasó.');
    if (actual.length >= CLASES) {
      return setAviso(`Ya elegiste tus ${CLASES} clases. Quita una para cambiarla.`);
    }
    setElegidas([...actual, s.id]);
  }

  function alDia(fecha: string) {
    setDia(fecha);
    const del = mes?.sesiones.filter((s) => s.fecha === fecha) ?? [];
    // Un solo horario ese día (viernes, sábado o domingo): se elige directo.
    if (del.length === 1) alternar(del[0]);
  }

  async function siguiente() {
    setAviso(null);
    if (paso === 0) {
      if (!mes) return setAviso('Elige el mes de tu membresía.');
      setPaso(1);
    } else if (paso === 1) {
      if (elegidas.length !== CLASES) return setAviso(`Te faltan ${CLASES - elegidas.length} ${CLASES - elegidas.length === 1 ? 'clase' : 'clases'} por elegir.`);
      setPaso(2);
    } else if (paso === 2) {
      setConsultando(true);
      const problema = await comprobarCupo(elegidas, 1).finally(() => setConsultando(false));
      if (problema) {
        setAviso('Una de tus clases se acaba de llenar. Elige otra fecha.');
        recargar();
        setPaso(1);
        return;
      }
      setPaso(3);
    }
  }

  async function aPago(contacto: Contacto) {
    if (!mes) return;
    const r = await apartar({ tipo: 'membresia', referencia: mes.clave, sesionIds: elegidas, participantes: 1, contacto });
    if (r) setPaso(4);
    else {
      recargar();
      setPaso(1);
    }
  }

  const alVencer = useCallback(() => {
    setReserva(null);
    setPaso(1);
    setAviso('Tu apartado venció antes de pagar. Revisa que tus fechas sigan disponibles.');
    recargar();
  }, [setReserva, recargar]);

  // Cuántas clases eligió de cada día (viernes, sábado, domingo).
  const porDia = new Map<number, number>();
  for (const s of seleccion) porDia.set(diaSemana(s.fecha), (porDia.get(diaSemana(s.fecha)) ?? 0) + 1);

  const confirmada = reserva?.estado === 'confirmada';
  const etiquetaMes = mes?.etiqueta.split(' ')[0] ?? '';

  return (
    <CheckoutLayout
      volver={{ to: '/membresia', texto: 'Membresía NUMA' }}
      eyebrow="Membresía NUMA"
      titulo={mes ? `Membresía de ${etiquetaMes}` : 'Tu membresía'}
      demo={mes?.demo}
      pasos={PASOS}
      paso={confirmada ? PASOS.length : paso}
      resumen={
        <BookingSummary
          titulo={mes ? `Membresía ${etiquetaMes}` : 'Membresía NUMA'}
          filas={[
            { k: 'Clases', v: <span className="cifra text-[1.2rem]">{elegidas.length} / {CLASES}</span> },
            { k: 'Horas de cerámica', v: `${MEMBRESIA.horasPorMes} h` },
            { k: 'Arcilla', v: 'Aprox. 3 kg en total' },
          ]}
          sesiones={ordenadas}
          total={MEMBRESIA.precio}
          accion={paso < 3 ? {
            texto: paso === 2 ? 'Continuar' : paso === 1 ? `Continuar (${elegidas.length}/${CLASES})` : 'Continuar',
            onClick: siguiente,
            cargando: consultando,
            deshabilitada: (paso === 1 && elegidas.length !== CLASES) || (paso === 0 && !mes),
          } : undefined}
          nota="Incluye materiales, herramientas, pintura, vidriado, horneado y acompañamiento."
        />
      }
    >
      {confirmada && reserva ? (
        <>
          <Confirmacion reserva={reserva} titulo="¡Tu membresía está lista!" silueta="guaje" volver={{ to: '/talleres', texto: 'Volver a talleres' }}>
            Tus cuatro clases ya están en tu cuenta. Trae ganas de ensuciarte las manos.
          </Confirmacion>
          <Pendiente className="mx-auto mt-10 max-w-3xl">Reglas de reprogramación y vigencia de clases.</Pendiente>
        </>
      ) : (
        <>
          {(aviso || error) && <div className="mb-8"><Aviso>{aviso ?? error}</Aviso></div>}

          {paso === 0 && (
            <section aria-labelledby="m-mes">
              <h2 id="m-mes" className="font-display text-t3 font-light">¿Qué mes quieres empezar?</h2>
              <p className="mt-3 max-w-lectura text-cuerpo text-cafe/75">
                Tu membresía incluye {CLASES} clases de {MEMBRESIA.horasPorClase} horas dentro del mismo mes.
              </p>
              {cargando && !meses && <div className="mt-8 h-40" aria-busy="true" />}
              {meses && disponibles.length === 0 && (
                <p className="mt-8 text-cuerpo text-cafe/80">Por ahora no hay meses con lugares. Suscríbete a las novedades y te avisamos cuando abramos.</p>
              )}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {disponibles.map((m) => {
                  const libres = m.sesiones.filter((s) => !sinLugar(s)).length;
                  const activo = m.clave === clave;
                  return (
                    <button
                      key={m.clave}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => { if (m.clave !== clave) { setClave(m.clave); setElegidas([]); setDia(null); } }}
                      className={`flex flex-col items-start rounded-suave border p-6 text-left transition-colors ${
                        activo ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 hover:border-cafe'
                      }`}
                    >
                      <span className="font-display text-t3 font-light capitalize">{m.etiqueta.split(' ')[0]}</span>
                      <span className={`mt-1 text-nota ${activo ? 'text-crema/75' : 'text-cafe/60'}`}>{m.etiqueta.split(' ')[1]}</span>
                      <span className={`eyebrow mt-6 text-[0.6rem] ${activo ? 'text-crema/80' : 'text-cafe/60'}`}>
                        {libres} sesiones con lugar
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {paso === 1 && mes && (
            <section aria-labelledby="m-clases">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="m-clases" className="font-display text-t3 font-light">Elige tus {CLASES} clases</h2>
                  <p className="mt-3 max-w-lectura text-cuerpo text-cafe/75">
                    Combina viernes, sábados y domingos como te acomode. Toca un día para elegirlo; tócalo otra vez para
                    quitarlo.
                  </p>
                </div>
                <p className="cifra text-[2.6rem] leading-none" aria-live="polite" aria-label={`${elegidas.length} de ${CLASES} clases elegidas`}>
                  {elegidas.length}<span className="text-cafe/35">/{CLASES}</span>
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-[0.74rem]">
                {horariosMembresia().map((h) => (
                  <span key={h.dia} className="rounded-full border border-cafe/15 px-3 py-1.5 text-cafe/75">
                    {h.dia} · {rango(h.inicio, h.fin)}
                    {(porDia.get(h.diaSemana) ?? 0) > 0 && (
                      <strong className="ml-1.5 font-medium text-cafe">× {porDia.get(h.diaSemana)}</strong>
                    )}
                  </span>
                ))}
              </div>

              <div className="mt-8 rounded-suave border border-cafe/12 p-5 sm:p-7">
                <Calendar mes={mes.clave} sesiones={mes.sesiones} seleccionadas={elegidas} diaActivo={dia} onDia={alDia} />
              </div>

              {ordenadas.length > 0 && (
                <div className="mt-8">
                  <p className="eyebrow text-cafe/60">Tus clases</p>
                  <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {ordenadas.map((s) => (
                      <li key={s.id}>
                        <TimeSlot
                          sesion={s}
                          seleccionada
                          onElegir={alternar}
                          etiqueta={fechaCompleta(s.fecha).replace(/^./, (c) => c.toUpperCase())}
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-center gap-2 text-[0.74rem] text-cafe/60">
                    <Icono.cerrar tam={13} /> Toca una clase para quitarla.
                  </p>
                </div>
              )}
              <Pendiente className="mt-8">Cupo por sesión de membresía (aquí 8 de ejemplo).</Pendiente>
            </section>
          )}

          {paso === 2 && mes && (
            <section aria-labelledby="m-resumen">
              <h2 id="m-resumen" className="font-display text-t3 font-light">Revisa tu membresía</h2>
              <ol className="mt-8 border-t border-cafe/15">
                {ordenadas.map((s, i) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 border-b border-cafe/15 py-5">
                    <span className="flex items-baseline gap-4">
                      <span className="cifra w-6 text-[1.3rem] text-terracota">{i + 1}</span>
                      <span className="text-cuerpo-l first-letter:uppercase">{fechaCompleta(s.fecha)}</span>
                    </span>
                    <span className="text-nota text-cafe/70">{rango(s.inicio, s.fin)}</span>
                  </li>
                ))}
              </ol>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {MEMBRESIA.incluye.map((i) => {
                  const P = Icono[i.icono];
                  return (
                    <li key={i.titulo} className="flex items-center gap-3 text-nota text-cafe/85">
                      <P tam={20} className="shrink-0 text-terracota" /> {i.titulo}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-8 text-nota text-cafe/75">
                {pesosCortos(MEMBRESIA.precio)} por el mes completo. El pago se realiza al iniciar la membresía.
              </p>
              <button type="button" onClick={() => setPaso(1)} className="subrayado-fijo mt-8 pb-0.5 text-nota">
                Cambiar fechas
              </button>
            </section>
          )}

          {paso === 3 && (
            <div aria-busy={apartando}>
              <PasoCuenta onListo={aPago} />
              {apartando && <p className="mt-6 text-nota text-cafe/70">Apartando tus {CLASES} clases…</p>}
              <button type="button" onClick={() => setPaso(2)} className="subrayado-fijo mt-8 pb-0.5 text-nota">Regresar</button>
            </div>
          )}

          {paso === 4 && reserva && <PasoPago reserva={reserva} onPagado={setReserva} onVencido={alVencer} />}
        </>
      )}
    </CheckoutLayout>
  );
}
