import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSesionesKids } from '../datos/hooks';
import type { Contacto, Nino } from '../datos/tipos';
import CheckoutLayout, { useApartado } from '../componentes/reservas/CheckoutLayout';
import BookingSummary from '../componentes/reservas/BookingSummary';
import TimeSlot from '../componentes/reservas/TimeSlot';
import PasoCuenta from '../componentes/reservas/PasoCuenta';
import PasoPago from '../componentes/reservas/PasoPago';
import Confirmacion from '../componentes/reservas/Confirmacion';
import { Aviso, Campo } from '../componentes/base/Campos';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import { KIDS } from '../contenido/oferta';
import { duracionTexto, fechaCompleta, rango } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { maximoPersonas, sinLugar } from '../lib/cupo';
import { useSeo } from '../lib/seo';

const PASOS = ['Fecha', 'Niños', 'Tus datos', 'Pago'];
const MAX_NINOS = 4;

interface NinoForm {
  nombre: string;
  edad: string;
}

export default function ReservarKids() {
  useSeo({
    titulo: 'Reservar NUMA Kids | Casa Numa',
    descripcion: 'Elige el jueves, inscribe a tus peques y reserva su taller de cerámica NUMA Kids.',
    indexar: false,
  });

  const [params] = useSearchParams();
  const { datos: sesiones, recargar } = useSesionesKids();
  const [paso, setPaso] = useState(0);
  const [sesionId, setSesionId] = useState<string | null>(params.get('sesion'));
  const [ninos, setNinos] = useState<NinoForm[]>([{ nombre: '', edad: '' }]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const { reserva, setReserva, error, setError, apartando, apartar } = useApartado();

  const sesion = useMemo(() => sesiones?.find((s) => s.id === sesionId) ?? null, [sesiones, sesionId]);
  const maximo = Math.max(1, maximoPersonas(sesion, MAX_NINOS));

  const autoAvance = useRef(false);
  useEffect(() => {
    if (autoAvance.current || !sesion || !params.get('sesion')) return;
    autoAvance.current = true;
    if (!sinLugar(sesion)) setPaso(1);
  }, [sesion, params]);

  const alVencer = useCallback(() => {
    setReserva(null);
    setPaso(0);
    setAviso('Tu apartado venció antes de pagar. Revisa si el jueves sigue disponible.');
    recargar();
  }, [setReserva, recargar]);

  function cambiarCantidad(n: number) {
    const total = Math.max(1, Math.min(maximo, n));
    setNinos((v) => Array.from({ length: total }, (_, i) => v[i] ?? { nombre: '', edad: '' }));
  }

  function validarNinos(): Nino[] | null {
    const errs: Record<string, string> = {};
    ninos.forEach((n, i) => {
      if (!n.nombre.trim()) errs[`nombre${i}`] = 'Escribe su nombre.';
      const edad = Number(n.edad);
      if (!n.edad || !Number.isFinite(edad)) errs[`edad${i}`] = 'Escribe su edad.';
      else if (edad < KIDS.edadMinima) errs[`edad${i}`] = `NUMA Kids es a partir de ${KIDS.edadMinima} años.`;
    });
    setErrores(errs);
    if (Object.keys(errs).length) return null;
    return ninos.map((n) => ({ nombre: n.nombre.trim(), edad: Number(n.edad) }));
  }

  function siguiente() {
    setAviso(null);
    if (paso === 0) {
      if (!sesion) return setAviso('Elige un jueves para continuar.');
      setPaso(1);
    } else if (paso === 1) {
      if (validarNinos()) setPaso(2);
    }
  }

  async function aPago(contacto: Contacto) {
    const lista = validarNinos();
    if (!sesion || !lista) return;
    const r = await apartar({
      tipo: 'kids', referencia: 'kids', sesionIds: [sesion.id], participantes: lista.length, ninos: lista, contacto,
    });
    if (r) setPaso(3);
    else recargar();
  }

  const confirmada = reserva?.estado === 'confirmada';

  return (
    <CheckoutLayout
      volver={{ to: '/numa-kids', texto: 'NUMA Kids' }}
      eyebrow="Taller infantil"
      titulo="Reservar NUMA Kids"
      demo
      pasos={PASOS}
      paso={confirmada ? PASOS.length : paso}
      resumen={
        <BookingSummary
          titulo="NUMA Kids"
          foto="kids-mesa"
          filas={[
            { k: 'Precio por niño', v: pesosCortos(KIDS.precio) },
            { k: 'Duración', v: duracionTexto(KIDS.duracionMin) },
            { k: 'Niños', v: ninos.length },
          ]}
          sesiones={sesion ? [sesion] : []}
          total={sesion ? KIDS.precio * ninos.length : null}
          accion={paso < 2 ? { texto: 'Continuar', onClick: siguiente, deshabilitada: paso === 0 && !sesion } : undefined}
          nota="Incluye arcilla, materiales, uso de herramientas, pintura, vidriado y horneado."
        />
      }
    >
      {confirmada && reserva ? (
        <>
          <Confirmacion reserva={reserva} titulo="¡Nos vemos el jueves!" silueta="tarro">
            Las piezas requieren secado, horneado y acabado, por lo que no se entregan el mismo día del taller.
          </Confirmacion>
          <Pendiente className="mx-auto mt-10 max-w-3xl">Plazo estimado de entrega de piezas y política de cancelación.</Pendiente>
        </>
      ) : (
        <>
          {(aviso || error) && <div className="mb-8"><Aviso>{aviso ?? error}</Aviso></div>}

          {paso === 0 && (
            <section aria-labelledby="k-fecha">
              <h2 id="k-fecha" className="font-display text-t3 font-light">Elige el jueves</h2>
              <p className="mt-3 text-cuerpo text-cafe/75">
                {KIDS.dia}s · {rango(KIDS.inicio, KIDS.fin)} · a partir de {KIDS.edadMinima} años
              </p>
              <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
                {(sesiones ?? []).map((s) => (
                  <TimeSlot
                    key={s.id}
                    sesion={s}
                    seleccionada={s.id === sesionId}
                    etiqueta={fechaCompleta(s.fecha).replace(/^./, (c) => c.toUpperCase())}
                    onElegir={(x) => { setSesionId(x.id); setAviso(null); setError(null); }}
                  />
                ))}
              </div>
              <Pendiente className="mt-8">Cupo por sesión de NUMA Kids (aquí 10 de ejemplo).</Pendiente>
            </section>
          )}

          {paso === 1 && sesion && (
            <section aria-labelledby="k-ninos">
              <h2 id="k-ninos" className="font-display text-t3 font-light">¿Quién viene a crear?</h2>
              <p className="mt-3 text-cuerpo text-cafe/75">
                {fechaCompleta(sesion.fecha)} · {rango(sesion.inicio, sesion.fin)}
              </p>

              <div className="mt-8 flex items-center gap-5">
                <span className="eyebrow text-cafe/65">Niñas y niños</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => cambiarCantidad(ninos.length - 1)} disabled={ninos.length <= 1}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/30 disabled:opacity-30" aria-label="Uno menos">
                    <Icono.menos tam={18} />
                  </button>
                  <output className="cifra w-8 text-center text-[2.2rem] leading-none" aria-live="polite">{ninos.length}</output>
                  <button type="button" onClick={() => cambiarCantidad(ninos.length + 1)} disabled={ninos.length >= maximo}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cafe/30 disabled:opacity-30" aria-label="Uno más">
                    <Icono.mas tam={18} />
                  </button>
                </div>
              </div>

              <ol className="mt-10 space-y-8">
                {ninos.map((n, i) => (
                  <li key={i} className="grid gap-6 rounded-suave border border-cafe/12 p-5 sm:grid-cols-[1fr_8rem] sm:p-6">
                    <Campo
                      id={`nino-${i}`} label={ninos.length > 1 ? `Nombre · ${i + 1}` : 'Nombre'} value={n.nombre}
                      onChange={(e) => setNinos((v) => v.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                      error={errores[`nombre${i}`]} autoComplete="off"
                    />
                    <Campo
                      id={`edad-${i}`} label="Edad" type="number" inputMode="numeric" min={KIDS.edadMinima} max={17} value={n.edad}
                      onChange={(e) => setNinos((v) => v.map((x, j) => (j === i ? { ...x, edad: e.target.value } : x)))}
                      error={errores[`edad${i}`]}
                    />
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-nota text-cafe/65">
                {pesosCortos(KIDS.precio)} por niño · Hasta {MAX_NINOS} por reserva.
              </p>
              <button type="button" onClick={() => setPaso(0)} className="subrayado-fijo mt-8 pb-0.5 text-nota">Cambiar fecha</button>
            </section>
          )}

          {paso === 2 && (
            <div aria-busy={apartando}>
              <PasoCuenta
                titulo="Datos de mamá, papá o tutor"
                nota="La reserva queda a nombre de la persona adulta responsable."
                onListo={aPago}
              />
              {apartando && <p className="mt-6 text-nota text-cafe/70">Apartando sus lugares…</p>}
              <button type="button" onClick={() => setPaso(1)} className="subrayado-fijo mt-8 pb-0.5 text-nota">Regresar</button>
            </div>
          )}

          {paso === 3 && reserva && <PasoPago reserva={reserva} onPagado={setReserva} onVencido={alVencer} />}
        </>
      )}
    </CheckoutLayout>
  );
}
