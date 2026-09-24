import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import type { EstadoPago, EstadoReserva, Reserva, TipoExperiencia } from '../../datos/tipos';
import { diaSemana, hoy, sumarDias } from '../../lib/calendario';
import { soloDigitos } from '../../lib/formato';
import { Icono } from '../../componentes/base/Iconos';
import {
  DemoPill, ETIQUETA_ESTADO, ETIQUETA_PAGO, ETIQUETA_TIPO, EncabezadoPanel, EstadoPill, NuevaPill, PagoPill,
  claseCampo, claseTabla, diaMes, dinero, esNueva, horaCorta, useEnVivo,
} from './ui';

type Rango = 'todas' | 'hoy' | 'manana' | 'semana' | 'fecha';

const RANGOS: { id: Rango; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'hoy', label: 'Hoy' },
  { id: 'manana', label: 'Mañana' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'fecha', label: 'Fecha' },
];

/** Lunes a domingo de la semana de hoy. */
function semanaActual(): [string, string] {
  const h = hoy();
  const lunes = sumarDias(h, -((diaSemana(h) + 6) % 7));
  return [lunes, sumarDias(lunes, 6)];
}

function enRango(r: Reserva, rango: Rango, fecha: string): boolean {
  const fechas = r.sesiones.map((s) => s.fecha);
  if (rango === 'todas') return true;
  if (rango === 'hoy') return fechas.includes(hoy());
  if (rango === 'manana') return fechas.includes(sumarDias(hoy(), 1));
  if (rango === 'fecha') return !fecha || fechas.includes(fecha);
  const [desde, hasta] = semanaActual();
  return fechas.some((f) => f >= desde && f <= hasta);
}

function coincide(r: Reserva, q: string): boolean {
  if (!q) return true;
  const t = q.toLowerCase().trim();
  const dig = soloDigitos(q);
  return (
    r.contacto.nombre.toLowerCase().includes(t) ||
    r.contacto.email.toLowerCase().includes(t) ||
    (r.folio ?? '').toLowerCase().includes(t) ||
    (dig.length >= 3 && soloDigitos(r.contacto.telefono).includes(dig)) ||
    (r.ninos ?? []).some((n) => n.nombre.toLowerCase().includes(t))
  );
}

