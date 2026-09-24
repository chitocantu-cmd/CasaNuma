import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import type { Reserva } from '../../datos/tipos';
import { fuenteDatos, siteConfig } from '../../config/site';
import { fechaCompleta, rango } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import { descargarIcsReserva } from '../../lib/ics';
import { Boton, BotonEnlace } from '../base/Boton';
import { EASE_NUMA } from '../base/Revelar';
import CeramicShape, { type NombreSilueta } from '../marca/CeramicShape';

/**
 * Confirmación: lo primero que se lee es que ya está. Después, el código,
 * las fechas y qué sigue. La reserva ya vive en "Mi cuenta".
 */
export default function Confirmacion({
  reserva, titulo, silueta = 'olla', children,
}: {
  reserva: Reserva;
  titulo: string;
  silueta?: NombreSilueta;
  children?: ReactNode;
}) {
  const lugar = siteConfig.direccion ? `${siteConfig.direccion}, ${siteConfig.zona}` : `Casa Numa, ${siteConfig.zona}`;

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
      <p className="eyebrow mt-8 text-cafe/65">Reserva confirmada · {reserva.codigo}</p>
      <h1 className="mt-5 font-display text-t1 font-light">{titulo}</h1>
      <p className="mx-auto mt-6 max-w-[46ch] text-cuerpo-l text-cafe/80">
        {fuenteDatos === 'demo' ? (
          <>Tu reserva ya está guardada en tu cuenta. En la versión real, la confirmación llega también a {reserva.contacto.email}.</>
        ) : (
          <>
            Te enviamos los detalles a <strong className="font-medium text-cafe">{reserva.contacto.email}</strong>. También
            los encuentras en tu cuenta.
          </>
        )}
      </p>

      <div className="mt-12 rounded-suave border border-cafe/15 p-6 text-left sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-cafe/10 pb-5">
          <p className="font-display text-t4 font-light">{reserva.titulo}</p>
          <p className="cifra text-[1.6rem] leading-none">{pesosCortos(reserva.total)}</p>
        </div>
        <ol className="mt-5 space-y-3">
          {reserva.sesiones.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 text-cuerpo">
              <span className="flex items-baseline gap-3">
                {reserva.sesiones.length > 1 && <span className="cifra w-5 text-cafe/45">{i + 1}</span>}
                <span className="first-letter:uppercase">{fechaCompleta(s.fecha)}</span>
              </span>
              <span className="text-cafe/70">{rango(s.inicio, s.fin)}</span>
            </li>
          ))}
        </ol>
        {reserva.ninos && reserva.ninos.length > 0 && (
          <p className="mt-5 border-t border-cafe/10 pt-5 text-nota text-cafe/75">
            {reserva.ninos.map((n) => `${n.nombre} (${n.edad} años)`).join(' · ')}
          </p>
        )}
        {reserva.tipo === 'taller' && reserva.participantes > 1 && (
          <p className="mt-5 border-t border-cafe/10 pt-5 text-nota text-cafe/75">{reserva.participantes} personas</p>
        )}
        {children && <div className="mt-5 border-t border-cafe/10 pt-5 text-nota text-cafe/75">{children}</div>}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <BotonEnlace to="/cuenta" flecha>Ver en mi cuenta</BotonEnlace>
        <Boton variante="secundario" onClick={() => descargarIcsReserva(reserva, lugar)}>
          Agregar a mi calendario
        </Boton>
      </div>
    </div>
  );
}
