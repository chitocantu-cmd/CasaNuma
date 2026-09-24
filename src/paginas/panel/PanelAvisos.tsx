import { Link } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { useConsulta } from '../../datos/hooks';
import { fuenteDatos, siteConfig } from '../../config/site';
import { Icono } from '../../componentes/base/Iconos';
import { EncabezadoPanel, Tarjeta, fechaHora, useEnVivo } from './ui';

const ESTADO = {
  enviado: 'Enviado',
  sin_destinatario: 'Sin enviar: falta ADMIN_NOTIFICATION_EMAIL',
  pendiente_integracion: 'Preparado: falta conectar la API de WhatsApp',
} as const;

export default function PanelAvisos() {
  const { datos, recargar } = useConsulta('admin:avisos', () => repoAdmin.avisos());
  useEnVivo(recargar);

  return (
    <div className="space-y-6">
      <EncabezadoPanel eyebrow="Notificaciones" titulo="Avisos" />
      <div className="grid gap-3 md:grid-cols-3">
        <Tarjeta titulo="Correo al equipo">
          <p className="text-[0.84rem]">{siteConfig.correoAvisosEquipo || 'Sin configurar'}</p>
          <p className="mt-1 text-[0.72rem] text-cafe/60">Variable ADMIN_NOTIFICATION_EMAIL. Se cambia sin tocar código.</p>
        </Tarjeta>
        <Tarjeta titulo="Correo a la clienta">
          <p className="text-[0.84rem]">Al correo de cada reserva</p>
          <p className="mt-1 text-[0.72rem] text-cafe/60">Confirmación con folio, fecha, hora y total.</p>
        </Tarjeta>
        <Tarjeta titulo="WhatsApp al equipo">
          <p className="text-[0.84rem]">Preparado</p>
          <p className="mt-1 text-[0.72rem] text-cafe/60">Se conecta a una API oficial (WhatsApp Business). No es un enlace wa.me.</p>
        </Tarjeta>
      </div>
      {fuenteDatos === 'demo' && (
        <p className="text-[0.78rem] text-indigo">En la demo los correos no salen: aquí se ve exactamente lo que se enviaría.</p>
      )}

      {!datos ? (
        <div className="h-40" aria-busy="true" />
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
