import { pesosCortos } from '../../lib/formato';

/**
 * Cuánto vale la pieza, cuánto se paga hoy y cuánto en Casa Numa. El 50 %
 * nunca aparece solo: siempre dice de qué cantidad es.
 *
 * antes   → resumen antes de pagar (el anticipo es la cifra principal).
 * despues → confirmación, Mi cuenta y panel (lo pagado y lo que falta).
 */
export default function DesgloseAnticipo({
  total, anticipo, porcentaje, pagado, saldo, modo, className = '',
}: {
  total: number;
  anticipo: number;
  porcentaje: number;
  /** Lo recibido hasta ahora (después de pagar). */
  pagado?: number;
  saldo: number;
  modo: 'antes' | 'despues';
  className?: string;
}) {
  if (modo === 'antes') {
    return (
      <dl className={`text-cafe ${className}`}>
        <div className="flex items-baseline justify-between gap-6 border-b border-cafe/12 pb-3">
          <dt className="text-nota text-cafe/70">Precio de la pieza</dt>
          <dd className="text-cuerpo">{pesosCortos(total)}</dd>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b border-cafe/12 py-4">
          <dt>
            <span className="eyebrow block text-cafe">Anticipo {porcentaje} %</span>
            <span className="mt-1 block text-[0.78rem] text-cafe/65">El {porcentaje} % del valor de tu pieza, hoy</span>
          </dt>
          <dd className="cifra text-[2.4rem] leading-none" data-anticipo>{pesosCortos(anticipo)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-3">
          <dt>
            <span className="eyebrow block text-[0.66rem] text-cafe/70">Saldo pendiente</span>
            <span className="mt-1 block text-[0.78rem] text-cafe/65">Se paga directamente en Casa Numa</span>
          </dt>
          <dd className="cifra text-[1.6rem] leading-none" data-saldo>{pesosCortos(saldo)}</dd>
        </div>
      </dl>
    );
  }

  // Pagó más de lo que vale la pieza nueva: lo resuelve el estudio a mano.
  const enRevision = saldo < 0;
  return (
    <dl className={`grid grid-cols-3 gap-3 text-cafe ${className}`}>
      <div>
        <dt className="eyebrow text-[0.58rem] text-cafe/60">Precio total</dt>
        <dd className="cifra mt-1 text-[1.5rem] leading-none">{pesosCortos(total)}</dd>
      </div>
      <div>
        <dt className="eyebrow text-[0.58rem] text-cafe/60">Pagaste</dt>
        <dd className="cifra mt-1 text-[1.5rem] leading-none">{pesosCortos(pagado ?? 0)}</dd>
      </div>
      <div>
        <dt className="eyebrow text-[0.58rem] text-cafe/60">Saldo pendiente</dt>
        <dd className="cifra mt-1 text-[1.5rem] leading-none" data-saldo>
          {enRevision ? 'En revisión' : saldo === 0 ? 'Liquidado' : pesosCortos(saldo)}
        </dd>
      </div>
    </dl>
  );
}
