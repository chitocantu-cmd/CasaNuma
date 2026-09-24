import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTaller } from '../datos/hooks';
import type { Contacto, Sesion, Taller } from '../datos/tipos';
import CheckoutLayout, { useApartado } from '../componentes/reservas/CheckoutLayout';
import BookingSummary, { type Fila } from '../componentes/reservas/BookingSummary';
import TimeSlot from '../componentes/reservas/TimeSlot';
import PasoCuenta from '../componentes/reservas/PasoCuenta';
import PasoPago from '../componentes/reservas/PasoPago';
import Confirmacion from '../componentes/reservas/Confirmacion';
import { SelloFecha } from '../componentes/WorkshopCard';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import CtaInformacion from '../componentes/base/CtaInformacion';
import { Aviso } from '../componentes/base/Campos';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import { BotonEnlace } from '../componentes/base/Boton';
import { mensajeInformacionTaller } from '../contenido/whatsapp';
import { duracionTexto, fechaCompleta, rango } from '../lib/calendario';
import { maximoPersonas, sinLugar, textoLugares } from '../lib/cupo';
import { pesosCortos } from '../lib/formato';
import { cuandoTaller, precioTaller, publicoTaller } from '../lib/talleres';
import { ldEvento, useSeo } from '../lib/seo';

const PASOS = ['Fecha y horario', 'Personas', 'Tus datos', 'Pago'];
/** Tope por reserva mientras no haya cupo confirmado. PENDIENTE: confirmar con Casa Numa. */
const MAX_PERSONAS = 6;

/** Qué datos del taller faltan por publicar (para la nota de pendientes). */
function faltantes(t: Taller): string[] {
  const f: string[] = [];
  if (t.precio === null) f.push('precio');
  if (t.sesiones.some((s) => s.cupo === null)) f.push('cupo');
  if (t.sesiones.some((s) => s.fin === null)) f.push('hora de término');
  if (!t.incluye.length) f.push('qué incluye');
  return f;
}

export default function ReservarTaller() {
  const { slug } = useParams();
  const { datos: taller, cargando } = useTaller(slug);

  useSeo({
    titulo: taller ? `${taller.titulo} | Talleres de cerámica | Casa Numa` : 'Taller | Casa Numa',
    descripcion: taller?.resumen ?? 'Talleres de cerámica en Casa Numa, San Pedro Garza García.',
    jsonLd: taller && taller.sesiones[0]
      ? ldEvento({
          nombre: taller.titulo, descripcion: taller.resumen, fecha: taller.sesiones[0].fecha,
          inicio: taller.sesiones[0].inicio, fin: taller.sesiones[0].fin, precio: taller.precio,
          agotado: taller.sesiones.every(sinLugar), demo: taller.demo,
        })
      : null,
  });

  if (cargando && !taller) return <div className="min-h-[80vh]" aria-busy="true" />;

  if (!taller) {
    return (
      <div className="contenedor flex min-h-[70vh] flex-col items-start justify-center pt-header">
        <p className="eyebrow text-cafe/60">Taller no encontrado</p>
        <h1 className="mt-5 font-display text-t1 font-light">Esta fecha ya no está en la agenda.</h1>
        <BotonEnlace to="/talleres" className="mt-10" flecha>Ver la agenda</BotonEnlace>
      </div>
    );
  }

  return taller.reservaEnLinea ? <Checkout taller={taller} /> : <DetallePorMensaje taller={taller} />;
}

