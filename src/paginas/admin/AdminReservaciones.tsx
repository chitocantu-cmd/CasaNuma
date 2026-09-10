import { useEffect, useState } from 'react';
import { listarReservas, cancelarReserva, type ReservaAdmin } from '../../services/reservations';
import { ETIQUETAS_RESERVA, ETIQUETAS_PAGO } from '../../tipos';
import { fechaLarga, pesos, fechaHoraCorta, enlaceWhatsapp } from '../../lib/formato';
import { useTitulo } from '../../features/workshops/hooks';
import { Cargando, Aviso, Boton } from '../../componentes/ui';
import { Tabla, Th, Td, Etiqueta, tonoEstado } from '../../componentes/tabla';

const FILTROS = [
  { id: '', label: 'Todas' },
  { id: 'confirmed', label: 'Confirmadas' },
  { id: 'pending_payment', label: 'Pendientes' },
  { id: 'expired', label: 'Expiradas' },
  { id: 'cancelled', label: 'Canceladas' },
  { id: 'refunded', label: 'Reembolsadas' },
];

export default function AdminReservaciones() {
  useTitulo('Reservaciones · Panel');

  const [reservas, setReservas] = useState<ReservaAdmin[]>([]);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    listarReservas(filtro || undefined)
      .then(setReservas)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(cargar, [filtro]);

  async function cancelar(r: ReservaAdmin) {
    const motivo = prompt(
      `Cancelar ${r.reservation_code} de ${r.customers?.full_name}.\n\n` +
      'ATENCIÓN: esta acción NO realiza un reembolso en Stripe. ' +
      'Si el cliente ya pagó, el reembolso se hace a mano desde el panel de Stripe.\n\n' +
      'Motivo de la cancelación:',
    );
    if (motivo === null) return;

    setCancelando(r.id);
    try {
      await cancelarReserva(r.id, motivo);
      setAviso(`${r.reservation_code} cancelada. El cupo quedó libre.`);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cancelar la reservación.');
    } finally {
      setCancelando(null);
    }
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? reservas.filter((r) =>
        r.reservation_code.toLowerCase().includes(q) ||
        (r.customers?.full_name ?? '').toLowerCase().includes(q) ||
        (r.customers?.email ?? '').toLowerCase().includes(q) ||
        (r.workshops?.title ?? '').toLowerCase().includes(q))
    : reservas;

  return (
    <div>
      <h1 className="font-display text-[1.8rem] leading-none">Reservaciones</h1>

      {aviso && <div className="mt-5"><Aviso tipo="info">{aviso}</Aviso></div>}
      {error && <div className="mt-5"><Aviso>{error}</Aviso></div>}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
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
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar código, cliente o taller"
          aria-label="Buscar reservaciones"
          className="w-full max-w-xs border-b border-tinta/25 bg-transparent pb-2 text-[0.92rem] outline-none placeholder:text-tinta/30 focus:border-terracota sm:w-64"
        />
      </div>

      {cargando ? <div className="mt-8"><Cargando texto="Cargando…" /></div> : (
        <div className="mt-6">
          <Tabla min="70rem">
            <thead>
              <tr>
                <Th>Código</Th><Th>Cliente</Th><Th>WhatsApp</Th><Th>Email</Th>
                <Th>Taller</Th><Th num>Cant.</Th><Th num>Total</Th>
                <Th>Reserva</Th><Th>Pago</Th><Th>Fecha</Th><Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const wa = enlaceWhatsapp(r.customers?.phone);
                const pago = r.payments?.[0];
                return (
                  <tr key={r.id}>
                    <Td><code className="text-[0.82rem]">{r.reservation_code}</code></Td>
                    <Td>{r.customers?.full_name}</Td>
                    <Td>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer"
                          className="text-terracota hover:underline">
                          {r.customers?.phone}
                        </a>
                      ) : <span className="text-tinta/35">—</span>}
                    </Td>
                    <Td className="text-[0.82rem]">{r.customers?.email}</Td>
                    <Td>
                      {r.workshops?.title}
                      {r.workshops?.date && (
                        <span className="block text-[0.78rem] text-tinta/45">
                          {fechaLarga(r.workshops.date)}
                        </span>
                      )}
                    </Td>
                    <Td num>{r.quantity}</Td>
                    <Td num>{pesos(r.total_amount, r.currency)}</Td>
                    <Td>
                      <Etiqueta tono={tonoEstado(r.status)}>
                        {ETIQUETAS_RESERVA[r.status]}
                      </Etiqueta>
                    </Td>
                    <Td>
                      {pago ? (
                        <>
                          <Etiqueta tono={tonoEstado(pago.status)}>
                            {ETIQUETAS_PAGO[pago.status]}
                          </Etiqueta>
                          {pago.needs_review && (
                            <span className="mt-1 block text-[0.72rem] text-terracota">
                              requiere revisión
                            </span>
                          )}
                        </>
                      ) : <span className="text-tinta/35">—</span>}
                    </Td>
                    <Td className="text-[0.8rem] text-tinta/55">
                      {fechaHoraCorta(r.created_at)}
                    </Td>
                    <Td>
                      {r.status !== 'cancelled' && r.status !== 'refunded' && (
                        <Boton
                          variante="secundario"
                          className="px-3 py-1 text-[0.78rem]"
                          disabled={cancelando === r.id}
                          onClick={() => cancelar(r)}
                        >
                          {cancelando === r.id ? 'Cancelando…' : 'Cancelar'}
                        </Boton>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>

          {visibles.length === 0 && (
            <p className="mt-6 text-tinta/55">No hay reservaciones con este filtro.</p>
          )}
        </div>
      )}
    </div>
  );
}
