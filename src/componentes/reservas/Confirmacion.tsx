import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import type { Reserva } from '../../datos/tipos';
import { fuenteDatos, siteConfig } from '../../config/site';
import { fechaCompleta, hora } from '../../lib/calendario';
import { pesosCortos } from '../../lib/formato';
import { descargarIcsReserva } from '../../lib/ics';
import { BotonEnlace } from '../base/Boton';
import { EASE_NUMA } from '../base/Revelar';
import CeramicShape, { type NombreSilueta } from '../marca/CeramicShape';

const mayuscula = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

/**
 * Confirmación: lo primero que se lee es que ya está y su número de reserva.
 * Después, qué, cuándo, cuántos y cuánto. La reserva ya vive en "Mi cuenta"
 * y en el panel del equipo.
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
      <p className="cifra mt-2 text-[clamp(2.6rem,7vw,3.8rem)] leading-none tracking-[0.04em]">{r.folio}</p>

      <div className="mt-10 rounded-suave border border-cafe/15 p-6 text-left sm:p-8">
        <p className="font-display text-t3 font-light">{r.titulo}</p>
        <ul className="mt-4 space-y-1.5 text-cuerpo">
          {r.sesiones.map((s, i) => (
            <li key={s.id} className="flex flex-wrap gap-x-3">
              {r.sesiones.length > 1 && <span className="cifra w-5 text-cafe/45">{i + 1}</span>}
              <span>{mayuscula(fechaCompleta(s.fecha))}</span>
              <span className="text-cafe/70">{hora(s.inicio)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-cafe/10 pt-5">
          <p className="text-nota text-cafe/75">
            {r.ninos?.length
              ? r.ninos.map((n) => `${n.nombre} (${n.edad} años)`).join(' · ')
              : `${r.participantes} ${r.participantes === 1 ? 'participante' : 'participantes'}`}
          </p>
          <p className="text-right">
            <span className="eyebrow block text-[0.6rem] text-cafe/55">Total</span>
            <span className="cifra text-[1.9rem] leading-none">{pesosCortos(r.total)}</span>
          </p>
        </div>
        {children && <div className="mt-5 border-t border-cafe/10 pt-5 text-nota text-cafe/75">{children}</div>}
      </div>

      <p className="mx-auto mt-8 max-w-[48ch] text-nota text-cafe/75">
        Te enviamos la confirmación a <strong className="font-medium text-cafe">{r.contacto.email}</strong>.
        {fuenteDatos === 'demo' && ' En esta demo el correo no sale: queda registrado en los avisos del panel.'}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <BotonEnlace to="/cuenta" flecha>Ver mis reservas</BotonEnlace>
        <BotonEnlace to={volver.to} variante="secundario">{volver.texto}</BotonEnlace>
      </div>
      <button
        type="button"
        onClick={() => descargarIcsReserva(r, lugar)}
        className="subrayado-fijo mt-6 pb-0.5 text-nota text-cafe/75"
      >
        Agregar a mi calendario
      </button>
    </div>
  );
}
