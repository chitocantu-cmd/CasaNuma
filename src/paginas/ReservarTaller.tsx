import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTaller } from '../datos/hooks';
import type { Contacto, Sesion } from '../datos/tipos';
import { useSesion } from '../features/cuenta/sesion';
import CheckoutLayout, { useApartado } from '../componentes/reservas/CheckoutLayout';
import BookingSummary from '../componentes/reservas/BookingSummary';
import TimeSlot from '../componentes/reservas/TimeSlot';
import PasoCuenta from '../componentes/reservas/PasoCuenta';
import PasoPago from '../componentes/reservas/PasoPago';
import Confirmacion from '../componentes/reservas/Confirmacion';
import Foto from '../componentes/base/Foto';
import { Aviso } from '../componentes/base/Campos';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import { BotonEnlace } from '../componentes/base/Boton';
import { duracionTexto, fechaCompleta, rango } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { ldEvento, useSeo } from '../lib/seo';

const PASOS = ['Fecha', 'Personas', 'Tus datos', 'Pago'];
const MAX_PERSONAS = 6;

export default function ReservarTaller() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { datos: taller, cargando, recargar } = useTaller(slug);
  const { usuario } = useSesion();
  const [paso, setPaso] = useState(0);
  const [sesionId, setSesionId] = useState<string | null>(params.get('sesion'));
  const [personas, setPersonas] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const { reserva, setReserva, error, setError, apartando, apartar } = useApartado();

  const sesion = useMemo(() => taller?.sesiones.find((s) => s.id === sesionId) ?? null, [taller, sesionId]);
  const maximo = Math.min(MAX_PERSONAS, sesion?.disponibles ?? MAX_PERSONAS);

  // Si llega con una sesión elegida desde la agenda, empieza en "Personas"
  // (una sola vez: si después regresa a "Fecha", ahí se queda).
  const autoAvance = useRef(false);
  useEffect(() => {
    if (autoAvance.current || !sesion || !params.get('sesion')) return;
    autoAvance.current = true;
    if (sesion.disponibles > 0) setPaso(1);
  }, [sesion, params]);

  useEffect(() => {
    if (personas > maximo && maximo > 0) setPersonas(maximo);
  }, [maximo, personas]);

  useSeo({
    titulo: taller ? `${taller.titulo} | Talleres de cerámica | Casa Numa` : 'Taller | Casa Numa',
    descripcion: taller?.resumen ?? 'Reserva tu lugar en un taller de cerámica de fin de semana en Casa Numa.',
    jsonLd: taller && taller.sesiones[0]
      ? ldEvento({
          nombre: taller.titulo, descripcion: taller.resumen, fecha: taller.sesiones[0].fecha,
          inicio: taller.sesiones[0].inicio, fin: taller.sesiones[0].fin, precio: taller.precio,
          disponibles: taller.sesiones[0].disponibles, demo: taller.demo,
        })
      : null,
  });

  const alVencer = useCallback(() => {
    setReserva(null);
    setPaso(0);
    setAviso('Tu apartado venció antes de pagar. Revisa si el horario sigue disponible y vuelve a intentarlo.');
    recargar();
  }, [setReserva, recargar]);

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

  async function aDatos(contacto: Contacto) {
    if (!sesion || !taller) return;
    const r = await apartar({ tipo: 'taller', referencia: taller.slug, sesionIds: [sesion.id], participantes: personas, contacto });
    if (r) setPaso(3);
    else recargar();
  }

  function siguiente() {
    setAviso(null);
    if (paso === 0) {
      if (!sesion) return setAviso('Elige un horario para continuar.');
      if (sesion.disponibles <= 0) return setAviso('Ese horario se llenó. Elige otro.');
      setPaso(1);
    } else if (paso === 1) {
      setPaso(2);
    }
  }

  const total = sesion ? taller.precio * personas : null;
  const fechas = [...new Set(taller.sesiones.map((s) => s.fecha))];

  return (
    <CheckoutLayout
      volver={{ to: '/talleres', texto: 'Agenda de talleres' }}
      eyebrow="Clases de fin de semana"
      titulo={taller.titulo}
      demo={taller.demo}
      pasos={PASOS}
      paso={reserva?.estado === 'confirmada' ? PASOS.length : paso}
      resumen={
        <BookingSummary
          titulo={taller.titulo}
          foto={taller.foto}
          filas={[
            { k: 'Precio por persona', v: pesosCortos(taller.precio) },
            { k: 'Duración', v: duracionTexto(taller.duracionMin) },
            { k: 'Personas', v: personas },
          ]}
          sesiones={sesion ? [sesion] : []}
          total={total}
          accion={paso < 2 ? { texto: 'Continuar', onClick: siguiente, deshabilitada: paso === 0 && !sesion } : undefined}
          nota={`Incluye: ${taller.incluye.join(', ')}.`}
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
              <div className="grid gap-8 sm:grid-cols-[1fr_1.1fr] lg:hidden">
                <Foto id={taller.foto} className="aspect-[4/3] w-full rounded-foto" sizes="100vw" />
              </div>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85 lg:mt-0">{taller.resumen}</p>
              {taller.descripcion.map((p) => (
                <p key={p} className="mt-4 max-w-lectura text-cuerpo text-cafe/75">{p}</p>
              ))}
              <ul className="mt-6 flex flex-wrap gap-2">
                {taller.incluye.map((i) => (
                  <li key={i} className="flex items-center gap-2 rounded-full bg-terracota/12 px-3.5 py-1.5 text-[0.78rem]">
                    <Icono.check tam={14} className="text-terracota" /> {i}
                  </li>
                ))}
              </ul>
              {taller.demo && (
                <Pendiente className="mt-6">
                  Fecha, precio, duración, inclusiones y cupo de este taller son de demostración. La agenda definitiva la
                  carga Casa Numa desde el panel.
                </Pendiente>
              )}

              <h2 id="t-fecha" className="mt-12 font-display text-t3 font-light">Elige fecha y horario</h2>
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
            </section>
          )}

          {paso === 1 && sesion && (
            <section aria-labelledby="t-personas">
              <h2 id="t-personas" className="font-display text-t3 font-light">¿Cuántas personas vienen?</h2>
              <p className="mt-3 text-cuerpo text-cafe/75">
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
                {pesosCortos(taller.precio)} × {personas} = <strong className="font-medium text-cafe">{pesosCortos(taller.precio * personas)}</strong>
              </p>
              <p className="mt-2 text-nota text-cafe/60">
                {sesion.disponibles <= MAX_PERSONAS
                  ? `Quedan ${sesion.disponibles} ${sesion.disponibles === 1 ? 'lugar' : 'lugares'} en este horario.`
                  : `Hasta ${MAX_PERSONAS} personas por reserva. ¿Son más? Cotiza un evento privado.`}
              </p>
              <button type="button" onClick={() => setPaso(0)} className="subrayado-fijo mt-10 pb-0.5 text-nota">
                Cambiar horario
              </button>
            </section>
          )}

          {paso === 2 && (
            <div aria-busy={apartando}>
              <PasoCuenta onListo={aDatos} />
              {apartando && <p className="mt-6 text-nota text-cafe/70">Apartando tus lugares…</p>}
              <button type="button" onClick={() => setPaso(1)} className="subrayado-fijo mt-8 pb-0.5 text-nota">
                Regresar
              </button>
              {!usuario && <p className="sr-only">Necesitas una cuenta para reservar.</p>}
            </div>
          )}

          {paso === 3 && reserva && <PasoPago reserva={reserva} onPagado={setReserva} onVencido={alVencer} />}
        </>
      )}
    </CheckoutLayout>
  );
}
