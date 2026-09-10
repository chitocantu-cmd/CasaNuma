import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { consultarReserva, crearSesionPago } from '../services/reservations';
import { ErrorApi } from '../services/api';
import type { EstadoReserva } from '../tipos';
import { fechaLarga, rangoHorario, pesos, restante } from '../lib/formato';
import { useTitulo } from '../features/workshops/hooks';
import { Boton, BotonEnlace, Aviso } from '../componentes/ui';

/**
 * Ruta /pago/cancelado
 *
 * El cliente volvió sin pagar. Su hold sigue vigente unos minutos, así que se
 * le ofrece reintentar sin perder el lugar — y se le muestra cuánto tiempo le
 * queda, para que la decisión sea informada.
 */
export default function PagoCancelado() {
  useTitulo('Pago no completado');

  const code = sessionStorage.getItem('numa:ultima') ?? '';
  const email = code ? sessionStorage.getItem(`numa:${code}`) ?? '' : '';

  const [reserva, setReserva] = useState<EstadoReserva | null>(null);
  const [cargando, setCargando] = useState(Boolean(code && email));
  const [error, setError] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);
  const [queda, setQueda] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !email) { setCargando(false); return; }
    let vivo = true;
    consultarReserva(code, email)
      .then((r) => { if (vivo) setReserva(r); })
      .catch(() => { /* sin datos, se muestra la versión genérica */ })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [code, email]);

  useEffect(() => {
    if (!reserva?.expires_at) return;
    const tick = () => setQueda(restante(reserva.expires_at));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [reserva?.expires_at]);

  async function reintentar() {
    const reservationId = sessionStorage.getItem(`numa:id:${code}`);
    if (!code || !reservationId) {
      setError('Vuelve a empezar desde el taller.');
      return;
    }
    setReintentando(true);
    setError(null);
    try {
      // Se crea una sesión de pago NUEVA sobre el MISMO hold: el lugar no se
      // vuelve a apartar, así que no se consume cupo dos veces.
      // create-checkout-session revalida que la reserva siga vigente.
      const sesion = await crearSesionPago(reservationId);
      window.location.href = sesion.checkout_url;
    } catch (e) {
      setReintentando(false);
      setError(
        e instanceof ErrorApi && e.codigo === 'RESERVATION_EXPIRED'
          ? 'Tu reserva expiró. Vuelve a empezar desde el taller.'
          : e instanceof ErrorApi ? e.message : 'No pudimos reabrir el pago.',
      );
    }
  }

  const holdVigente = reserva?.status === 'pending_payment' && Boolean(queda);

  return (
    <div className="contenedor flex min-h-[70vh] max-w-lg flex-col justify-center py-32">
      <p className="dato text-tinta/45">Pago cancelado</p>
      <h1 className="mt-4 font-display text-[2.4rem] leading-tight">
        No se completó el pago.
      </h1>

      {cargando ? (
        <p className="mt-6 text-tinta/60">Revisando tu reserva…</p>
      ) : reserva ? (
        <>
          <div className="mt-8 border-y border-tinta/15 py-6">
            <p className="font-display text-[1.4rem] leading-tight">
              {reserva.workshop.title}
            </p>
            <p className="mt-2 text-[0.92rem] text-tinta/60">
              {fechaLarga(reserva.workshop.date)} ·{' '}
              {rangoHorario(reserva.workshop.start_time, reserva.workshop.end_time)}
            </p>
            <p className="mt-3 text-[0.92rem]">
              {reserva.quantity} {reserva.quantity === 1 ? 'lugar' : 'lugares'} ·{' '}
              <strong>{pesos(reserva.total_amount, reserva.currency)}</strong>
            </p>
          </div>

          {holdVigente ? (
            <>
              <p className="mt-6 text-tinta/70">
                Seguimos apartando tu lugar por{' '}
                <strong className="tabular-nums text-tinta">{queda}</strong>. Si
                quieres, puedes terminar el pago ahora.
              </p>
              {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}
              <div className="mt-8 flex flex-wrap gap-3">
                <Boton onClick={reintentar} disabled={reintentando}>
                  {reintentando ? 'Abriendo el pago…' : 'Intentar de nuevo'}
                </Boton>
                <BotonEnlace to={`/talleres/${reserva.workshop.slug}`} variante="secundario">
                  Volver al taller
                </BotonEnlace>
              </div>
            </>
          ) : (
            <>
              <p className="mt-6 text-tinta/70">
                Tu reserva ya no está activa, así que el lugar volvió a quedar
                disponible. Puedes reservarlo de nuevo si todavía hay cupo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <BotonEnlace to={`/talleres/${reserva.workshop.slug}`}>
                  Volver al taller
                </BotonEnlace>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-6 text-tinta/70">
            No te cobramos nada. Si quieres, vuelve a la agenda y elige tu fecha.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BotonEnlace to="/talleres">Ver la agenda</BotonEnlace>
            <BotonEnlace to="/contacto" variante="secundario">Escríbenos</BotonEnlace>
          </div>
        </>
      )}

      <p className="mt-10 text-[0.85rem] text-tinta/50">
        ¿Ya habías pagado? Consulta tu{' '}
        <Link to={code ? `/reserva/${code}` : '/contacto'} className="text-terracota underline">
          reservación
        </Link>
        .
      </p>
    </div>
  );
}
