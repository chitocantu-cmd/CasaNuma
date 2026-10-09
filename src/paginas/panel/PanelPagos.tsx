import { useNavigate } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { DemoPill, ETIQUETA_METODO, EncabezadoPanel, Kpi, PagoPill, claseTabla, dinero, fechaHora, useEnVivo } from './ui';
import ErrorCarga from '../../componentes/base/ErrorCarga';
import { CargandoBloque } from '../../componentes/base/Cargando';

const PROVEEDOR = { demo: 'Pago simulado', stripe: 'Stripe', manual: 'Registrado en el panel' } as const;

export default function PanelPagos() {
  const navigate = useNavigate();
  const { datos, error, recargar } = useConsulta('admin:pagos', () => repoAdmin.pagos());
  useEnVivo(recargar);
  const pagado = (datos ?? []).filter((p) => p.estado === 'pagado').reduce((n, p) => n + p.monto, 0);
  const pendiente = (datos ?? []).filter((p) => p.estado === 'pendiente').reduce((n, p) => n + p.monto, 0);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Dinero" titulo="Pagos" />
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Kpi etiqueta="Confirmado" valor={dinero(pagado)} />
        <Kpi etiqueta="Pendiente" valor={dinero(pendiente)} alerta={pendiente > 0} />
      </div>
      {!datos && error ? (
        <ErrorCarga onReintentar={recargar} />
      ) : !datos ? (
        <CargandoBloque className="h-60" />
      ) : datos.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/65">
          Aún no hay pagos. Aparecen aquí en cuanto se cobra un anticipo o se registra un pago en el estudio.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-suave border border-cafe/12 bg-crema">
          <table className={claseTabla.tabla}>
            <thead>
              <tr>
                {['Fecha', 'Folio', 'Cliente', 'Monto', 'Proveedor', 'Método', 'Referencia', 'Estado'].map((h) => (
                  <th key={h} className={claseTabla.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((p) => (
                <tr key={p.id} className={claseTabla.fila} onClick={() => navigate(`/admin/reservas/${p.reservaId}`)}>
                  <td className={`${claseTabla.td} whitespace-nowrap text-cafe/75`}>{fechaHora(p.creadoEn)}</td>
                  <td className={`${claseTabla.td} cifra text-[1rem] tracking-[0.04em]`}>{p.folio ?? '—'}</td>
                  <td className={claseTabla.td}><span className="flex items-center gap-1.5">{p.cliente} {p.demo && <DemoPill />}</span></td>
                  <td className={`${claseTabla.td} whitespace-nowrap`}>
                    {dinero(p.monto)}
                    {p.concepto && p.concepto !== 'total' && (
                      <span className="block text-[0.7rem] text-cafe/60">{p.concepto === 'anticipo' ? 'Anticipo en línea' : 'Saldo en el estudio'}</span>
                    )}
                  </td>
                  <td className={claseTabla.td}>{PROVEEDOR[p.proveedor]}</td>
                  <td className={claseTabla.td}>{p.metodo ? ETIQUETA_METODO[p.metodo] : '—'}</td>
                  <td className={`${claseTabla.td} font-mono text-[0.74rem]`}>{p.referencia ?? '—'}</td>
                  <td className={claseTabla.td}><PagoPill pago={p.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