export default function PanelReservas() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { datos, cargando, recargar } = useConsulta('admin:reservas', () => repoAdmin.reservas());
  useEnVivo(recargar);

  const [rango, setRango] = useState<Rango>('todas');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<TipoExperiencia | ''>('');
  const [taller, setTaller] = useState('');
  const [estado, setEstado] = useState<EstadoReserva | ''>('');
  const [pago, setPago] = useState<EstadoPago | ''>('');
  const [orden, setOrden] = useState<'recientes' | 'fecha'>('recientes');
  const q = params.get('q') ?? '';

  const talleres = useMemo(
    () => [...new Set((datos ?? []).filter((r) => r.tipo === 'taller').map((r) => r.titulo))].sort(),
    [datos],
  );

  const lista = useMemo(() => {
    const filtradas = (datos ?? []).filter(
      (r) =>
        (estado ? r.estado === estado : r.estado !== 'expirada') &&
        (!pago || r.pago === pago) &&
        (!tipo || r.tipo === tipo) &&
        (!taller || r.titulo === taller) &&
        enRango(r, rango, fecha) &&
        coincide(r, q),
    );
    return orden === 'fecha'
      ? [...filtradas].sort((a, b) => (a.sesiones[0].fecha + a.sesiones[0].inicio).localeCompare(b.sesiones[0].fecha + b.sesiones[0].inicio))
      : filtradas;
  }, [datos, estado, pago, tipo, taller, rango, fecha, q, orden]);

  const personas = lista.filter((r) => r.estado !== 'cancelada').reduce((n, r) => n + r.participantes, 0);
  const cobrado = lista.filter((r) => r.pago === 'pagado').reduce((n, r) => n + r.total, 0);

  return (
    <div className="space-y-6">
      <EncabezadoPanel
        eyebrow="Operación"
        titulo="Reservas"
        accion={
          <Link to="/admin/reservas/nueva" className="inline-flex min-h-10 items-center gap-2 self-start rounded-full bg-cafe px-5 text-[0.74rem] font-medium uppercase tracking-[0.12em] text-crema">
            <Icono.mas tam={16} /> Nueva reserva
          </Link>
        }
      />

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <button key={r.id} type="button" onClick={() => setRango(r.id)} aria-pressed={rango === r.id}
              className={`min-h-9 rounded-full border px-4 text-[0.78rem] ${rango === r.id ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 hover:border-cafe'}`}>
              {r.label}
            </button>
          ))}
          {rango === 'fecha' && (
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseCampo} aria-label="Fecha de la experiencia" />
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(17rem,1.6fr)_repeat(4,minmax(0,1fr))_auto]">
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <Icono.buscar tam={16} className="pointer-events-none absolute left-3 top-3 text-cafe/50" />
            <input
              type="search"
              value={q}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
              placeholder="Nombre, teléfono, correo o folio"
              className={`${claseCampo} w-full pl-9`}
            />
          </label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoExperiencia | '')} className={`${claseCampo} w-full min-w-0`} aria-label="Experiencia">
            <option value="">Todas las experiencias</option>
            {(Object.keys(ETIQUETA_TIPO) as TipoExperiencia[]).map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
          <select value={taller} onChange={(e) => setTaller(e.target.value)} className={`${claseCampo} w-full min-w-0`} aria-label="Taller">
            <option value="">Todos los talleres</option>
            {talleres.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoReserva | '')} className={`${claseCampo} w-full min-w-0`} aria-label="Estado">
            <option value="">Todos los estados</option>
            {(Object.keys(ETIQUETA_ESTADO) as EstadoReserva[]).map((s) => <option key={s} value={s}>{ETIQUETA_ESTADO[s]}</option>)}
          </select>
          <select value={pago} onChange={(e) => setPago(e.target.value as EstadoPago | '')} className={`${claseCampo} w-full min-w-0`} aria-label="Estado de pago">
            <option value="">Todos los pagos</option>
            {(Object.keys(ETIQUETA_PAGO) as EstadoPago[]).map((s) => <option key={s} value={s}>{ETIQUETA_PAGO[s]}</option>)}
          </select>
          <select value={orden} onChange={(e) => setOrden(e.target.value as 'recientes' | 'fecha')} className={`${claseCampo} w-full min-w-0`} aria-label="Orden">
            <option value="recientes">Más recientes</option>
            <option value="fecha">Por fecha</option>
          </select>
        </div>
        <p className="text-[0.78rem] text-cafe/65">
          {lista.length} {lista.length === 1 ? 'reserva' : 'reservas'} · {personas} {personas === 1 ? 'persona' : 'personas'} · {dinero(cobrado)} cobrado
        </p>
      </div>

      {cargando && !datos ? (
        <div className="h-60" aria-busy="true" />
      ) : lista.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/65">
          No hay reservas con estos filtros.
        </p>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto rounded-suave border border-cafe/12 bg-crema md:block">
            <table className={claseTabla.tabla}>
              <thead>
                <tr>
                  {['Folio', 'Cliente', 'Experiencia', 'Fecha', 'Hora', 'Personas', 'Total', 'Pago', 'Estado'].map((h) => (
                    <th key={h} className={`${claseTabla.th} ${['Personas', 'Total'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className={claseTabla.fila} onClick={() => navigate(`/admin/reservas/${r.id}`)}>
                    <td className={claseTabla.td}>
                      <Link to={`/admin/reservas/${r.id}`} className="cifra whitespace-nowrap text-[1.05rem] tracking-[0.04em] hover:text-terracota" onClick={(e) => e.stopPropagation()}>
                        {r.folio ?? 'En proceso'}
                      </Link>
                    </td>
                    <td className={claseTabla.td}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{r.contacto.nombre}</span>
                        {esNueva(r) && <NuevaPill />}
                        {r.demo && <DemoPill />}
                      </span>
                      {r.ninos?.length ? <span className="block text-[0.72rem] text-cafe/60">{r.ninos.map((n) => n.nombre).join(', ')}</span> : null}
                    </td>
                    <td className={claseTabla.td}>
                      <span className="block">{r.titulo}</span>
                      <span className="text-[0.7rem] text-cafe/55">{r.origen === 'panel' ? 'Registrada en el panel' : 'Web'}</span>
                    </td>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>
                      {diaMes(r.sesiones[0].fecha)}
                      {r.sesiones.length > 1 && <span className="text-cafe/55"> +{r.sesiones.length - 1}</span>}
                    </td>
                    <td className={`${claseTabla.td} whitespace-nowrap`}>{horaCorta(r.sesiones[0].inicio)}</td>
                    <td className={`${claseTabla.td} text-right`}>{r.participantes}</td>
                    <td className={`${claseTabla.td} whitespace-nowrap text-right`}>{dinero(r.total)}</td>
                    <td className={claseTabla.td}><PagoPill pago={r.pago} /></td>
                    <td className={claseTabla.td}><EstadoPill estado={r.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {lista.map((r) => (
              <li key={r.id}>
                <Link to={`/admin/reservas/${r.id}`} className="block rounded-suave border border-cafe/12 bg-crema p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className="cifra text-[1.1rem] tracking-[0.04em]">{r.folio ?? 'En proceso'}</span>
                    <EstadoPill estado={r.estado} />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 font-medium">
                    {r.contacto.nombre} {esNueva(r) && <NuevaPill />} {r.demo && <DemoPill />}
                  </span>
                  <span className="mt-1 block text-[0.8rem] text-cafe/70">
                    {r.titulo} · {diaMes(r.sesiones[0].fecha)} · {horaCorta(r.sesiones[0].inicio)} · {r.participantes} pers.
                  </span>
                  <span className="mt-3 flex items-center justify-between">
                    <span className="cifra text-[1.2rem]">{dinero(r.total)}</span>
                    <PagoPill pago={r.pago} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
