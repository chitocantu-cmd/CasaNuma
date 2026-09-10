import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listarPagos, type PagoAdmin } from '../../services/reservations';
import { ETIQUETAS_PAGO } from '../../tipos';
import { pesos, fechaHoraCorta } from '../../lib/formato';
import { useTitulo } from '../../features/workshops/hooks';
import { Cargando, Aviso } from '../../componentes/ui';
import { Tabla, Th, Td, Etiqueta, tonoEstado } from '../../componentes/tabla';

const FILTROS = [
  { id: '', label: 'Todos' },
  { id: 'paid', label: 'Pagados' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'failed', label: 'Rechazados' },
  { id: 'refunded', label: 'Reembolsados' },
];

export default function AdminPagos() {
  useTitulo('Pagos · Panel');

  const [params] = useSearchParams();
  const soloRevision = params.get('revision') === '1';

  const [pagos, setPagos] = useState<PagoAdmin[]>([]);
  const [filtro, setFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true);
    listarPagos(filtro || undefined)
      .then(setPagos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [filtro]);

  const visibles = soloRevision ? pagos.filter((p) => p.needs_review) : pagos;
  const enRevision = pagos.filter((p) => p.needs_review);

  return (
    <div>
      <h1 className="font-display text-[1.8rem] leading-none">Pagos</h1>
      <p className="mt-2 text-[0.92rem] text-tinta/55">
        Control operativo, no contabilidad. Nunca se guardan datos de tarjeta:
        solo los identificadores de Stripe.
      </p>

      {error && <div className="mt-5"><Aviso>{error}</Aviso></div>}

      {/* Pagos que necesitan intervención humana --------------------------- */}
      {enRevision.length > 0 && !soloRevision && (
        <div className="mt-5 border-l-2 border-terracota bg-terracota/5 p-4">
          <p className="text-[0.92rem]">
            <strong>{enRevision.length}</strong>{' '}
            {enRevision.length === 1 ? 'pago recibido' : 'pagos recibidos'} cuando
            el cupo ya estaba tomado. El dinero está cobrado y la reserva NO se
            confirmó: hay que reembolsar en Stripe o reacomodar a la clienta.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
            className={`dato border px-3 py-1.5 transition-colors ${
              filtro === f.id ? 'border-tinta bg-tinta text-crema'
                : 'border-tinta/20 text-tinta/60 hover:border-tinta/50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {cargando ? <div className="mt-8"><Cargando texto="Cargando…" /></div> : (
        <div className="mt-6">
          <Tabla min="62rem">
            <thead>
              <tr>
                <Th>Fecha</Th><Th>Cliente</Th><Th>Taller</Th><Th>Código</Th>
                <Th num>Monto</Th><Th>Estado</Th><Th>Referencia Stripe</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id} className={p.needs_review ? 'bg-terracota/5' : ''}>
                  <Td className="text-[0.82rem] text-tinta/60">
                    {fechaHoraCorta(p.paid_at ?? p.created_at)}
                  </Td>
                  <Td>
                    {p.reservations?.customers?.full_name}
                    <span className="block text-[0.78rem] text-tinta/45">
                      {p.reservations?.customers?.email}
                    </span>
                  </Td>
                  <Td>{p.reservations?.workshops?.title}</Td>
                  <Td><code className="text-[0.8rem]">{p.reservations?.reservation_code}</code></Td>
                  <Td num>{pesos(p.amount, p.currency)}</Td>
                  <Td>
                    <Etiqueta tono={tonoEstado(p.status)}>{ETIQUETAS_PAGO[p.status]}</Etiqueta>
                    {p.needs_review && (
                      <span className="mt-1 block max-w-[22ch] text-[0.72rem] leading-snug text-terracota">
                        {p.review_reason}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[0.75rem] text-tinta/50">
                    {p.stripe_payment_intent_id ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${p.stripe_payment_intent_id}`}
                        target="_blank" rel="noreferrer"
                        className="text-terracota hover:underline"
                      >
                        {p.stripe_payment_intent_id.slice(0, 24)}…
                      </a>
                    ) : (
                      <span className="text-tinta/35">
                        {p.stripe_checkout_session_id?.slice(0, 20) ?? '—'}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>

          {visibles.length === 0 && (
            <p className="mt-6 text-tinta/55">No hay pagos con este filtro.</p>
          )}

          <p className="mt-8 border-t border-tinta/12 pt-5 text-[0.85rem] leading-relaxed text-tinta/55">
            Los reembolsos se hacen desde el panel de Stripe. Cuando Stripe
            confirma el reembolso, el webhook actualiza este panel solo: no hay
            que capturar nada aquí.
          </p>
        </div>
      )}
    </div>
  );
}
