import { useEffect, useRef, useState, type ReactNode } from 'react';
import { repo, ErrorDatos } from '../../datos';
import { invalidarCupos } from '../../datos/hooks';
import type { Reserva } from '../../datos/tipos';
import { fuenteDatos } from '../../config/site';
import { montoEnLinea } from '../../lib/anticipo';
import { pesosCortos, restante } from '../../lib/formato';
import { Boton } from '../base/Boton';
import { Aviso } from '../base/Campos';
import { Icono } from '../base/Iconos';
import { Pendiente } from '../base/Pendiente';

type Simulacion = 'aprobado' | 'rechazado';

/**
 * Pago. Los lugares ya están apartados; aquí corre el reloj del apartado.
 *
 * Con el backend real, `repo.pagar` devuelve la URL de Stripe Checkout y este
 * paso redirige: el número de tarjeta nunca pasa por este sitio.
 *
 * En la demo NO hay cobro ni formulario de tarjeta: dos botones deciden cómo
 * termina el pago, y lo dice sin rodeos.
 *
 * Se cobra `montoEnLinea`: el total, o en Pinta tu pieza solo el anticipo.
 */
export default function PasoPago({
  reserva,
  onPagado,
  onVencido,
  onVolver,
  textoVolver = 'Volver al taller',
  titulo = 'Pago',
  bloqueado = false,
  children,
}: {
  reserva: Reserva;
  onPagado: (r: Reserva) => void;
  onVencido: () => void;
  /** «Volver al taller»: regresa a elegir fecha (el apartado se suelta al volver a apartar). */
  onVolver: () => void;
  textoVolver?: string;
  titulo?: string;
  /** Falta algo antes de pagar (p. ej. aceptar cómo se cobra el anticipo). */
  bloqueado?: boolean;
  /** Resumen y condiciones, entre el reloj y el pago. */
  children?: ReactNode;
}) {
  const demo = fuenteDatos === 'demo';
  const monto = montoEnLinea(reserva);
  const anticipo = Boolean(reserva.cobro);
  const [reloj, setReloj] = useState(() => restante(reserva.expiraEn));
  const [pagando, setPagando] = useState<Simulacion | 'real' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazado, setRechazado] = useState(false);
  // Candado síncrono: dos clics antes de que React repinte no pagan dos veces.
  const enCurso = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      const r = restante(reserva.expiraEn);
      setReloj(r);
      if (!r) {
        clearInterval(t);
        onVencido();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [reserva.expiraEn, onVencido]);

  async function pagar(simulacion?: Simulacion) {
    if (enCurso.current || bloqueado) return;
    enCurso.current = true;
    setPagando(simulacion ?? 'real');
    setError(null);
    setRechazado(false);
    try {
      const r = await repo.pagar(reserva.id, simulacion ? { simulacion } : undefined);
      if (r.tipo === 'redireccion') {
        // Se queda «procesando» mientras el navegador va a Stripe.
        window.location.href = r.url;
        return;
      }
      invalidarCupos();
      onPagado(r.reserva);
    } catch (e) {
      enCurso.current = false;
      setPagando(null);
      if (e instanceof ErrorDatos && e.codigo === 'APARTADO_VENCIDO') {
        onVencido();
        return;
      }
      if (e instanceof ErrorDatos && e.codigo === 'PAGO_RECHAZADO') {
        setRechazado(true);
        return;
      }
      setError(e instanceof ErrorDatos ? e.message : 'No pudimos procesar el pago. Intenta de nuevo.');
    }
  }

  return (
    <div>
      <h2 className="font-display text-t3 font-light">{titulo}</h2>

      {reloj && (
        <p className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-terracota/15 px-4 py-2 text-[0.8rem] text-cafe" role="timer" aria-live="off">
          <Icono.reloj tam={16} className="shrink-0" />
          <span>{anticipo ? 'Tu lugar y tu pieza, apartados' : 'Apartamos tus lugares mientras pagas'} ·</span>
          <span className="cifra whitespace-nowrap text-[1rem] tabular-nums">{reloj}</span>
        </p>
      )}

      {children && <div className="mt-8">{children}</div>}

      {error && <div className="mt-6"><Aviso>{error}</Aviso></div>}

      {rechazado ? (
        <div role="alert" className="mt-8 rounded-suave border border-naranja/60 bg-naranja/[0.08] p-6 sm:p-8">
          <p className="font-display text-t3 font-light">El pago no pudo completarse.</p>
          <p className="mt-2 text-cuerpo text-cafe/80">Tu lugar todavía no ha sido confirmado.</p>
          {demo && <p className="mt-2 text-[0.78rem] text-indigo">Rechazo simulado: en la demo no se intentó ningún cargo.</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Boton tamano="chico" onClick={() => setRechazado(false)}>Intentar nuevamente</Boton>
            <Boton tamano="chico" variante="secundario" onClick={onVolver}>{textoVolver}</Boton>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-suave border border-cafe/15 p-6 sm:p-8">
          {demo ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-t4 font-light">Pago de demostración</p>
                <span className="eyebrow rounded-full border border-indigo/40 px-2.5 py-1 text-[0.56rem] text-indigo">Simulado</span>
              </div>
              <p className="mt-3 text-nota text-cafe/75">
                Esta versión todavía no procesa cargos reales. Elige cómo termina el pago para recorrer el flujo completo;
                no se pide ni se guarda ninguna tarjeta.
              </p>
              <p className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-cafe/12 pt-4">
                <span className="eyebrow text-cafe/65">{anticipo ? 'Monto a cobrar hoy · anticipo' : 'Monto a cobrar'}</span>
                <span className="cifra text-[1.8rem] leading-none" data-monto-cobro>{pesosCortos(monto)}</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Boton onClick={() => pagar('aprobado')} disabled={pagando !== null || !reloj || bloqueado}>
                  {pagando === 'aprobado' ? 'Procesando pago…' : `Simular pago aprobado · ${pesosCortos(monto)}`}
                </Boton>
                <Boton variante="secundario" onClick={() => pagar('rechazado')} disabled={pagando !== null || !reloj || bloqueado}>
                  {pagando === 'rechazado' ? 'Procesando pago…' : 'Simular pago rechazado'}
                </Boton>
              </div>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2.5 text-cuerpo">
                <Icono.candado tam={18} className="text-terracota" />
                Tarjeta de crédito o débito
              </p>
              <p className="mt-4 text-nota text-cafe/70">
                Te llevamos a la página de pago segura de Stripe. Tu reserva se confirma en cuanto el pago se aprueba.
              </p>
              <Boton className="mt-6" onClick={() => pagar()} disabled={pagando !== null || !reloj || bloqueado}>
                {pagando ? 'Abriendo el pago seguro…' : anticipo ? `Pagar ${pesosCortos(monto)} y reservar` : `Pagar ${pesosCortos(monto)}`}
              </Boton>
            </>
          )}
        </div>
      )}

      <Pendiente className="mt-6">
        Qué formas de pago además de tarjeta se habilitan en línea (para membresía el documento dice «se aceptan todas
        las formas de pago») y la política de cancelación y reembolso.
      </Pendiente>

      <p className="mt-6 text-[0.74rem] text-cafe/60">Tu folio se genera en cuanto se confirme el pago.</p>
    </div>
  );
}
