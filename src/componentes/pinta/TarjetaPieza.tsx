import type { ReactNode } from 'react';
import type { PiezaPinta } from '../../datos/tipos';
import { estadoPieza, type EstadoPieza } from '../../datos/pinta';
import { mensajePintaTuPieza } from '../../contenido/whatsapp';
import { enlaceWhatsapp } from '../../config/site';
import { calcularPagoReserva } from '../../lib/anticipo';
import { pesosCortos } from '../../lib/formato';
import Foto from '../base/Foto';
import { Icono } from '../base/Iconos';

const SELLO: Record<Exclude<EstadoPieza, 'disponible'>, { texto: string; clase: string }> = {
  agotada: { texto: 'Agotada', clase: 'bg-cafe text-crema' },
  precio_pendiente: { texto: 'Precio pendiente', clase: 'bg-crema/95 text-indigo' },
  no_disponible: { texto: 'No disponible', clase: 'bg-cafe/80 text-crema' },
};

/** "Quedan 2" solo cuando hay conteo y son pocas: lo demás no se inventa. */
function existencias(p: PiezaPinta): string | null {
  if (p.disponibles === null || p.disponibles <= 0) return null;
  return p.disponibles <= 3 ? (p.disponibles === 1 ? 'Queda 1' : `Quedan ${p.disponibles}`) : null;
}

/**
 * Una pieza de bizcochito: foto real, nombre, precio y lo que se paga hoy
 * (el anticipo, calculado con lib/anticipo). Sin precio publicado no se
 * puede elegir: invita a consultar por WhatsApp.
 *
 * Con `onElegir`, la tarjeta es seleccionable (paso «Pieza» de la reserva).
 * Con `accion`, muestra ese botón (catálogo de la página).
 */
export default function TarjetaPieza({
  pieza: p, seleccionada = false, onElegir, accion, sizes = '(min-width:1024px) 22vw, 45vw',
}: {
  pieza: PiezaPinta;
  seleccionada?: boolean;
  onElegir?: (p: PiezaPinta) => void;
  accion?: ReactNode;
  sizes?: string;
}) {
  const estado = estadoPieza(p);
  const disponible = estado === 'disponible';
  const pago = disponible && p.precio !== null ? calcularPagoReserva(p.precio) : null;
  const detalle = [p.tamano, p.acabado].filter(Boolean).join(' · ');
  const quedan = existencias(p);
  const whatsapp = estado === 'precio_pendiente' ? enlaceWhatsapp(mensajePintaTuPieza(p.nombre)) : null;

  return (
    <article
      className={`flex h-full flex-col rounded-suave p-2 transition-colors duration-rapida ${
        seleccionada ? 'bg-cafe text-crema' : 'bg-transparent text-cafe'
      }`}
      aria-label={p.nombre}
      data-pieza={p.id}
    >
      <div className="relative">
        <Foto
          foto={p.fotos[0]}
          className={`aspect-[4/5] w-full rounded-[0.6rem] ${disponible ? '' : 'opacity-75 saturate-50'}`}
          sizes={sizes}
        />
        {!disponible && (
          <span className={`eyebrow absolute left-2.5 top-2.5 z-10 rounded-full px-2.5 py-1 text-[0.56rem] ${SELLO[estado].clase}`}>
            {SELLO[estado].texto}
          </span>
        )}
        {disponible && p.demo && (
          <span
            className="eyebrow absolute left-2.5 top-2.5 z-10 rounded-full border border-indigo/40 bg-crema/95 px-2.5 py-1 text-[0.54rem] text-indigo"
            title="Precio de ejemplo para recorrer la demo: Casa Numa aún no publica el precio de esta pieza"
          >
            Precio de ejemplo
          </span>
        )}
        {seleccionada && (
          <span className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-crema text-cafe" aria-hidden="true">
            <Icono.check tam={16} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-4">
        <h3 className="font-display text-[1.3rem] font-light leading-tight">{p.nombre}</h3>
        <p className={`mt-1 text-[0.74rem] ${seleccionada ? 'text-crema/70' : 'text-cafe/60'}`}>
          {detalle || p.categoria}
          {quedan && <span className={seleccionada ? 'text-crema' : 'text-cafe'}> · {quedan}</span>}
        </p>

        {pago ? (
          // En celular, una fila por dato; desde sm caben lado a lado.
          <dl className={`mt-4 grid gap-1.5 border-t pt-3 sm:grid-cols-2 sm:gap-2 ${seleccionada ? 'border-crema/25' : 'border-cafe/12'}`}>
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <dt className={`eyebrow text-[0.56rem] ${seleccionada ? 'text-crema/65' : 'text-cafe/55'}`}>Precio</dt>
              <dd className="whitespace-nowrap text-[0.9rem] sm:mt-1 sm:text-[0.95rem]">{pesosCortos(pago.total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 sm:block">
              <dt className={`eyebrow text-[0.56rem] ${seleccionada ? 'text-crema/65' : 'text-cafe/55'}`}>Pagas hoy</dt>
              <dd className="cifra whitespace-nowrap text-[1.25rem] leading-none sm:mt-1 sm:text-[1.35rem]">{pesosCortos(pago.anticipo)}</dd>
            </div>
          </dl>
        ) : (
          <p className={`mt-4 border-t pt-3 text-[0.82rem] ${seleccionada ? 'border-crema/25' : 'border-cafe/12 text-cafe/70'}`}>
            {estado === 'precio_pendiente' ? 'Precio pendiente' : estado === 'agotada' ? 'Agotada por ahora' : 'No disponible por ahora'}
          </p>
        )}

        <div className="mt-auto pt-4">
          {onElegir && disponible ? (
            <button
              type="button"
              onClick={() => onElegir(p)}
              aria-pressed={seleccionada}
              aria-label={`${seleccionada ? 'Elegida' : 'Elegir'}: ${p.nombre}`}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[0.7rem] font-medium uppercase tracking-[0.14em] transition-colors ${
                seleccionada ? 'bg-crema text-cafe' : 'border border-cafe/35 hover:border-cafe hover:bg-cafe hover:text-crema'
              }`}
            >
              {seleccionada ? <><Icono.check tam={15} /> Elegida</> : 'Elegir'}
            </button>
          ) : whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Consultar disponibilidad de ${p.nombre} por WhatsApp`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-cafe/25 px-2 text-[0.66rem] font-medium uppercase tracking-[0.1em] text-cafe hover:border-cafe"
            >
              <Icono.whatsapp tam={15} />
              <span className="sm:hidden">Consultar</span>
              <span className="hidden sm:inline">Consultar disponibilidad</span>
            </a>
          ) : disponible ? (
            accion ?? null
          ) : null}
        </div>
      </div>
    </article>
  );
}
