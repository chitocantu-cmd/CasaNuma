import { Link } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { fuenteDatos } from '../../config/site';
import { fechaCompleta, hoy, rango } from '../../lib/calendario';
import { Icono } from '../../componentes/base/Iconos';
import {
  DemoPill, ETIQUETA_AVISO, EncabezadoPanel, Kpi, NuevaPill, PagoPill, Tarjeta, diaMes, dinero, esNueva, horaCorta, useEnVivo, usePanel,
} from './ui';

export default function PanelResumen() {
  const { admin } = usePanel();
  const { datos, recargar } = useConsulta('admin:resumen', () => repoAdmin.resumen());
  const { datos: avisos } = useConsulta('admin:avisos', () => repoAdmin.avisos());
  useEnVivo(recargar);

  return (
    <div className="space-y-8">
      <EncabezadoPanel
        eyebrow={`Casa Numa · ${fechaCompleta(hoy())}`}
        titulo={`Hola, ${admin.nombre.split(' ')[0]}.`}
        accion={
          <div className="flex flex-wrap items-center gap-3">
            {fuenteDatos === 'demo' && <DemoPill />}
            <Link to="/admin/reservas/nueva" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-cafe px-5 text-[0.74rem] font-medium uppercase tracking-[0.12em] text-crema">
              <Icono.mas tam={16} /> Nueva reserva
            </Link>
          </div>
        }
      />

      {!datos ? (
        <div className="h-40" aria-busy="true" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi etiqueta="Reservas hoy" valor={datos.reservasHoy} />
            <Kpi etiqueta="Personas hoy" valor={datos.personasHoy} nota="esperadas en el estudio" />
            <Kpi etiqueta="Próximos 7 días" valor={datos.proximos7} nota="reservas" />
            <Kpi etiqueta="Ingresos confirmados" valor={dinero(datos.ingresosConfirmados)} nota="pagos confirmados" />
            <Kpi etiqueta="Pagos pendientes" valor={datos.pagosPendientes} alerta={datos.pagosPendientes > 0} nota="por cobrar o en proceso" />
            <Kpi etiqueta="Cupo bajo" valor={datos.cupoBajo} alerta={datos.cupoBajo > 0} nota="sesiones con 3 lugares o menos" />
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            <Tarjeta
              titulo="Últimas reservas"
              accion={<Link to="/admin/reservas" className="subrayado-fijo pb-0.5 text-[0.74rem]">Ver todas</Link>}
              className="xl:col-span-7"
            >
              {datos.ultimas.length === 0 ? (
                <p className="text-nota text-cafe/65">Aún no hay reservas.</p>
              ) : (
                <ul className="-my-2 divide-y divide-cafe/10">
                  {datos.ultimas.map((r) => (
                    <li key={r.id}>
                      <Link to={`/admin/reservas/${r.id}`} className="grid gap-2 py-3 hover:bg-terracota/[0.05] sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                        <span className="cifra text-[1.15rem] leading-none tracking-[0.04em]">{r.folio ?? 'En proceso'}</span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{r.contacto.nombre}</span>
                            {esNueva(r) && <NuevaPill />}
                            {r.demo && <DemoPill />}
                          </span>
                          <span className="block truncate text-[0.78rem] text-cafe/65">
                            {r.titulo} · {diaMes(r.sesiones[0].fecha)} · {horaCorta(r.sesiones[0].inicio)} · {r.participantes} {r.participantes === 1 ? 'persona' : 'personas'}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="cifra text-[1.1rem] leading-none">{dinero(r.total)}</span>
                          <PagoPill pago={r.pago} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Hoy en el estudio"
              accion={<Link to="/admin/calendario" className="subrayado-fijo pb-0.5 text-[0.74rem]">Calendario</Link>}
              className="xl:col-span-5"
            >
              {datos.hoy.length === 0 ? (
                <p className="text-nota text-cafe/65">Hoy no hay sesiones con reservas.</p>
              ) : (
                <ul className="space-y-4">
                  {datos.hoy.map((s) => (
                    <li key={s.sesion.id} className="rounded-[0.6rem] border border-cafe/10 p-3">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{s.titulo}</span>
                        <span className="text-[0.78rem] text-cafe/70">{rango(s.sesion.inicio, s.sesion.fin)}</span>
                      </p>
                      <p className="mt-1 text-[0.78rem] text-cafe/70">
                        {s.ocupados} {s.ocupados === 1 ? 'persona' : 'personas'}
                        {s.sesion.cupo !== null ? ` de ${s.sesion.cupo} lugares` : ' · cupo por confirmar'}
                      </p>
                      {s.asistentes.length > 0 && (
                        <p className="mt-2 text-[0.78rem] text-cafe/80">{s.asistentes.map((a) => a.nombre).join(', ')}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>

          <Tarjeta
            titulo="Avisos recientes"
            accion={<Link to="/admin/avisos" className="subrayado-fijo pb-0.5 text-[0.74rem]">Ver avisos</Link>}
          >
            {!avisos?.length ? (
              <p className="text-nota text-cafe/65">Cada reserva confirmada manda un correo al equipo y otro a la clienta. Aparecerán aquí.</p>
            ) : (
              <ul className="-my-1 divide-y divide-cafe/10 text-[0.82rem]">
                {avisos.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {a.canal === 'email' ? <Icono.sobre tam={16} /> : <Icono.whatsapp tam={16} />}
                      <span className="truncate">{a.asunto}</span>
                    </span>
                    <span className="text-[0.72rem] text-cafe/60">
                      {a.destinatario === 'equipo' ? 'Equipo' : 'Clienta'} ·{' '}
                      {ETIQUETA_AVISO[a.estado]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  );
}
