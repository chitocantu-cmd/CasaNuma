import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { listarTalleresAdmin } from '../../services/workshops';
import { listarReservas, type ReservaAdmin, reintentarJob } from '../../services/reservations';
import type { WorkshopAdmin, IntegrationJob } from '../../tipos';
import { fechaLarga, pesos, fechaHoraCorta, yaOcurrio } from '../../lib/formato';
import { useTitulo } from '../../features/workshops/hooks';
import { Cargando, Aviso } from '../../componentes/ui';

interface Cupo { workshop_id: string; confirmed: number; holds: number }

export default function AdminDashboard() {
  useTitulo('Panel');

  const [talleres, setTalleres] = useState<WorkshopAdmin[]>([]);
  const [reservas, setReservas] = useState<ReservaAdmin[]>([]);
  const [cupos, setCupos] = useState<Record<string, Cupo>>({});
  const [fallidos, setFallidos] = useState<IntegrationJob[]>([]);
  const [revision, setRevision] = useState<number>(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [ts, rs] = await Promise.all([listarTalleresAdmin(), listarReservas()]);
        if (!vivo) return;
        setTalleres(ts);
        setReservas(rs);

        // Cupo por taller: se calcula desde las reservas ya cargadas, para no
        // hacer una consulta por cada taller.
        const mapa: Record<string, Cupo> = {};
        for (const r of rs) {
          const c = mapa[r.workshop_id] ??= { workshop_id: r.workshop_id, confirmed: 0, holds: 0 };
          if (r.status === 'confirmed') c.confirmed += r.quantity;
          else if (r.status === 'pending_payment' && r.expires_at
                   && new Date(r.expires_at) > new Date()) c.holds += r.quantity;
        }
        if (vivo) setCupos(mapa);

        const { data: jobs } = await supabase
          .from('integration_jobs').select('*')
          .eq('status', 'failed').order('updated_at', { ascending: false }).limit(10);
        if (vivo) setFallidos((jobs ?? []) as IntegrationJob[]);

        const { count } = await supabase
          .from('payments').select('id', { count: 'exact', head: true })
          .eq('needs_review', true);
        if (vivo) setRevision(count ?? 0);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => { vivo = false; };
  }, []);

  if (cargando) return <Cargando texto="Cargando panel…" />;
  if (error) return <Aviso>{error}</Aviso>;

  const proximos = talleres
    .filter((t) => t.status === 'published' && !yaOcurrio(t.date, t.start_time))
    .sort((a, b) => a.date.localeCompare(b.date));

  const confirmadas = reservas.filter((r) => r.status === 'confirmed');
  const mes = new Date().toISOString().slice(0, 7);
  const ingresoMes = confirmadas
    .filter((r) => (r.confirmed_at ?? r.created_at).slice(0, 7) === mes)
    .reduce((s, r) => s + Number(r.total_amount), 0);
  const lugaresVendidos = confirmadas.reduce((s, r) => s + r.quantity, 0);
  const bloqueados = Object.values(cupos).reduce((s, c) => s + c.holds, 0);

  const casiLlenos = proximos.filter((t) => {
    const c = cupos[t.id];
    const ocupados = (c?.confirmed ?? 0) + (c?.holds ?? 0);
    return t.capacity - ocupados <= 3;
  });

  return (
    <div className="flex flex-col gap-10">
      {/* Alertas: lo que necesita intervención humana va primero. */}
      {(fallidos.length > 0 || revision > 0) && (
        <section className="border-l-2 border-terracota bg-terracota/5 p-5">
          <h2 className="dato mb-3 text-terracota">Requiere atención</h2>
          <ul className="flex flex-col gap-2 text-[0.92rem]">
            {revision > 0 && (
              <li>
                <strong>{revision}</strong>{' '}
                {revision === 1 ? 'pago recibido' : 'pagos recibidos'} sin cupo disponible.{' '}
                <Link to="/admin/pagos?revision=1" className="text-terracota underline">
                  Revisar
                </Link>
              </li>
            )}
            {fallidos.map((j) => (
              <li key={j.id} className="flex flex-wrap items-baseline gap-2">
                <span>
                  {j.type === 'calendar_sync' ? 'Sincronización de calendario' : 'Envío de correo'}{' '}
                  falló tras {j.attempts} intentos
                </span>
                <span className="text-[0.82rem] text-tinta/50">{j.last_error?.slice(0, 90)}</span>
                <button
                  onClick={() => reintentarJob(j.id).then(() => location.reload())}
                  className="dato text-terracota underline"
                >
                  Reintentar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Métricas */}
      <section className="grid gap-px overflow-hidden border border-tinta/12 bg-tinta/12 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica k="Ingresos del mes" v={pesos(ingresoMes)} />
        <Metrica k="Lugares vendidos" v={String(lugaresVendidos)} />
        <Metrica k="Bloqueados ahora" v={String(bloqueados)} nota="holds sin pagar" />
        <Metrica k="Talleres próximos" v={String(proximos.length)} />
      </section>

      {/* Talleres casi llenos */}
      {casiLlenos.length > 0 && (
        <section>
          <h2 className="dato mb-4 border-b border-tinta/12 pb-3 text-tinta/45">
            Casi llenos
          </h2>
          <ul className="flex flex-col gap-2">
            {casiLlenos.map((t) => {
              const c = cupos[t.id];
              const disp = t.capacity - (c?.confirmed ?? 0) - (c?.holds ?? 0);
              return (
                <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-tinta/8 py-2">
                  <Link to={`/admin/talleres/${t.id}`} className="font-medium hover:text-terracota">
                    {t.title}
                  </Link>
                  <span className="text-[0.88rem] text-tinta/60">
                    {fechaLarga(t.date)} ·{' '}
                    <strong className={disp <= 0 ? 'text-tinta/40' : 'text-terracota'}>
                      {disp <= 0 ? 'lleno' : `${disp} ${disp === 1 ? 'lugar' : 'lugares'}`}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Próximos talleres */}
      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-tinta/12 pb-3">
          <h2 className="dato text-tinta/45">Próximos talleres</h2>
          <Link to="/admin/talleres" className="dato text-terracota">Ver todos</Link>
        </div>
        {proximos.length === 0 ? (
          <p className="text-tinta/55">No hay talleres publicados próximos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-[0.9rem]">
              <thead>
                <tr className="border-b border-tinta/12 text-left">
                  <Th>Taller</Th><Th>Fecha</Th>
                  <Th num>Cap.</Th><Th num>Conf.</Th><Th num>Holds</Th><Th num>Disp.</Th>
                </tr>
              </thead>
              <tbody>
                {proximos.slice(0, 8).map((t) => {
                  const c = cupos[t.id];
                  const disp = t.capacity - (c?.confirmed ?? 0) - (c?.holds ?? 0);
                  return (
                    <tr key={t.id} className="border-b border-tinta/8">
                      <Td>
                        <Link to={`/admin/talleres/${t.id}`} className="hover:text-terracota">
                          {t.title}
                        </Link>
                      </Td>
                      <Td>{fechaLarga(t.date)}</Td>
                      <Td num>{t.capacity}</Td>
                      <Td num>{c?.confirmed ?? 0}</Td>
                      <Td num>{c?.holds ?? 0}</Td>
                      <Td num><strong>{Math.max(disp, 0)}</strong></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reservaciones recientes */}
      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-tinta/12 pb-3">
          <h2 className="dato text-tinta/45">Reservaciones recientes</h2>
          <Link to="/admin/reservaciones" className="dato text-terracota">Ver todas</Link>
        </div>
        <ul className="flex flex-col">
          {reservas.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-tinta/8 py-2 text-[0.9rem]">
              <span>
                <code className="text-[0.82rem] text-tinta/55">{r.reservation_code}</code>{' '}
                {r.customers?.full_name}
              </span>
              <span className="text-tinta/60">
                {r.workshops?.title} · {r.quantity} · {pesos(r.total_amount)}
              </span>
              <span className="text-[0.82rem] text-tinta/45">
                {fechaHoraCorta(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metrica({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div className="bg-crema p-5">
      <p className="dato text-tinta/45">{k}</p>
      <p className="mt-2 font-display text-[1.8rem] leading-none tabular-nums">{v}</p>
      {nota && <p className="mt-1 text-[0.78rem] text-tinta/40">{nota}</p>}
    </div>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th className={`dato pb-2 font-semibold text-tinta/45 ${num ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function Td({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return <td className={`py-2 ${num ? 'text-right tabular-nums' : ''}`}>{children}</td>;
}
