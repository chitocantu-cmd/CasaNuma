import { useNavigate } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { etiquetaMes } from '../../lib/calendario';
import { DemoPill, EncabezadoPanel, EstadoPill, PagoPill, claseTabla, useEnVivo } from './ui';

const TONO = { utilizada: 'bg-cafe', reservada: 'bg-terracota/60', disponible: 'border border-cafe/30' };

export default function PanelMembresias() {
  const navigate = useNavigate();
  const { datos, recargar } = useConsulta('admin:membresias', () => repoAdmin.membresias());
  useEnVivo(recargar);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Alumnas" titulo="Membresías" />
      <ul className="flex flex-wrap gap-4 text-[0.74rem] text-cafe/70">
        {(['utilizada', 'reservada', 'disponible'] as const).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${TONO[k]}`} /> {k === 'utilizada' ? 'Utilizada' : k === 'reservada' ? 'Reservada' : 'Disponible'}
          </li>
        ))}
      </ul>

      {!datos ? (
        <div className="h-60" aria-busy="true" />
      ) : datos.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/65">Aún no hay membresías.</p>
      ) : (
        <div className="overflow-x-auto rounded-suave border border-cafe/12 bg-crema">
          <table className={claseTabla.tabla}>
            <thead>
              <tr>
                {['Alumna', 'Mes', 'Clases', 'Utilizadas', 'Reservadas', 'Restantes', 'Pago', 'Estado'].map((h) => (
                  <th key={h} className={claseTabla.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((m) => (
                <tr key={m.reserva.id} className={claseTabla.fila} onClick={() => navigate(`/admin/reservas/${m.reserva.id}`)}>
                  <td className={claseTabla.td}>
                    <span className="flex items-center gap-1.5 font-medium">{m.reserva.contacto.nombre} {m.reserva.demo && <DemoPill />}</span>
                    <span className="text-[0.72rem] text-cafe/60">{m.reserva.folio ?? 'En proceso'}</span>
                  </td>
                  <td className={`${claseTabla.td} capitalize`}>{etiquetaMes(m.mes)}</td>
                  <td className={claseTabla.td}>
                    <span className="flex gap-1" aria-label={m.clases.map((c) => `${c.numero}/4 ${c.estado}`).join(', ')}>
                      {m.clases.map((c) => <span key={c.numero} className={`h-3.5 w-3.5 rounded-full ${TONO[c.estado]}`} title={`${c.numero}/4 · ${c.estado}`} />)}
                    </span>
                  </td>
                  <td className={claseTabla.td}>{m.utilizadas}</td>
                  <td className={claseTabla.td}>{m.reservadas}</td>
                  <td className={claseTabla.td}>{m.restantes}</td>
                  <td className={claseTabla.td}><PagoPill pago={m.reserva.pago} /></td>
                  <td className={claseTabla.td}><EstadoPill estado={m.reserva.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[0.74rem] text-cafe/60">
        Restantes = clases que aún no se toman. Reprogramar una clase: pendiente de las reglas de Casa Numa.
      </p>
    </div>
  );
}
