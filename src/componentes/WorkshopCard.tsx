import { Link } from 'react-router-dom';
import type { Taller } from '../datos/tipos';
import { DIAS_CORTOS, MESES, diaSemana, hora, partes, rango } from '../lib/calendario';
import { pocosLugares, sinLugar, textoLugares } from '../lib/cupo';
import { cuandoTaller, precioTaller, publicoTaller } from '../lib/talleres';
import { mensajeInformacionTaller } from '../contenido/whatsapp';
import Foto from './base/Foto';
import { BotonEnlace, EnlaceFlecha } from './base/Boton';
import CtaInformacion from './base/CtaInformacion';
import { MarcaDemo } from './base/Pendiente';
import CeramicShape from './marca/CeramicShape';

/** Sello de fecha: "JUE / 01 / OCT", en Bebas, sobre la foto. */
export function SelloFecha({ fecha, className = '' }: { fecha: string; className?: string }) {
  const [, m, d] = partes(fecha);
  return (
    <span className={`flex flex-col items-center rounded-[0.6rem] bg-crema/95 px-3 py-2 text-cafe ${className}`}>
      <span className="eyebrow text-[0.55rem] text-cafe/65">{DIAS_CORTOS[diaSemana(fecha)]}</span>
      <span className="cifra text-[2rem] leading-[0.9]">{String(d).padStart(2, '0')}</span>
      <span className="eyebrow text-[0.55rem] text-cafe/65">{MESES[m - 1].slice(0, 3)}</span>
    </span>
  );
}

/**
 * Ficha de un taller de la agenda: foto grande, fecha, público, horario,
 * precio y la acción que corresponde — reservar en línea o pedir
 * información cuando el precio no está publicado.
 */
export default function WorkshopCard({ taller: t, compacta = false }: { taller: Taller; compacta?: boolean }) {
  const detalle = `/talleres/${t.slug}`;
  const temporada = t.categoria === 'temporada';
  const varias = t.sesiones.length > 1;
  const abierto = t.sesiones.some((s) => !sinLugar(s));
  const cupoAbierto = t.sesiones.every((s) => s.disponibles === null);

  return (
    <article className="group flex h-full flex-col">
      <Link to={detalle} className="relative block" tabIndex={-1} aria-hidden="true">
        <Foto
          id={t.foto}
          className={`w-full rounded-foto ${compacta ? 'aspect-[5/4]' : 'aspect-[4/3]'}`}
          sizes={compacta ? '(min-width:1024px) 28vw, 80vw' : '(min-width:1280px) 30vw, (min-width:640px) 45vw, 100vw'}
          zoom
        />
        <SelloFecha fecha={t.sesiones[0].fecha} className="absolute left-3 top-3" />
        {temporada && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-naranja px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] text-cafe">
            <CeramicShape nombre="taza" color="text-cafe" className="h-3 w-auto" /> Temporada
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="eyebrow text-[0.62rem] text-cafe/65">{publicoTaller(t)}</p>
          {t.demo && <MarcaDemo />}
        </div>
        <h3 className={`mt-3 font-display font-light leading-tight ${compacta ? 'text-t4' : 'text-[1.7rem]'}`}>
          <Link to={detalle} className="transition-colors hover:text-terracota">{t.titulo}</Link>
        </h3>
        {!compacta && <p className="mt-3 line-clamp-3 text-cuerpo text-cafe/80">{t.resumen}</p>}

        <dl className="mt-5 grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2 border-t border-cafe/12 pt-4 text-nota">
          <dt className="eyebrow text-[0.58rem] text-cafe/55">{varias ? 'Horarios' : 'Horario'}</dt>
          <dd className="text-cafe">
            {varias ? t.sesiones.map((s) => hora(s.inicio)).join(' / ') : rango(t.sesiones[0].inicio, t.sesiones[0].fin)}
          </dd>
          <dt className="eyebrow text-[0.58rem] text-cafe/55">Precio</dt>
          <dd className={t.precio !== null ? 'cifra text-[1.35rem] leading-none text-cafe' : 'text-cafe'}>{precioTaller(t)}</dd>
          <dt className="eyebrow text-[0.58rem] text-cafe/55">Cupo</dt>
          <dd className="flex items-center gap-1.5 text-cafe/85">
            {t.sesiones.some(pocosLugares) && <span className="h-1.5 w-1.5 rounded-full bg-naranja" aria-hidden="true" />}
            {cupoAbierto && abierto ? 'Cupo limitado' : textoLugares(t.sesiones.find((s) => !sinLugar(s)) ?? t.sesiones[0])}
          </dd>
        </dl>

        {/* Varios horarios reservables: cada uno lleva directo al checkout */}
        {t.reservaEnLinea && varias && !compacta && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Elige horario">
            {t.sesiones.map((s) =>
              sinLugar(s) ? (
                <li key={s.id} className="inline-flex min-h-10 items-center rounded-full border border-cafe/10 px-4 text-[0.78rem] text-cafe/40 line-through">
                  {hora(s.inicio)}
                </li>
              ) : (
                <li key={s.id}>
                  <Link
                    to={`${detalle}?sesion=${s.id}`}
                    className="inline-flex min-h-10 items-center rounded-full border border-cafe/25 px-4 text-[0.78rem] text-cafe transition-colors hover:border-cafe hover:bg-cafe hover:text-crema"
                  >
                    {hora(s.inicio)}
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
          {!abierto ? (
            <p className="text-nota text-cafe/65">Este taller ya no tiene lugares.</p>
          ) : t.reservaEnLinea ? (
            <BotonEnlace to={detalle} tamano={compacta ? 'chico' : 'normal'} flecha>Reservar mi lugar</BotonEnlace>
          ) : (
            <>
              <CtaInformacion
                mensaje={mensajeInformacionTaller(t.titulo, cuandoTaller(t))}
                tamano={compacta ? 'chico' : 'normal'}
                variante="secundario"
              />
              {!compacta && <EnlaceFlecha to={detalle}>Ver detalle</EnlaceFlecha>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