// ---------------------------------------------------------------------------
// Talleres sin precio publicado ("Info DM"): detalle + pedir información.
// No hay cobro en línea hasta que Casa Numa confirme el precio.
// ---------------------------------------------------------------------------
function DetallePorMensaje({ taller: t }: { taller: Taller }) {
  const faltan = faltantes(t);
  return (
    <div className="contenedor pb-seccion pt-[calc(theme(spacing.header)+2rem)]">
      <Link to="/talleres" className="group inline-flex items-center gap-2 text-nota text-cafe/70 hover:text-cafe">
        <Icono.flechaIzq tam={16} className="transition-transform group-hover:-translate-x-1" /> Agenda de talleres
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-8">
        <Revelar className="relative lg:col-span-7">
          <Foto id={t.foto} prioridad className="aspect-[4/3] w-full rounded-suave" sizes="(min-width:1024px) 55vw, 100vw" />
          <SelloFecha fecha={t.sesiones[0].fecha} className="absolute left-4 top-4" />
        </Revelar>

        <Revelar retraso={0.1} className="lg:col-span-4 lg:col-start-9">
          <p className="eyebrow text-cafe/65">{publicoTaller(t)}</p>
          <h1 className="mt-4 font-display text-t2 font-light">{t.titulo}</h1>
          <p className="mt-6 text-cuerpo-l text-cafe/85">{t.resumen}</p>
          {t.descripcion.map((p) => <p key={p} className="mt-4 text-cuerpo text-cafe/80">{p}</p>)}

          <dl className="mt-8 divide-y divide-cafe/12 border-y border-cafe/12 text-nota">
            <div className="flex justify-between gap-6 py-4">
              <dt className="text-cafe/60">Fecha</dt>
              <dd className="text-right first-letter:uppercase">{fechaCompleta(t.sesiones[0].fecha)}</dd>
            </div>
            <div className="flex justify-between gap-6 py-4">
              <dt className="text-cafe/60">Horario</dt>
              <dd className="text-right">{t.sesiones.map((s) => rango(s.inicio, s.fin)).join(' · ')}</dd>
            </div>
            {t.edad && (
              <div className="flex justify-between gap-6 py-4">
                <dt className="text-cafe/60">Edad</dt>
                <dd className="text-right">{t.edad.min} a {t.edad.max} años</dd>
              </div>
            )}
            <div className="flex justify-between gap-6 py-4">
              <dt className="text-cafe/60">Precio</dt>
              <dd className="text-right">{precioTaller(t)}</dd>
            </div>
            <div className="flex justify-between gap-6 py-4">
              <dt className="text-cafe/60">Cupo</dt>
              <dd className="text-right">{textoLugares(t.sesiones[0])}</dd>
            </div>
          </dl>

          <div className="mt-8">
            <CtaInformacion mensaje={mensajeInformacionTaller(t.titulo, cuandoTaller(t))} />
          </div>
          <p className="mt-4 text-[0.78rem] text-cafe/65">
            Este taller se aparta por mensaje: te compartimos el precio y los lugares disponibles.
          </p>
          {faltan.length > 0 && <Pendiente className="mt-6">Falta confirmar: {faltan.join(', ')}.</Pendiente>}
        </Revelar>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Talleres con precio: fecha → horario → personas → datos → pago.
// ---------------------------------------------------------------------------
function Checkout({ taller }: { taller: Taller }) {
  const [params] = useSearchParams();
  const { recargar } = useTaller(taller.slug);
  const [paso, setPaso] = useState(0);
  const [sesionId, setSesionId] = useState<string | null>(
    params.get('sesion') ?? (taller.sesiones.length === 1 ? taller.sesiones[0].id : null),
  );
  const [personas, setPersonas] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const { reserva, setReserva, error, setError, apartando, apartar } = useApartado();

  const precio = taller.precio ?? 0;
  const sesion = useMemo(() => taller.sesiones.find((s) => s.id === sesionId) ?? null, [taller, sesionId]);
  const maximo = Math.max(1, maximoPersonas(sesion, MAX_PERSONAS));
  const faltan = faltantes(taller);

  // Si llega con un horario elegido desde la agenda, empieza en "Personas"
  // (una sola vez: si después regresa a "Fecha", ahí se queda).
  const autoAvance = useRef(false);
  useEffect(() => {
    if (autoAvance.current || !sesion || !params.get('sesion')) return;
    autoAvance.current = true;
    if (!sinLugar(sesion)) setPaso(1);
  }, [sesion, params]);

  useEffect(() => {
    if (personas > maximo) setPersonas(maximo);
  }, [maximo, personas]);

  const alVencer = useCallback(() => {
    setReserva(null);
    setPaso(0);
    setAviso('Tu apartado venció antes de pagar. Revisa si el horario sigue disponible y vuelve a intentarlo.');
    recargar();
  }, [setReserva, recargar]);

  async function aPago(contacto: Contacto) {
    if (!sesion) return;
    const r = await apartar({ tipo: 'taller', referencia: taller.slug, sesionIds: [sesion.id], participantes: personas, contacto });
    if (r) setPaso(3);
    else recargar();
  }

  function siguiente() {
    setAviso(null);
    if (paso === 0) {
      if (!sesion) return setAviso('Elige un horario para continuar.');
      if (sinLugar(sesion)) return setAviso('Ese horario ya no tiene lugares. Elige otro.');
      setPaso(1);
    } else if (paso === 1) {
      setPaso(2);
    }
  }

  const fechas = [...new Set(taller.sesiones.map((s) => s.fecha))];
  const filas: Fila[] = [
    { k: 'Precio por persona', v: pesosCortos(precio) },
    ...(taller.duracionMin ? [{ k: 'Duración', v: duracionTexto(taller.duracionMin) }] : []),
    { k: 'Personas', v: personas },
    ...(sesion && sesion.disponibles === null ? [{ k: 'Cupo', v: 'Limitado' }] : []),
  ];

  return (
    <CheckoutLayout
      volver={{ to: '/talleres', texto: 'Agenda de talleres' }}
      eyebrow={publicoTaller(taller)}
      titulo={taller.titulo}
      demo={taller.demo}
      pasos={PASOS}
      paso={reserva?.estado === 'confirmada' ? PASOS.length : paso}
      resumen={
        <BookingSummary
          titulo={taller.titulo}
          foto={taller.foto}
          filas={filas}
          sesiones={sesion ? [sesion] : []}
          total={sesion ? precio * personas : null}
          accion={paso < 2 ? { texto: 'Continuar', onClick: siguiente, deshabilitada: paso === 0 && !sesion } : undefined}
          nota={taller.incluye.length ? `Incluye: ${taller.incluye.join(', ')}.` : undefined}
        />
      }
    >
      {reserva?.estado === 'confirmada' ? (
        <>
          <Confirmacion reserva={reserva} titulo="Tu lugar está reservado." silueta="taza" />
          <Pendiente className="mx-auto mt-10 max-w-3xl">
            Plazo de entrega de las piezas y política de cancelación de talleres.
          </Pendiente>
        </>
      ) : (
        <>
          {(aviso || error) && <div className="mb-8"><Aviso>{aviso ?? error}</Aviso></div>}

          {paso === 0 && (
            <section aria-labelledby="t-fecha">
              <div className="relative lg:hidden">
                <Foto id={taller.foto} className="aspect-[4/3] w-full rounded-foto" sizes="100vw" />
                <SelloFecha fecha={taller.sesiones[0].fecha} className="absolute left-3 top-3" />
              </div>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85 lg:mt-0">{taller.resumen}</p>
              {taller.descripcion.map((p) => (
                <p key={p} className="mt-4 max-w-lectura text-cuerpo text-cafe/75">{p}</p>
              ))}
              <p className="mt-6 inline-flex items-baseline gap-3 rounded-full bg-naranja/15 px-4 py-2">
                <span className="cifra text-[1.4rem] leading-none">{precioTaller(taller)}</span>
                <span className="text-[0.78rem] text-cafe/75">por persona</span>
              </p>
              {taller.incluye.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {taller.incluye.map((i) => (
                    <li key={i} className="flex items-center gap-2 rounded-full bg-terracota/12 px-3.5 py-1.5 text-[0.78rem]">
                      <Icono.check tam={14} className="text-terracota" /> {i}
                    </li>
                  ))}
                </ul>
              )}

              <h2 id="t-fecha" className="mt-12 font-display text-t3 font-light">Elige tu horario</h2>
              <div className="mt-6 space-y-8">
                {fechas.map((f) => (
                  <div key={f}>
                    <p className="eyebrow mb-3 text-cafe/65 first-letter:uppercase">{fechaCompleta(f)}</p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {taller.sesiones.filter((s) => s.fecha === f).map((s: Sesion) => (
                        <TimeSlot
                          key={s.id}
                          sesion={s}
                          seleccionada={s.id === sesionId}
                          onElegir={(x) => { setSesionId(x.id); setAviso(null); setError(null); }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {faltan.length > 0 && <Pendiente className="mt-8">Falta confirmar: {faltan.join(', ')}.</Pendiente>}
            </section>
          )}

          {paso === 1 && sesion && (
            <section aria-labelledby="t-personas">
              <h2 id="t-personas" className="font-display text-t3 font-light">¿Cuántas personas vienen?</h2>
              <p className="mt-3 text-cuerpo text-cafe/75 first-letter:uppercase">
                {fechaCompleta(sesion.fecha)} · {rango(sesion.inicio, sesion.fin)}
              </p>
              <div className="mt-10 flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setPersonas((n) => Math.max(1, n - 1))}
                  disabled={personas <= 1}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-cafe/30 text-cafe transition-colors hover:border-cafe disabled:opacity-30"
                  aria-label="Una persona menos"
                >
                  <Icono.menos tam={20} />
                </button>
                <output className="cifra w-16 text-center text-[4rem] leading-none" aria-live="polite" aria-label={`${personas} personas`}>
                  {personas}
                </output>
                <button
                  type="button"
                  onClick={() => setPersonas((n) => Math.min(maximo, n + 1))}
                  disabled={personas >= maximo}
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-cafe/30 text-cafe transition-colors hover:border-cafe disabled:opacity-30"
                  aria-label="Una persona más"
                >
                  <Icono.mas tam={20} />
                </button>
              </div>
              <p className="mt-6 text-nota text-cafe/70">
                {pesosCortos(precio)} × {personas} = <strong className="font-medium text-cafe">{pesosCortos(precio * personas)}</strong>
              </p>
              <p className="mt-2 text-nota text-cafe/60">
                {sesion.disponibles !== null && sesion.disponibles <= MAX_PERSONAS
                  ? `Quedan ${sesion.disponibles} ${sesion.disponibles === 1 ? 'lugar' : 'lugares'} en este horario.`
                  : `Cupo limitado. Hasta ${MAX_PERSONAS} personas por reserva; si son más, escríbenos.`}
              </p>
              <button type="button" onClick={() => setPaso(0)} className="subrayado-fijo mt-10 pb-0.5 text-nota">
                Cambiar horario
              </button>
            </section>
          )}

          {paso === 2 && (
            <div aria-busy={apartando}>
              <PasoCuenta onListo={aPago} />
              {apartando && <p className="mt-6 text-nota text-cafe/70">Apartando tus lugares…</p>}
              <button type="button" onClick={() => setPaso(1)} className="subrayado-fijo mt-8 pb-0.5 text-nota">
                Regresar
              </button>
            </div>
          )}

          {paso === 3 && reserva && <PasoPago reserva={reserva} onPagado={setReserva} onVencido={alVencer} />}
        </>
      )}
    </CheckoutLayout>
  );
}
