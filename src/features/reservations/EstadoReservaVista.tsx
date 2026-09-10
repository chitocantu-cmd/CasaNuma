import { useCallback, useEffect, useRef, useState } from 'react';
import { consultarReserva } from '../../services/reservations';
import { ErrorApi } from '../../services/api';
import type { EstadoReserva } from '../../tipos';
import { fechaLarga, rangoHorario, pesos, restante } from '../../lib/formato';
import { descargarIcs, enlaceGoogleCalendar } from '../../lib/ics';
import { Boton, BotonEnlace, Campo, Aviso } from '../../componentes/ui';

// El webhook de Stripe casi siempre llega después de que el cliente regresa.
// Por eso se consulta el estado real cada 2 segundos, hasta un minuto.
const INTERVALO_MS = 2000;
const LIMITE_MS = 60000;

/**
 * Pantalla de estado de una reservación.
 *
 * NUNCA marca una reserva como pagada por el hecho de que el navegador haya
 * llegado aquí: esa URL se puede escribir a mano. Consulta el estado real al
 * backend, que a su vez solo confía en el webhook firmado de Stripe.
 */
export default function EstadoReservaVista({ code }: { code: string }) {
  // El modal guardó el correo al crear la reserva. Si alguien llega con el
  // enlace desde otro dispositivo, se lo pedimos: el código por sí solo no
  // basta para consultar una reserva.
  const [email, setEmail] = useState(
    () => sessionStorage.getItem(`numa:${code}`) ?? '',
  );
  const [emailListo, setEmailListo] = useState(
    () => Boolean(sessionStorage.getItem(`numa:${code}`)),
  );

  const [reserva, setReserva] = useState<EstadoReserva | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agotado, setAgotado] = useState(false);
  const inicio = useRef(Date.now());

  const consultar = useCallback(async (): Promise<boolean> => {
    try {
      const r = await consultarReserva(code, email);
      setReserva(r);
      setError(null);
      // Solo se deja de consultar cuando el estado ya es definitivo.
      return r.status !== 'pending_payment';
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'RESERVATION_NOT_FOUND') {
        setError('No encontramos esa reservación con ese correo. Revisa que sea el mismo que usaste al reservar.');
        return true;
      }
      setError(e instanceof Error ? e.message : 'Algo salió mal.');
      return false;
    }
  }, [code, email]);

  useEffect(() => {
    if (!emailListo || !email) return;
    let vivo = true;
    let timer: number;

    const ciclo = async () => {
      const listo = await consultar();
      if (!vivo || listo) return;
      if (Date.now() - inicio.current > LIMITE_MS) { setAgotado(true); return; }
      timer = window.setTimeout(ciclo, INTERVALO_MS);
    };

    ciclo();
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [emailListo, email, consultar]);

  // ---- Falta el correo -----------------------------------------------------
  if (!emailListo) {
    return (
      <div className="contenedor flex min-h-[70vh] max-w-md flex-col justify-center py-32">
        <p className="dato text-tinta/45">Reservación {code}</p>
        <h1 className="mt-4 font-display text-[2.2rem] leading-tight">Confirma tu correo</h1>
        <p className="mt-3 text-tinta/65">
          Para mostrarte tu reservación necesitamos el correo con el que la hiciste.
        </p>
        <form
          className="mt-8 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) { inicio.current = Date.now(); setEmailListo(true); }
          }}
        >
          <Campo id="correo-consulta" label="Correo electrónico" type="email" requerido
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com" autoComplete="email" />
          <Boton type="submit">Ver mi reservación</Boton>
        </form>
      </div>
    );
  }

  // ---- Hubo un problema ----------------------------------------------------
  if (error && !reserva) {
    return (
      <div className="contenedor flex min-h-[70vh] max-w-md flex-col justify-center py-32">
        <p className="dato text-tinta/45">Hubo un problema</p>
        <div className="mt-4"><Aviso>{error}</Aviso></div>
        <Boton className="mt-6" variante="secundario"
          onClick={() => { setEmailListo(false); setError(null); }}>
          Probar con otro correo
        </Boton>
      </div>
    );
  }

  // ---- Confirmando pago ----------------------------------------------------
  if (!reserva || reserva.status === 'pending_payment') {
    return (
      <div className="contenedor flex min-h-[70vh] max-w-lg flex-col justify-center py-32 text-center">
        {!agotado ? (
          <>
            <span className="mx-auto mb-8 block h-8 w-8 animate-spin rounded-full border-2 border-tinta/15 border-t-terracota" />
            <h1 className="font-display text-[2.2rem] leading-tight">
              Estamos confirmando tu pago
            </h1>
            <p className="mt-4 text-tinta/65">
              Esto puede tardar unos segundos. No cierres esta ventana.
            </p>
          </>
        ) : (
          <>
            <p className="dato text-tinta/45">Pago pendiente</p>
            <h1 className="mt-4 font-display text-[2.2rem] leading-tight">
              Tu pago sigue procesándose
            </h1>
            <p className="mt-4 text-tinta/65">
              Está tardando más de lo normal. En cuanto se confirme te llega un
              correo con los detalles — no necesitas hacer nada más.
            </p>
            <p className="mt-6 text-[0.9rem] text-tinta/50">
              Guarda tu código: <strong className="text-tinta">{code}</strong>
            </p>
          </>
        )}
      </div>
    );
  }

  // ---- Cancelada, expirada o reembolsada -----------------------------------
  if (reserva.status !== 'confirmed') {
    const expirada = reserva.status === 'expired';
    const reembolsada = reserva.status === 'refunded';
    return (
      <div className="contenedor flex min-h-[70vh] max-w-lg flex-col justify-center py-32 text-center">
        <p className="dato text-tinta/45">Reservación {code}</p>
        <h1 className="mt-4 font-display text-[2.2rem] leading-tight">
          {expirada ? 'Se venció el tiempo de tu reserva'
            : reembolsada ? 'Esta reservación fue reembolsada'
            : 'Esta reservación está cancelada'}
        </h1>
        <p className="mt-4 text-tinta/65">
          {expirada
            ? 'Apartamos tu lugar unos minutos y no se completó el pago, así que quedó libre. Puedes intentar de nuevo si todavía hay cupo.'
            : 'Si crees que es un error, escríbenos y lo revisamos.'}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <BotonEnlace to={`/talleres/${reserva.workshop.slug}`}>Ver el taller</BotonEnlace>
          <BotonEnlace to="/contacto" variante="secundario">Escríbenos</BotonEnlace>
        </div>
      </div>
    );
  }

  // ---- Pago confirmado -----------------------------------------------------
  return (
    <div className="contenedor max-w-2xl py-32 sm:py-40">
      <p className="dato text-olivo">Pago confirmado</p>
      <h1 className="titular mt-4">Ya tienes tu lugar.</h1>

      <div className="mt-12 border-y border-tinta/15 py-8">
        <p className="font-display text-[1.8rem] leading-tight">{reserva.workshop.title}</p>
        <dl className="mt-6 space-y-3">
          <Fila k="Cuándo" v={fechaLarga(reserva.workshop.date)} />
          <Fila k="Horario" v={rangoHorario(reserva.workshop.start_time, reserva.workshop.end_time)} />
          {reserva.workshop.location && <Fila k="Lugar" v={reserva.workshop.location} />}
          <Fila k="Lugares" v={String(reserva.quantity)} />
          <Fila k="Total pagado" v={pesos(reserva.total_amount, reserva.currency)} />
          <Fila k="Código" v={reserva.reservation_code} />
        </dl>
      </div>

      <div className="mt-8">
        <p className="dato mb-4 text-tinta/45">Agregar a mi calendario</p>
        <div className="flex flex-wrap gap-3">
          <Boton onClick={() => descargarIcs(reserva)}>Descargar (.ics)</Boton>
          <a
            href={enlaceGoogleCalendar(reserva)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center border border-tinta/25 px-6 py-3 text-[0.92rem] font-semibold transition-colors hover:border-tinta"
          >
            Google Calendar
          </a>
        </div>
      </div>

      <p className="mt-10 text-[0.92rem] leading-relaxed text-tinta/60">
        Te mandamos el detalle por correo. Si necesitas cambiar algo, escríbenos
        por WhatsApp con tu código y lo vemos.
      </p>

      <div className="mt-10 border-t border-tinta/12 pt-8">
        <BotonEnlace to="/talleres" variante="secundario">Ver más talleres</BotonEnlace>
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

/** Cuenta regresiva del hold, para la pantalla de pago cancelado. */
export function TiempoRestante({ expiresAt }: { expiresAt: string | null }) {
  const [texto, setTexto] = useState(() => restante(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setTexto(restante(expiresAt)), 1000);
    return () => window.clearInterval(t);
  }, [expiresAt]);

  if (!texto) return null;
  return <span className="tabular-nums">{texto}</span>;
}
