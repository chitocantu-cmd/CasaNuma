import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import type { Reserva } from '../../datos/tipos';
import { avisosReservaConfirmada } from '../../datos/avisos';
import { fuenteDatos, siteConfig } from '../../config/site';
import { fechaCompleta, rango } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import { descargarIcsReserva, enlaceGoogleCalendarReserva } from '../../lib/ics';
import { Boton, BotonEnlace } from '../base/Boton';
import { EASE_NUMA } from '../base/Revelar';
import CeramicShape, { type NombreSilueta } from '../marca/CeramicShape';
import DesgloseAnticipo from './DesgloseAnticipo';
import { asistentesDe, etiquetaPrecio } from './ResumenPago';

const mayuscula = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

/**
 * Confirmación: lo primero que se lee es que ya está y su número de reserva.
 * Después, qué, cuándo, quién, cuánto costó, cuánto se pagó y cuánto falta.
 * La misma reserva ya vive en «Mi cuenta» y en el panel del equipo.
 */
export default function Confirmacion({
  reserva: r, titulo = '¡Tu lugar está reservado!', silueta = 'olla', volver, children,
}: {
  reserva: Reserva;
  titulo?: string;
  silueta?: NombreSilueta;
  volver: { to: string; texto: string };
  children?: ReactNode;
}) {
  const lugar = siteConfig.direccion ? `${siteConfig.direccion}, ${siteConfig.zona}` : `Casa Numa, ${siteConfig.zona}`;
  const google = enlaceGoogleCalendarReserva(r, lugar);
  const demo = fuenteDatos === 'demo';
  // El correo que recibe la clienta (en la demo no sale: se muestra aquí).
  const correo = demo ? avisosReservaConfirmada(r, () => 'vista').find((a) => a.destinatario === 'cliente') : undefined;

  return (
    <div className="mx-auto max-w-3xl text-center">
      <m.div
        initial={{ opacity: 0, y: 20, rotate: -6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.9, ease: EASE_NUMA }}
        className="flex justify-center"
      >
        <CeramicShape nombre={silueta} className="h-20 w-auto" />
      </m.div>
      <h1 className="mt-8 font-display text-t1 font-light">{titulo}</h1>

      <p className="eyebrow mt-8 text-cafe/60">Número de reserva</p>
      <p className="cifra mt-2 text-[clamp(2.6rem,7vw,3.8rem)] leading-none tracking-[0.04em]" data-folio>{r.folio}</p>

      <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Estado">
        <li className="eyebrow rounded-full bg-verde/25 px-3 py-1.5 text-[0.6rem]">Reserva confirmada</li>
        {r.cobro && (
          <li className="eyebrow rounded-full border border-amarillo bg-amarillo/20 px-3 py-1.5 text-[0.6rem]" data-estado-pago>
            {r.cobro.saldo > 0 ? `Pago del ${r.cobro.porcentaje} % recibido` : 'Pagada completa'}
          </li>
        )}
      </ul>

      <div className="mt-10 rounded-suave border border-cafe/15 p-6 text-left sm:p-8">
        <p className="font-display text-t3 font-light">{r.titulo}</p>
        <ul className="mt-4 space-y-1.5 text-cuerpo">
          {r.sesiones.map((s, i) => (
            <li key={s.id} className="flex flex-wrap gap-x-3">
              {r.sesiones.length > 1 && <span className="cifra w-5 text-cafe/45">{i + 1}</span>}
              <span>{mayuscula(fechaCompleta(s.fecha))}</span>
              <span className="text-cafe/70">{rango(s.inicio, s.fin)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-nota text-cafe/75" data-asistentes>{asistentesDe(r)}</p>

        {r.cobro ? (
          <div className="mt-5 border-t border-cafe/10 pt-5">
            <p className="text-nota text-cafe/70">{etiquetaPrecio(r)}: {pesosCortos(r.precioUnitario)}</p>
            <DesgloseAnticipo
              modo="despues" className="mt-4" total={r.total} anticipo={r.cobro.anticipo} porcentaje={r.cobro.porcentaje}
              pagado={r.cobro.pagado} saldo={r.cobro.saldo}
            />
            <p className="mt-5 rounded-[0.6rem] bg-amarillo/25 px-4 py-3 text-nota text-cafe">
              Tu reservación está confirmada. El saldo restante se liquida en Casa Numa.
            </p>
            {demo && <p className="mt-2 text-[0.74rem] text-cafe/65">Pago simulado en la demo.</p>}
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-end justify-end gap-4 border-t border-cafe/10 pt-5">
            <p className="text-right">
              <span className="eyebrow block text-[0.6rem] text-cafe/55">Total</span>
              <span className="cifra text-[1.9rem] leading-none">{pesosCortos(r.total)}</span>
              <span className="mt-1 block text-[0.74rem] text-cafe/65">
                Pago: {r.pago === 'pagado' ? 'Pagado' : r.pago === 'reembolsado' ? 'Reembolsado' : 'Pendiente'}
                {demo ? ' · simulado en la demo' : ''}
              </span>
            </p>
          </div>
        )}
        {children && <div className="mt-5 border-t border-cafe/10 pt-5 text-nota text-cafe/75">{children}</div>}
      </div>

      <p className="mx-auto mt-8 max-w-[48ch] text-nota text-cafe/75">
        Te enviamos la confirmación a <strong className="font-medium text-cafe">{r.contacto.email}</strong>.
        {demo && ' En esta demo el correo no sale: queda registrado en los avisos del panel.'}
      </p>
      {correo && (
        <details className="mx-auto mt-4 max-w-xl rounded-suave border border-dashed border-indigo/40 bg-indigo/[0.04] text-left">
          <summary className="cursor-pointer list-none px-4 py-3 text-[0.78rem] text-indigo">
            <span className="eyebrow mr-2 text-[0.58rem]">Email demo</span> Ver el correo de confirmación
          </summary>
          <div className="border-t border-indigo/20 px-4 py-3 text-[0.8rem] text-cafe/85" data-correo-demo>
            <p className="font-medium">{correo.asunto}</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{correo.lineas.join('\n')}</pre>
          </div>
        </details>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <BotonEnlace to="/cuenta" flecha>Ver mis reservas</BotonEnlace>
        <Boton variante="secundario" onClick={() => descargarIcsReserva(r, lugar)}>Agregar a mi calendario</Boton>
        <BotonEnlace to={volver.to} variante="secundario">{volver.texto}</BotonEnlace>
      </div>
      {google && (
        <p className="mt-6 text-nota text-cafe/75">
          <a href={google} target="_blank" rel="noopener noreferrer" className="subrayado-fijo pb-0.5">Agregar a Google Calendar</a>
        </p>
      )}
    </div>
  );
}
