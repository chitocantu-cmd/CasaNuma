import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { repo } from '../datos';
import { usePiezasPinta, useSesionesPinta } from '../datos/hooks';
import { estadoPieza, sePuedeElegir } from '../datos/pinta';
import type { Contacto, PiezaPinta } from '../datos/tipos';
import CheckoutLayout, { comprobarCupo, useApartado } from '../componentes/reservas/CheckoutLayout';
import BookingSummary, { type Fila } from '../componentes/reservas/BookingSummary';
import Calendar from '../componentes/reservas/Calendar';
import TimeSlot from '../componentes/reservas/TimeSlot';
import PasoCuenta from '../componentes/reservas/PasoCuenta';
import PasoPago from '../componentes/reservas/PasoPago';
import Confirmacion from '../componentes/reservas/Confirmacion';
import DesgloseAnticipo from '../componentes/pinta/DesgloseAnticipo';
import TarjetaPieza from '../componentes/pinta/TarjetaPieza';
import { Aviso, Casilla } from '../componentes/base/Campos';
import CtaWhatsapp from '../componentes/base/CtaWhatsapp';
import ErrorCarga from '../componentes/base/ErrorCarga';
import { CargandoBloque } from '../componentes/base/Cargando';
import { Pendiente } from '../componentes/base/Pendiente';
import { CATEGORIAS_PIEZA, GALERIA_PINTA, type CategoriaPieza } from '../contenido/piezasPinta';
import { mensajePintaTuPieza } from '../contenido/whatsapp';
import { calcularPagoReserva, saldoPendiente } from '../lib/anticipo';
import { claveMes, fechaCompleta, hora, rango } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { sinLugar } from '../lib/cupo';
import { borrarBorrador, useBorrador } from '../lib/borrador';
import { useSeo } from '../lib/seo';

const PASOS = ['Fecha', 'Horario', 'Pieza', 'Datos', 'Pago'];
const BORRADORES = ['pinta:paso', 'pinta:fecha', 'pinta:sesion', 'pinta:pieza'];
const mayuscula = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

