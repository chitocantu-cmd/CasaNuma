import { useEffect, useState } from 'react';
import { repo, ErrorDatos } from '../../datos';
import { invalidarCupos } from '../../datos/hooks';
import type { Reserva } from '../../datos/tipos';
import { fuenteDatos } from '../../config/site';
import { pesosCortos, restante } from '../../lib/formato';
import { Boton } from '../base/Boton';
import { Aviso } from '../base/Campos';
import { Icono } from '../base/Iconos';
import { Pendiente } from '../base/Pendiente';

/**
 * Pago. Los lugares ya están apartados; aquí corre el reloj del apartado.
 *
 * En demo el cobro es simulado y lo dice sin rodeos. Con el backend real,
 * `repo.pagar` devuelve la URL de Stripe Checkout y este paso redirige: el
 * número de tarjeta nunca pasa por este sitio.
 */
export default function PasoPago({
  reserva,
  onPagado,
  onVencido,
}: {
  reserva: Reserva;
  onPagado: (r: Reserva) => void;
  onVencido: () => void;
}) {
  const [reloj, setReloj] = useState(() => restante(reserva.expiraEn));
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function pagar() {
    setPagando(true);
    setError(null);
    try {
      const r = await repo.pagar(reserva.id);
      if (r.tipo === 'redireccion') {
        window.location.href = r.url;
        return;
      }
      invalidarCupos();
      onPagado(r.reserva);
    } catch (e) {
      setPagando(false);
      if (e instanceof ErrorDatos && e.codigo === 'APARTADO_VENCIDO') {
        onVencido();
        return;
      }
      setError(e instanceof ErrorDatos ? e.message : 'No pudimos procesar el pago. Intenta de nuevo.');
    }
  }

  return (
    <div>
      <h2 className="font-display text-t3 font-light">Pago</h2>

      {reloj && (
        <p className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-terracota/15 px-4 py-2 text-[0.8rem] text-cafe" role="timer" aria-live="off">
          <Icono.reloj tam={16} />
          Apartamos tus lugares mientras pagas · <span className="cifra text-[1rem] tabular-nums">{reloj}</span>
        </p>
      )}

      {error && <div className="mt-6"><Aviso>{error}</Aviso></div>}

      <div className="mt-8 rounded-suave border border-cafe/15 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2.5 text-cuerpo">
            <Icono.candado tam={18} className="text-terracota" />
            Tarjeta de crédito o débito
          </p>
          {fuenteDatos === 'demo' && (
            <span className="eyebrow rounded-full border border-indigo/40 px-2.5 py-1 text-[0.56rem] text-indigo">Simulado</span>
          )}
        </div>

        {fuenteDatos === 'demo' ? (
          <>
            {/* Campos de muestra, de solo lectura: no se captura ninguna tarjeta. */}
            <div className="mt-6 grid gap-3 opacity-80 sm:grid-cols-[2fr_1fr_1fr]" aria-hidden="true">
              {['4242 4242 4242 4242', '12 / 30', '123'].map((v) => (
                <div key={v} className="rounded-[0.5rem] border border-cafe/15 bg-cafe/[0.03] px-4 py-3 font-mono text-[0.85rem] text-cafe/60">{v}</div>
              ))}
            </div>
            <p className="mt-4 text-[0.78rem] text-indigo">
              Esta es una demostración: no se captura ninguna tarjeta ni se hace ningún cargo.
            </p>
          </>
        ) : (
          <p className="mt-4 text-nota text-cafe/70">
            Te llevamos a la página de pago segura de Stripe. Tu reserva se confirma en cuanto el pago se aprueba.
          </p>
        )}
      </div>

      <Pendiente className="mt-6">
        Qué formas de pago además de tarjeta se habilitan en línea (para membresía el documento dice «se aceptan todas
        las formas de pago») y la política de cancelación y reembolso.
      </Pendiente>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <Boton onClick={pagar} disabled={pagando || !reloj}>
          {pagando ? 'Procesando pago…' : `Pagar ${pesosCortos(reserva.total)}`}
        </Boton>
        <p className="text-[0.74rem] text-cafe/60">Código de apartado: {reserva.codigo}</p>
      </div>
    </div>
  );
}
