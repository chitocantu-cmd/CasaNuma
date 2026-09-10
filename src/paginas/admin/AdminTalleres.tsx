import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarTalleresAdmin } from '../../services/workshops';
import { listarReservas, sincronizarCalendario, type ReservaAdmin } from '../../services/reservations';
import type { WorkshopAdmin } from '../../tipos';
import { fechaLarga, rangoHorario, pesos, yaOcurrio } from '../../lib/formato';
import { useTitulo } from '../../features/workshops/hooks';
import { Cargando, Aviso, BotonEnlace } from '../../componentes/ui';
import { Tabla, Th, Td, Etiqueta } from '../../componentes/tabla';

const ESTADOS: Record<string, { label: string; tono: string }> = {
  draft:     { label: 'Borrador',  tono: 'neutro' },
  published: { label: 'Publicado', tono: 'ok' },
  cancelled: { label: 'Cancelado', tono: 'apagado' },
  completed: { label: 'Completado', tono: 'apagado' },
};

export default function AdminTalleres() {
  useTitulo('Talleres · Panel');

  const [talleres, setTalleres] = useState<WorkshopAdmin[]>([]);
  const [reservas, setReservas] = useState<ReservaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('todos');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarTalleresAdmin(), listarReservas()])
      .then(([ts, rs]) => { if (vivo) { setTalleres(ts); setReservas(rs); } })
      .catch((e: Error) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  // Cupo por taller, calculado desde las reservas: confirmados y holds vivos
  // son dos números distintos y el panel los muestra separados. Si Casa Numa
  // ve "14 ocupados" sin saber que 2 son holds a medio pagar, toma decisiones
  // equivocadas al teléfono.
  const cupos = useMemo(() => {
    const m: Record<string, { confirmed: number; holds: number }> = {};
    const ahora = Date.now();
    for (const r of reservas) {
      const c = m[r.workshop_id] ??= { confirmed: 0, holds: 0 };
      if (r.status === 'confirmed') c.confirmed += r.quantity;
      else if (r.status === 'pending_payment' && r.expires_at
               && new Date(r.expires_at).getTime() > ahora) c.holds += r.quantity;
    }
    return m;
  }, [reservas]);

  const ingresos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of reservas) {
      if (r.status === 'confirmed') {
        m[r.workshop_id] = (m[r.workshop_id] ?? 0) + Number(r.total_amount);
      }
    }
    return m;
  }, [reservas]);

  const visibles = filtro === 'todos'
    ? talleres
    : talleres.filter((t) => t.status === filtro);

  if (cargando) return <Cargando texto="Cargando talleres…" />;
  if (error) return <Aviso>{error}</Aviso>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[1.8rem] leading-none">Talleres</h1>
        <BotonEnlace to="/admin/talleres/nuevo" className="px-5 py-2.5">
          Nuevo taller
        </BotonEnlace>
      </div>

      {aviso && <div className="mb-4"><Aviso tipo="info">{aviso}</Aviso></div>}

      <div className="mb-5 flex flex-wrap gap-2">
        {['todos', 'published', 'draft', 'completed', 'cancelled'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={`dato border px-3 py-1.5 transition-colors ${
              filtro === f ? 'border-tinta bg-tinta text-crema'
                : 'border-tinta/20 text-tinta/60 hover:border-tinta/50'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADOS[f]?.label ?? f}
          </button>
        ))}
      </div>

      <Tabla min="62rem">
        <thead>
          <tr>
            <Th>Taller</Th><Th>Fecha</Th><Th>Horario</Th>
            <Th num>Precio</Th><Th num>Cap.</Th><Th num>Conf.</Th>
            <Th num>Holds</Th><Th num>Disp.</Th><Th num>Ingreso</Th>
            <Th>Estado</Th><Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((t) => {
            const c = cupos[t.id] ?? { confirmed: 0, holds: 0 };
            const disp = Math.max(t.capacity - c.confirmed - c.holds, 0);
            const pasado = yaOcurrio(t.date, t.start_time);
            return (
              <tr key={t.id}>
                <Td>
                  <Link to={`/admin/talleres/${t.id}`} className="font-medium hover:text-terracota">
                    {t.title}
                  </Link>
                  {pasado && t.status === 'published' && (
                    <span className="ml-2 text-[0.75rem] text-tinta/40">ya ocurrió</span>
                  )}
                </Td>
                <Td>{fechaLarga(t.date)}</Td>
                <Td>{rangoHorario(t.start_time, t.end_time)}</Td>
                <Td num>{pesos(t.price)}</Td>
                <Td num>{t.capacity}</Td>
                <Td num>{c.confirmed}</Td>
                <Td num className={c.holds > 0 ? 'text-terracota' : ''}>{c.holds}</Td>
                <Td num><strong>{disp}</strong></Td>
                <Td num>{pesos(ingresos[t.id] ?? 0)}</Td>
                <Td>
                  <Etiqueta tono={ESTADOS[t.status]?.tono}>
                    {ESTADOS[t.status]?.label ?? t.status}
                  </Etiqueta>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1 text-[0.8rem]">
                    <Link to={`/admin/talleres/${t.id}`} className="text-terracota hover:underline">
                      Editar
                    </Link>
                    <Link to={`/admin/talleres/nuevo?duplicar=${t.id}`} className="text-tinta/60 hover:text-terracota">
                      Duplicar
                    </Link>
                    {t.status === 'published' && (
                      <button
                        onClick={async () => {
                          await sincronizarCalendario(t.id);
                          setAviso(`Sincronización de "${t.title}" encolada. Corre en menos de un minuto.`);
                        }}
                        className="text-left text-tinta/60 hover:text-terracota"
                      >
                        Sincronizar
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>

      {visibles.length === 0 && (
        <p className="mt-6 text-tinta/55">No hay talleres con este filtro.</p>
      )}
    </div>
  );
}