export default function ReservarPinta() {
  useSeo({
    titulo: 'Reservar Pinta tu pieza | Casa Numa',
    descripcion: 'Elige fecha, horario y la pieza que quieres pintar. Reservas pagando el 50 % del valor de tu pieza; el resto se paga en Casa Numa.',
    indexar: false,
  });

  const [params] = useSearchParams();
  const { datos: sesiones, error: errorSesiones, recargar: recargarSesiones } = useSesionesPinta();
  const { datos: piezas, error: errorPiezas, recargar: recargarPiezas } = usePiezasPinta();

  // Lo elegido sobrevive a recargar la página (sessionStorage).
  const [paso, setPaso] = useBorrador<number>('pinta:paso', 0);
  const [fecha, setFecha] = useBorrador<string | null>('pinta:fecha', null);
  const [sesionId, setSesionId] = useBorrador<string | null>('pinta:sesion', null);
  const [piezaId, setPiezaId] = useBorrador<string | null>('pinta:pieza', () => params.get('pieza'));
  const desdeCatalogo = params.get('pieza');
  useEffect(() => {
    if (desdeCatalogo) setPiezaId(desdeCatalogo);
  }, [desdeCatalogo, setPiezaId]);

  const [mes, setMes] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaPieza | 'todas'>('todas');
  const [acepto, setAcepto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const { reserva, setReserva, error, setError, apartando, apartar, soltar } = useApartado();

  const sesion = useMemo(() => sesiones?.find((s) => s.id === sesionId) ?? null, [sesiones, sesionId]);
  const delDia = useMemo(() => (sesiones ?? []).filter((s) => s.fecha === fecha), [sesiones, fecha]);
  const pieza = useMemo(() => piezas?.find((p) => p.id === piezaId) ?? null, [piezas, piezaId]);
  const elegible = pieza !== null && sePuedeElegir(pieza);
  const pago = elegible && pieza.precio !== null ? calcularPagoReserva(pieza.precio) : null;

  const meses = useMemo(() => [...new Set((sesiones ?? []).map((s) => claveMes(s.fecha)))].sort(), [sesiones]);
  const mesVisible = mes && meses.includes(mes) ? mes : fecha && meses.includes(claveMes(fecha)) ? claveMes(fecha) : meses[0] ?? null;

  const recargar = useCallback(() => {
    recargarSesiones();
    recargarPiezas();
  }, [recargarSesiones, recargarPiezas]);

  // Al volver (refresh, otra pestaña) el paso guardado debe seguir teniendo
  // sentido: sin apartado no hay pago; sin pieza válida, se vuelve a elegir.
  useEffect(() => {
    if (!sesiones || !piezas || reserva) return;
    let p = paso;
    if (p > 3) p = 3;
    if (p >= 3 && !elegible) p = 2;
    if (p >= 2 && !sesion) p = fecha ? 1 : 0;
    if (p >= 1 && !fecha) p = 0;
    if (p !== paso) setPaso(p);
  }, [sesiones, piezas, reserva, paso, elegible, sesion, fecha, setPaso]);

  const alVencer = useCallback(() => {
    setReserva(null);
    setPaso(2);
    setAviso('Tu apartado venció antes de pagar. Revisa que el horario y la pieza sigan disponibles.');
    recargar();
  }, [setReserva, setPaso, recargar]);

  function elegirDia(f: string) {
    setAviso(null);
    setFecha(f);
    const delNuevo = (sesiones ?? []).filter((s) => s.fecha === f && !sinLugar(s));
    if (!sesion || sesion.fecha !== f) setSesionId(delNuevo.length === 1 ? delNuevo[0].id : null);
    setPaso(1);
  }

  async function siguiente() {
    setAviso(null);
    setError(null);
    if (paso === 0) {
      if (!fecha) return setAviso('Elige el día en que quieres venir.');
      setPaso(1);
    } else if (paso === 1) {
      if (!sesion) return setAviso('Elige un horario para continuar.');
      if (sinLugar(sesion)) return setAviso('Este horario ya está lleno. Elige otro.');
      setPaso(2);
    } else if (paso === 2 && sesion) {
      if (!pieza) return setAviso('Elige la pieza que quieres pintar.');
      if (!elegible) return setAviso('Esa pieza no se puede reservar en línea. Elige otra.');
      // Cupo e inventario reales justo antes de pedir datos.
      setConsultando(true);
      try {
        const [problema, actuales] = await Promise.all([comprobarCupo([sesion.id], 1), repo.piezasPinta()]);
        if (problema) {
          setAviso(problema);
          recargar();
          return;
        }
        const ahora = actuales.find((p) => p.id === pieza.id);
        if (!ahora || !sePuedeElegir(ahora)) {
          setAviso(`«${pieza.nombre}» ya no está disponible. Elige otra pieza.`);
          recargar();
          return;
        }
      } finally {
        setConsultando(false);
      }
      setPaso(3);
    }
  }

  async function aPago(contacto: Contacto) {
    if (!sesion || !pieza) return;
    // Solo viaja el id de la pieza: el precio y el anticipo los pone quien guarda la reserva.
    const r = await apartar({ tipo: 'pinta', referencia: 'pinta', sesionIds: [sesion.id], participantes: 1, piezaId: pieza.id, contacto });
    if (r) {
      setAcepto(false);
      setPaso(4);
    } else {
      recargar();
    }
  }

  const confirmada = reserva?.estado === 'confirmada';
  useEffect(() => {
    if (confirmada) BORRADORES.forEach(borrarBorrador);
  }, [confirmada]);

  // Lo que se muestra: con apartado, las cifras de la reserva (servidor); antes, las del catálogo.
  // El saldo es el que quedará después de pagar el anticipo: total − anticipo.
  const cifras = reserva?.cobro
    ? {
        total: reserva.total, anticipo: reserva.cobro.anticipo, porcentaje: reserva.cobro.porcentaje,
        saldo: saldoPendiente(reserva.total, reserva.cobro.anticipo),
      }
    : pago
      ? { total: pago.total, anticipo: pago.anticipo, saldo: pago.saldo, porcentaje: pago.porcentajeAnticipo }
      : null;

  const filas: Fila[] = [
    { k: 'Pieza', v: pieza ? pieza.nombre : 'Por elegir' },
    ...(cifras
      ? [{ k: 'Precio de la pieza', v: pesosCortos(cifras.total) }, { k: 'Saldo en Casa Numa', v: pesosCortos(cifras.saldo) }]
      : []),
  ];

  const lista = useMemo(() => {
    const filtradas = (piezas ?? []).filter((p) => categoria === 'todas' || p.categoria === categoria);
    // Primero las que se pueden elegir; después, sin precio o agotadas.
    return [...filtradas].sort((a, b) => Number(!sePuedeElegir(a)) - Number(!sePuedeElegir(b)));
  }, [piezas, categoria]);

  const sinFechas = sesiones !== null && sesiones.length === 0;
  const errorCarga = (errorSesiones && !sesiones) || (errorPiezas && !piezas);

  return (
    <CheckoutLayout
      volver={{ to: '/pinta-tu-pieza', texto: 'Pinta tu pieza' }}
      eyebrow="Experiencia NUMA"
      titulo="Pinta tu pieza"
      demo={Boolean(pieza?.demo)}
      pasos={PASOS}
      paso={confirmada ? PASOS.length : paso}
      resumen={
        <BookingSummary
          titulo="Pinta tu pieza"
          foto={pieza?.fotos[0] ?? GALERIA_PINTA[0]}
          filas={filas}
          sesiones={sesion ? [sesion] : []}
          total={cifras ? cifras.anticipo : null}
          etiquetaTotal="Hoy pagas"
          accion={
            paso < 3
              ? {
                  texto: 'Continuar',
                  onClick: siguiente,
                  deshabilitada: (paso === 0 && !fecha) || (paso === 1 && !sesion) || (paso === 2 && !elegible),
                  cargando: consultando,
                }
              : undefined
          }
          nota={
            cifras
              ? `Hoy pagas el anticipo: el ${cifras.porcentaje} % del valor de tu pieza. El resto se paga en Casa Numa.`
              : 'Al elegir tu pieza verás cuánto pagas hoy: el 50 % de su valor. El resto se paga en Casa Numa.'
          }
        />
      }
    >
      {confirmada && reserva ? (
        <>
          <Confirmacion reserva={reserva} silueta="jarron" volver={{ to: '/', texto: 'Volver al inicio' }} />
          <Pendiente className="mx-auto mt-10 max-w-3xl">
            Tiempo de entrega de las piezas pintadas y política de cancelación de Pinta tu pieza.
          </Pendiente>
        </>
      ) : (
        <>
          {(aviso || error) && <div className="mb-8"><Aviso>{aviso ?? error}</Aviso></div>}
          {errorCarga && <ErrorCarga className="mb-8" onReintentar={recargar} />}

          {sinFechas ? (
            <section className="rounded-suave border border-dashed border-cafe/25 p-8">
              <p className="font-display text-t3 font-light">Muy pronto podrás reservar en línea.</p>
              <p className="mt-3 max-w-lectura text-cuerpo text-cafe/80">
                Escríbenos y te ayudamos a apartar tu lugar y elegir tu pieza.
              </p>
              <CtaWhatsapp mensaje={mensajePintaTuPieza()} className="mt-6">Escribir por WhatsApp</CtaWhatsapp>
            </section>
          ) : (
            <>
              {paso === 0 && (
                <section aria-labelledby="p-fecha">
                  <h2 id="p-fecha" className="font-display text-t3 font-light">¿Cuándo quieres venir?</h2>
                  <p className="mt-3 text-cuerpo text-cafe/75">
                    Jueves 7:00 p.m. · Viernes 10:00 a.m. · Sábados 11:00 a.m. y 4:00 p.m. · Domingos 11:00 a.m.
                  </p>
                  <div className="mt-8">
                    {!sesiones ? (
                      <CargandoBloque className="h-80 max-w-[34rem]" />
                    ) : mesVisible ? (
                      <Calendar
                        mes={mesVisible}
                        sesiones={sesiones}
                        seleccionadas={sesion ? [sesion.id] : []}
                        diaActivo={fecha}
                        onDia={elegirDia}
                        onMes={(d) => setMes(meses[meses.indexOf(mesVisible) + d] ?? mesVisible)}
                        puedeAnterior={meses.indexOf(mesVisible) > 0}
                        puedeSiguiente={meses.indexOf(mesVisible) < meses.length - 1}
                      />
                    ) : null}
                  </div>
                </section>
              )}

              {paso === 1 && fecha && (
                <section aria-labelledby="p-horario">
                  <h2 id="p-horario" className="font-display text-t3 font-light">Elige tu horario</h2>
                  <p className="mt-3 text-cuerpo text-cafe/75">{mayuscula(fechaCompleta(fecha))}</p>
                  <div className="mt-8 grid max-w-xl gap-2.5 sm:grid-cols-2">
                    {delDia.map((s) => (
                      <TimeSlot
                        key={s.id}
                        sesion={s}
                        seleccionada={s.id === sesionId}
                        onElegir={(x) => { setSesionId(x.id); setAviso(null); setError(null); }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setPaso(0)} className="subrayado-fijo mt-10 pb-0.5 text-nota">Cambiar fecha</button>
                </section>
              )}

              {paso === 2 && sesion && (
                <section aria-labelledby="p-pieza">
                  <h2 id="p-pieza" className="font-display text-t3 font-light">¿Qué quieres pintar?</h2>
                  <p className="mt-3 max-w-lectura text-cuerpo text-cafe/75">
                    Cada pieza tiene su precio. Para reservar pagas el 50 % del valor de la pieza que elijas; el resto, en Casa Numa.
                  </p>
                  <div className="carril -mx-canal mt-8 flex gap-2 overflow-x-auto px-canal pb-1" role="group" aria-label="Tipo de pieza">
                    {(['todas', ...CATEGORIAS_PIEZA] as const).map((c) => (
                      <button
                        key={c} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c}
                        className={`min-h-10 shrink-0 rounded-full border px-4 text-[0.78rem] transition-colors ${
                          categoria === c ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 hover:border-cafe'
                        }`}
                      >
                        {c === 'todas' ? 'Todas' : c}
                      </button>
                    ))}
                  </div>
                  {!piezas ? (
                    <CargandoBloque className="mt-8 h-80" />
                  ) : (
                    <ul className="mt-6 grid grid-cols-2 gap-x-2 gap-y-4 sm:gap-x-4 xl:grid-cols-3">
                      {lista.map((p: PiezaPinta) => (
                        <li key={p.id}>
                          <TarjetaPieza
                            pieza={p}
                            seleccionada={p.id === piezaId}
                            onElegir={(x) => { setPiezaId(x.id); setAviso(null); setError(null); }}
                            sizes="(min-width:1280px) 18vw, (min-width:640px) 28vw, 45vw"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  {pieza && !elegible && (
                    <p className="mt-6 text-nota text-cafe/70">
                      «{pieza.nombre}»: {estadoPieza(pieza) === 'precio_pendiente' ? 'precio pendiente' : 'no disponible'}. Elige otra pieza para continuar.
                    </p>
                  )}
                  <button type="button" onClick={() => setPaso(1)} className="subrayado-fijo mt-10 pb-0.5 text-nota">Cambiar horario</button>
                </section>
              )}

              {paso === 3 && (
                <div aria-busy={apartando}>
                  <PasoCuenta onListo={aPago} />
                  {apartando && <p className="mt-6 text-nota text-cafe/70">Apartando tu lugar y tu pieza…</p>}
                  <button type="button" onClick={() => setPaso(2)} className="subrayado-fijo mt-8 pb-0.5 text-nota">Regresar</button>
                </div>
              )}

              {paso === 4 && reserva && reserva.cobro && cifras && (
                <PasoPago
                  reserva={reserva}
                  titulo="Resumen y pago"
                  bloqueado={!acepto}
                  onPagado={setReserva}
                  onVencido={alVencer}
                  onVolver={() => { soltar(); setPaso(2); }}
                  textoVolver="Volver a elegir"
                >
                  <section aria-labelledby="p-resumen" className="rounded-suave border border-cafe/15 p-6 sm:p-8">
                    <h3 id="p-resumen" className="font-display text-t3 font-light">Tu reservación</h3>
                    <p className="eyebrow mt-5 text-cafe/60">Pinta tu pieza</p>
                    <p className="mt-2 text-cuerpo">
                      {mayuscula(fechaCompleta(reserva.sesiones[0].fecha))}
                      <span className="block text-cafe/75">{rango(reserva.sesiones[0].inicio, reserva.sesiones[0].fin)}</span>
                    </p>
                    {reserva.pieza && <p className="mt-4 text-cuerpo">Pieza: <strong className="font-medium">{reserva.pieza.nombre}</strong></p>}
                    <DesgloseAnticipo
                      modo="antes" className="mt-6" total={cifras.total} anticipo={cifras.anticipo}
                      porcentaje={cifras.porcentaje} saldo={cifras.saldo}
                    />
                    <p className="mt-6 rounded-[0.6rem] bg-amarillo/25 px-4 py-3 text-nota text-cafe" data-texto-anticipo>
                      Hoy pagarás {pesosCortos(cifras.anticipo)} para confirmar tu reservación. El saldo restante de{' '}
                      {pesosCortos(cifras.saldo)} se paga directamente en Casa Numa.
                    </p>
                  </section>
                  <Casilla id="p-acepto" className="mt-6" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} required>
                    Entiendo que hoy pagaré únicamente el 50 % del valor de mi pieza y que el saldo restante deberá liquidarse en
                    Casa Numa.
                  </Casilla>
                  {!acepto && <p className="mt-2 text-[0.76rem] text-cafe/60">Marca la casilla para continuar con el pago.</p>}
                </PasoPago>
              )}
            </>
          )}

          {paso === 0 && sesion && (
            <p className="mt-8 text-nota text-cafe/70">
              Elegiste: {mayuscula(fechaCompleta(sesion.fecha))} · {hora(sesion.inicio)}
            </p>
          )}
        </>
      )}
    </CheckoutLayout>
  );
}
