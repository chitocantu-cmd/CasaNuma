import { useEffect, useState } from 'react';
import type { Workshop, ReservaCreada } from '../tipos';
import { crearReserva, crearSesionPago } from '../services/reservations';
import { ErrorApi } from '../services/api';
import {
  pesos, fechaLarga, rangoHorario, soloDigitos, correoValido,
} from '../lib/formato';
import { Boton, Campo, Icono, Aviso } from './ui';
import { useConfig } from './Layout';

// ---------------------------------------------------------------------------
// Reservar en UNA sola pantalla.
// ---------------------------------------------------------------------------
// El demo tenía cuatro pasos (Lugar → Datos → Pago → Listo) y la primera
// versión de esto tenía tres. Pero un taller ya trae fecha y hora fijas: lo
// único que la clienta elige es cuántos lugares y sus datos. Tres pantallas
// para eso son dos de más.
//
// Todo cabe en una: cantidad arriba con botones grandes, tres campos, el total
// siempre visible, un botón. Sin pasos, sin "siguiente", sin resumen aparte.
// ---------------------------------------------------------------------------

export default function ModalReserva({
  taller, abierto, onCerrar, onCupoAgotado,
}: {
  taller: Workshop | null;
  abierto: boolean;
  onCerrar: () => void;
  onCupoAgotado?: () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Reserva creada cuando el cobro en linea todavia no esta disponible.
  const [apartado, setApartado] = useState<ReservaCreada | null>(null);
  const config = useConfig();

  const disponibles = taller?.seats_available ?? 0;
  const total = Number(taller?.price ?? 0) * cantidad;
  const maximo = Math.min(disponibles, 10);

  useEffect(() => {
    if (abierto) {
      setCantidad(1);
      setError(null);
      setEnviando(false);
      setApartado(null);
    }
  }, [abierto, taller?.id]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar, enviando]);

  if (!taller) return null;

  async function reservarYPagar() {
    if (!taller) return;

    // Validación en el momento de enviar, no paso por paso: la clienta ve
    // todos sus datos a la vez y corrige donde haga falta.
    if (!nombre.trim()) { setError('Falta tu nombre.'); return; }
    if (soloDigitos(whatsapp).length < 10) { setError('El WhatsApp necesita 10 dígitos.'); return; }
    if (!correoValido(email)) { setError('Revisa el correo, parece incompleto.'); return; }
    if (cantidad < 1 || cantidad > disponibles) {
      setError(`Solo ${disponibles === 1 ? 'queda 1 lugar' : `quedan ${disponibles} lugares`}.`);
      return;
    }

    setEnviando(true);
    setError(null);
    let reserva: ReservaCreada | null = null;
    try {
      reserva = await crearReserva(taller.slug, cantidad, {
        full_name: nombre.trim(),
        email: email.trim(),
        phone: whatsapp.trim(),
      });

      sessionStorage.setItem(`numa:${reserva.reservation_code}`, email.trim());
      sessionStorage.setItem(`numa:id:${reserva.reservation_code}`, reserva.reservation_id);
      sessionStorage.setItem('numa:ultima', reserva.reservation_code);

      const sesion = await crearSesionPago(reserva.reservation_id);
      window.location.href = sesion.checkout_url;
    } catch (e) {
      setEnviando(false);
      if (e instanceof ErrorApi) {
        // El cobro en línea todavía no está conectado, pero la reserva SÍ se
        // creó y el lugar quedó apartado. Mostrar "no pudimos crear tu pago"
        // haría creer que se perdió todo. Mejor se confirma el apartado y se
        // manda a terminar por WhatsApp.
        //
        // Cuando exista la cuenta de Stripe, esta rama deja de alcanzarse sola.
        if (e.codigo === 'PAYMENT_UNAVAILABLE' && reserva) {
          setApartado(reserva);
          return;
        }
        setError(e.message);
        if (e.codigo === 'INSUFFICIENT_CAPACITY') onCupoAgotado?.();
      } else {
        setError('Algo salió mal. Intenta de nuevo.');
      }
    }
  }

  return (
    <div className={`fixed inset-0 z-[75] ${abierto ? '' : 'pointer-events-none'}`} aria-hidden={!abierto}>
      <div
        onClick={enviando ? undefined : onCerrar}
        className={`absolute inset-0 bg-tinta/45 transition-opacity duration-300 ${abierto ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reservar ${taller.title}`}
        className={`absolute bottom-0 right-0 flex max-h-[92vh] w-full flex-col bg-papel transition-transform duration-500 ease-casa sm:top-0 sm:max-h-none sm:w-[29rem] ${
          abierto ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
        }`}
      >
        {apartado ? (
          // ------------------------------------------------------------------
          // Lugar apartado, sin cobro en línea todavía.
          // ------------------------------------------------------------------
          // La reserva existe en la base con su hold, así que el lugar está
          // realmente guardado. Lo único que falta es terminar el pago, y
          // mientras Stripe no esté conectado eso se resuelve por WhatsApp.
          <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-8">
            <p className="dato text-olivo">Lugar apartado</p>
            <h2 className="mt-3 font-display text-[2rem] leading-tight">
              Ya guardamos tu lugar.
            </h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-tinta/70">
              Te escribimos por WhatsApp para confirmar tu reservación y darte
              las formas de pago.
            </p>

            <dl className="mt-8 space-y-3 border-y border-tinta/15 py-6 text-[0.95rem]">
              <Fila k="Taller" v={taller.title} />
              <Fila k="Cuándo" v={fechaLarga(taller.date)} />
              <Fila k="Lugares" v={String(apartado.quantity)} />
              <Fila k="Total" v={pesos(apartado.total_amount, apartado.currency)} />
              <Fila k="Tu código" v={apartado.reservation_code} />
            </dl>

            <p className="mt-6 text-[0.85rem] leading-relaxed text-tinta/55">
              Guarda tu código <strong className="text-tinta">{apartado.reservation_code}</strong>.
              Con él podemos encontrar tu reservación.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {config?.whatsapp_url && (
                <a
                  href={`${config.whatsapp_url}?text=${encodeURIComponent(
                    `Hola, aparté mi lugar en ${taller.title} (${apartado.reservation_code}). Quiero confirmar mi pago.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center bg-tinta px-6 py-3 text-[0.92rem] font-semibold text-crema transition-colors hover:bg-terracota"
                >
                  Escribir por WhatsApp
                </a>
              )}
              <Boton variante="secundario" className="w-full" onClick={onCerrar}>
                Cerrar
              </Boton>
            </div>
          </div>
        ) : (
        <>
        {/* Encabezado: qué taller, cuándo. Sin barra de pasos. */}
        <div className="shrink-0 border-b border-tinta/12 px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="dato text-tinta/45">Reservar</p>
              <h2 className="mt-1.5 font-display text-[1.55rem] leading-tight">
                {taller.title}
              </h2>
              <p className="mt-1.5 text-[0.9rem] text-tinta/60">
                {fechaLarga(taller.date)} · {rangoHorario(taller.start_time, taller.end_time)}
              </p>
            </div>
            <button
              onClick={onCerrar}
              disabled={enviando}
              aria-label="Cerrar"
              className="-mr-2 -mt-1 shrink-0 p-2 text-tinta/50 transition-colors hover:text-tinta disabled:opacity-30"
            >
              <Icono.cerrar size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
          {error && <div className="mb-6"><Aviso>{error}</Aviso></div>}

          {/* Cantidad · botones grandes, fáciles de tocar en teléfono */}
          <fieldset>
            <legend className="dato text-tinta/55">¿Cuántas personas?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: Math.max(maximo, 1) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setCantidad(n); setError(null); }}
                  aria-pressed={cantidad === n}
                  className={`h-12 w-12 border text-[1.05rem] font-semibold transition-colors ${
                    cantidad === n
                      ? 'border-tinta bg-tinta text-crema'
                      : 'border-tinta/25 text-tinta/70 hover:border-tinta'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[0.82rem] text-tinta/50">
              {disponibles <= 3
                ? `Solo ${disponibles === 1 ? 'queda 1 lugar' : `quedan ${disponibles} lugares`} en esta fecha.`
                : `${disponibles} lugares disponibles.`}
            </p>
          </fieldset>

          {/* Datos · tres campos, nada más */}
          <div className="mt-8 flex flex-col gap-6">
            <Campo
              id="nombre" label="Nombre" requerido value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre" autoComplete="name"
            />
            <Campo
              id="whatsapp" label="WhatsApp" requerido type="tel" value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="81 0000 0000" autoComplete="tel" inputMode="tel"
            />
            <Campo
              id="correo" label="Correo" requerido type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com" autoComplete="email" inputMode="email"
            />
          </div>

          <p className="mt-7 text-[0.82rem] leading-relaxed text-tinta/50">
            Te llevamos a la página de pago segura de Stripe. Apartamos tu lugar
            mientras completas el pago.
          </p>
        </div>

        {/* Total siempre visible + un solo botón */}
        <div className="shrink-0 border-t border-tinta/12 bg-crema px-6 py-5 sm:px-8">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-[0.88rem] text-tinta/60">
              {pesos(taller.price)} × {cantidad}
            </span>
            <span className="font-display text-[1.7rem] leading-none">{pesos(total)}</span>
          </div>
          <Boton
            className="w-full"
            disabled={enviando || disponibles < 1}
            onClick={reservarYPagar}
          >
            {enviando ? 'Procesando…' : `Reservar y pagar ${pesos(total)}`}
          </Boton>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="dato text-tinta/45">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
