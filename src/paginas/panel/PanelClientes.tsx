import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { soloDigitos } from '../../lib/formato';
import { Icono } from '../../componentes/base/Iconos';
import { DemoPill, EncabezadoPanel, claseCampo, claseTabla, dinero, fechaHora } from './ui';

export default function PanelClientes() {
  const { datos } = useConsulta('admin:clientes', () => repoAdmin.clientes());
  const [q, setQ] = useState('');

  const lista = useMemo(() => {
    const t = q.toLowerCase().trim();
    const dig = soloDigitos(q);
    return (datos ?? []).filter(
      (c) => !t || c.nombre.toLowerCase().includes(t) || c.email.includes(t) || (dig.length >= 3 && soloDigitos(c.telefono).includes(dig)),
    );
  }, [datos, q]);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Personas" titulo="Clientes" />
      <label className="relative block max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Icono.buscar tam={16} className="pointer-events-none absolute left-3 top-3 text-cafe/50" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, correo o teléfono" className={`${claseCampo} w-full pl-9`} />
      </label>

      {!datos ? (
        <div className="h-60" aria-busy="true" />
      ) : (
        <div className="overflow-x-auto rounded-suave border border-cafe/12 bg-crema">
          <table className={claseTabla.tabla}>
            <thead>
              <tr>
                {['Nombre', 'Correo', 'Teléfono', 'Cuenta', 'Reservas', 'Pagado', 'Última reserva', ''].map((h) => (
                  <th key={h} className={claseTabla.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.email}>
                  <td className={claseTabla.td}><span className="flex items-center gap-1.5 font-medium">{c.nombre} {c.demo && <DemoPill />}</span></td>
                  <td className={claseTabla.td}>{c.email}</td>
                  <td className={`${claseTabla.td} whitespace-nowrap`}>{c.telefono || '—'}</td>
                  <td className={claseTabla.td}>{c.tieneCuenta ? 'Sí' : 'No'}</td>
                  <td className={claseTabla.td}>{c.reservas}</td>
                  <td className={`${claseTabla.td} whitespace-nowrap`}>{dinero(c.pagado)}</td>
                  <td className={`${claseTabla.td} whitespace-nowrap text-cafe/70`}>{c.ultima ? fechaHora(c.ultima) : '—'}</td>
                  <td className={claseTabla.td}>
                    {c.reservas > 0 && (
                      <Link to={`/admin/reservas?q=${encodeURIComponent(c.email)}`} className="subrayado-fijo whitespace-nowrap pb-0.5 text-[0.76rem]">
                        Ver reservas
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
