import { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Testimonio } from '../contenido/testimonios';
import { mostrarPendientes } from '../config/site';
import Foto from './base/Foto';
import { Icono } from './base/Iconos';
import { EASE_NUMA } from './base/Revelar';

const PENDIENTES = 3;

/**
 * Testimonios: una cita grande a la vez, con número y flechas. Sin carrusel
 * automático (nadie alcanza a leer una cita que se va sola).
 *
 * Solo reseñas reales. Sin ellas, en desarrollo se ven espacios marcados
 * "TESTIMONIO REAL PENDIENTE" — que nunca se confunden con una reseña — y en
 * producción el componente no muestra nada.
 */
export default function Testimonial({ testimonios }: { testimonios: Testimonio[] }) {
  const [i, setI] = useState(0);
  const pendiente = testimonios.length === 0;
  if (pendiente && !mostrarPendientes) return null;

  const total = pendiente ? PENDIENTES : testimonios.length;
  const t = pendiente ? null : testimonios[i];
  const mover = (d: number) => setI((v) => (v + d + total) % total);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-9" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.figure
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: EASE_NUMA }}
          >
            <span className="font-display text-[5rem] leading-[0.5] text-terracota" aria-hidden="true">“</span>
            {t ? (
              <>
                <blockquote className="mt-2 font-display text-t2 font-light text-cafe">{t.cita}</blockquote>
                <figcaption className="mt-8 flex items-center gap-4">
                  {t.foto && <Foto foto={t.foto} className="h-14 w-14 rounded-full" sizes="56px" />}
                  <span>
                    <span className="block text-cuerpo text-cafe">{t.nombre}</span>
                    {t.experiencia && <span className="eyebrow mt-1 block text-[0.6rem] text-cafe/60">{t.experiencia}</span>}
                  </span>
                </figcaption>
              </>
            ) : (
              <div className="mt-2 rounded-suave border border-dashed border-indigo/45 px-6 py-10 sm:px-10" data-pendiente>
                <p className="eyebrow text-indigo">Testimonio real pendiente · {i + 1}</p>
                <p className="mt-4 max-w-[46ch] font-display text-t3 font-light text-cafe/45">
                  Aquí va la reseña de una persona que vivió NUMA, con su nombre y su permiso.
                </p>
                <p className="mt-6 text-nota text-cafe/60">
                  Solo se publican reseñas reales, con el permiso de quien las escribe.
                </p>
              </div>
            )}
          </m.figure>
        </AnimatePresence>
      </div>

      {total > 1 && (
        <div className="flex items-end justify-between gap-6 lg:col-span-3 lg:flex-col lg:items-end">
          <p className="cifra text-[2.2rem] leading-none text-cafe" aria-label={`Testimonio ${i + 1} de ${total}`}>
            {String(i + 1).padStart(2, '0')}
            <span className="text-cafe/35"> / {String(total).padStart(2, '0')}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => mover(-1)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cafe/30 text-cafe transition-colors hover:bg-cafe hover:text-crema"
              aria-label="Testimonio anterior"
            >
              <Icono.flechaIzq tam={18} />
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cafe/30 text-cafe transition-colors hover:bg-cafe hover:text-crema"
              aria-label="Testimonio siguiente"
            >
              <Icono.flecha tam={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
