import type { Reserva } from '../../datos/tipos';
import { saldoPendiente } from '../../lib/anticipo';
import { fechaCompleta, rango } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import DesgloseAnticipo from './DesgloseAnticipo';

const mayuscula = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

/** Quién viene, como se cuenta en cada experiencia. */
export function asistentesDe(r: Reserva): string {
  if (r.pieza) return `Pieza: ${r.pieza.nombre}`;
  if (r.ninos?.length) return r.ninos.map((n) => `${n.nombre} (${n.edad} años)`).join(' · ');
  if (r.tipo === 'membresia') return `${r.sesiones.length} clases`;
  return `${r.participantes} ${r.participantes === 1 ? 'participante' : 'participantes'}`;
}

/** «Precio por persona», «Precio por niño», «Precio de la pieza», «Precio mensual». */
export function etiquetaPrecio(r: Reserva): string {
  if (r.tipo === 'pinta') return 'Precio de la pieza';
  if (r.tipo === 'membresia') return 'Precio mensual';
  return r.tipo === 'kids' ? 'Precio por niño' : 'Precio por persona';
}

/**
 * «Resumen de tu reservación», el mismo en todos los checkouts: qué, cuándo,
 * quién, cuánto cuesta y cuánto se paga hoy. Las cifras son las de la
 * reserva apartada (las calculó quien la guardó), no las de la página.
 */
export default function ResumenPago({ reserva: r }: { reserva: Reserva }) {
  if (!r.cobro) return null;
  // Lo que quedará después de pagar hoy el anticipo.
  const saldo = saldoPendiente(r.total, r.cobro.anticipo);
  const unaSesion = r.sesiones.length === 1;

  return (
    <section aria-labelledby="resumen-pago" className="rounded-suave border border-cafe/15 p-6 sm:p-8" data-resumen-pago>
      <h3 id="resumen-pago" className="font-display text-t3 font-light">Resumen de tu reservación</h3>
      <p className="eyebrow mt-5 text-cafe/60">{r.titulo}</p>
      {unaSesion ? (
        <p className="mt-2 text-cuerpo">
          {mayuscula(fechaCompleta(r.sesiones[0].fecha))}
          <span className="block text-cafe/75">{rango(r.sesiones[0].inicio, r.sesiones[0].fin)}</span>
        </p>
      ) : (
        <ol className="mt-2 space-y-1 text-nota">
          {r.sesiones.map((s, i) => (
            <li key={s.id} className="flex gap-3">
              <span className="cifra w-5 text-cafe/45">{i + 1}</span>
              <span>{mayuscula(fechaCompleta(s.fecha))} · {rango(s.inicio, s.fin)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-cuerpo" data-asistentes>{asistentesDe(r)}</p>

      <dl className="mt-6">
        <div className="flex items-baseline justify-between gap-6 border-t border-cafe/12 py-3">
          <dt className="text-nota text-cafe/70">{etiquetaPrecio(r)}</dt>
          <dd className="text-cuerpo">{pesosCortos(r.precioUnitario)}</dd>
        </div>
      </dl>
      <DesgloseAnticipo modo="antes" total={r.total} anticipo={r.cobro.anticipo} porcentaje={r.cobro.porcentaje} saldo={saldo} />

      <p className="mt-6 rounded-[0.6rem] bg-amarillo/25 px-4 py-3 text-nota text-cafe" data-texto-anticipo>
        Tu reservación se confirma con el pago del {r.cobro.porcentaje} %: hoy pagarás {pesosCortos(r.cobro.anticipo)}. El
        saldo restante de {pesosCortos(saldo)} se liquida posteriormente en Casa Numa.
      </p>
    </section>
  );
}
