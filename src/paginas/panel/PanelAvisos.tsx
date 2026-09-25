import { Link } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { fuenteDatos, siteConfig } from '../../config/site';
import { Icono } from '../../componentes/base/Iconos';
import { EncabezadoPanel, Tarjeta, fechaHora, useEnVivo } from './ui';
import type { EstadoIntegracion } from '../../datos/tipos';
import ErrorCarga from '../../componentes/base/ErrorCarga';
import { CargandoBloque } from '../../componentes/base/Cargando';

const ESTADO = {
  enviado: 'Enviado',
  sin_destinatario: 'Sin enviar: falta ADMIN_NOTIFICATION_EMAIL',
  pendiente_integracion: 'Preparado: falta conectar la API de WhatsApp',
  en_cola: 'En cola: sale en el siguiente minuto',
  fallido: 'No se pudo enviar',
} as const;

const TEXTO_ESTADO: Record<EstadoIntegracion, string> = {
  activo: 'Funcionando',
  sin_configurar: 'Sin configurar',
  error: 'Con error',
  demo: 'Simulado (demo)',
  sin_datos: 'Sin actividad todavía',
};
const TONO_ESTADO: Record<EstadoIntegracion, string> = {
  activo: 'bg-verde/25 text-cafe',
  sin_configurar: 'bg-cafe/[0.08] text-cafe/75',
  error: 'bg-naranja/20 text-cafe',
  demo: 'border border-indigo/40 text-indigo',
  sin_datos: 'bg-cafe/[0.05] text-cafe/65',
};

function EstadoPill({ estado }: { estado?: { estado: EstadoIntegracion; detalle?: string } }) {
  if (!estado) return <span className="inline-block h-5 w-24 rounded-full bg-cafe/[0.06]" aria-busy="true" />;
  return (
    <span title={estado.detalle} className={`inline-flex rounded-full px-2.5 py-1 text-[0.6rem] font-medium uppercase tracking-[0.1em] ${TONO_ESTADO[estado.estado]}`}>
      {TEXTO_ESTADO[estado.estado]}
    </span>
  );
}

export default function PanelAvisos() {
  const { datos: integ } = useConsulta('admin:integraciones', () => repoAdmin.integraciones());
  const { datos, error, recargar } = useConsulta('admin:avisos', () => repoAdmin.avisos());
  useEnVivo(recargar);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Notificaciones" titulo="Avisos" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Correo al equipo">
          <EstadoPill estado={integ?.correo} />
          <p className="mt-2 text-[0.84rem]">{siteConfig.correoAvisosEquipo || 'Sin configurar'}</p>
          <p className="mt-1 text-[0.72rem] text-cafe/60">Variable ADMIN_NOTIFICATION_EMAIL. Se cambia sin tocar código.</p>
        </Tarjeta>
        <Tarjeta titulo="Correo a la clienta">
          <EstadoPill estado={integ?.correo} />
          <p className="mt-2 text-[0.84rem]">Al correo de cada reserva</p>
          <p className="mt-1 text-[0.72rem] text-cafe/60">Confirmación con folio, fecha, hora y total. Sale por Resend.</p>
        </Tarjeta>
        <Tarjeta titulo="WhatsApp al equipo">
          <EstadoPill estado={integ?.whatsapp} />
          <p className="mt-2 text-[0.72rem] text-cafe/60">API oficial de WhatsApp Business (Meta), con plantilla aprobada. No es un enlace wa.me.</p>
        </Tarjeta>
        <Tarjeta titulo="Google Calendar">
          <EstadoPill estado={integ?.calendario} />
          <p className="mt-2 text-[0.72rem] text-cafe/60">
            Un evento por horario en el calendario del equipo. Mientras no esté conectado, todo se opera aquí en el panel.
          </p>
        </Tarjeta>
      </div>
      {fuenteDatos === 'demo' && (
        <p className="text-[0.78rem] text-indigo">En la demo los correos no salen: aquí se ve exactamente lo que se enviaría.</p>
      )}

      {!datos && error ? (
        <ErrorCarga onReintentar={recargar} />
      ) : !datos ? (
        <CargandoBloque className="h-40" />
      ) : datos.length === 0 ? (
        <p className="rounded-suave border border-dashed border-cafe/20 p-8 text-center text-nota text-cafe/65">
          Aún no hay avisos. Haz una reserva en el sitio y confírmala: aquí aparecerán el correo al equipo y el de la clienta.
        </p>
      ) : (
        <ul className="space-y-3">
          {datos.map((a) => (
            <li key={a.id}>
              <details className="rounded-suave border border-cafe/12 bg-crema">
                <summary className="grid cursor-pointer list-none gap-2 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <span className="flex items-center gap-2 text-[0.78rem] text-cafe/70">
                    {a.canal === 'email' ? <Icono.sobre tam={17} /> : <Icono.whatsapp tam={17} />}
                    {a.destinatario === 'equipo' ? 'Equipo' : 'Clienta'}
                  </span>
                  <span className="font-medium">{a.asunto}</span>
                  <span className="text-[0.72rem] text-cafe/60">{fechaHora(a.creadoEn)} · {ESTADO[a.estado]}</span>
                </summary>
                <div className="border-t border-cafe/10 p-5">
                  <p className="text-[0.74rem] text-cafe/60">Para: {a.para ?? '—'}</p>
                  {a.error && <p className="mt-1 text-[0.74rem] text-naranja">Motivo: {a.error}</p>}
                  <div className="mt-4 max-w-lg rounded-[0.6rem] border border-cafe/10 bg-cafe/[0.03] p-5 text-[0.86rem] leading-relaxed">
                    <p className="font-medium">{a.asunto}</p>
                    <div className="mt-3 whitespace-pre-line">{a.lineas.join('\n')}</div>
                    {a.enlace && (
                      <Link to={a.enlace.ruta} className="mt-5 inline-flex min-h-10 items-center rounded-full bg-cafe px-5 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-crema">
                        {a.enlace.texto}
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
