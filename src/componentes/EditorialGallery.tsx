import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { PiezaPortafolio } from '../contenido/portafolio';
import Foto from './base/Foto';
import Revelar, { EASE_NUMA } from './base/Revelar';
import { Icono } from './base/Iconos';
import { EnlaceFlecha } from './base/Boton';

// ---------------------------------------------------------------------------
// Galería editorial del portafolio
// ---------------------------------------------------------------------------
// Composición fija y asimétrica, como una doble página de revista: una
// vertical grande, dos pequeñas, una horizontal; después un segundo tiempo
// desfasado. Nada de cuadrícula de e-commerce: aquí no se compra, se mira.
// ---------------------------------------------------------------------------

/** Posición de cada pieza en la retícula de 12 columnas (escritorio). */
const COMPOSICION = [
  { celda: 'col-span-2 lg:col-span-5 lg:row-span-2', forma: 'aspect-[4/5] rounded-foto', sizes: '(min-width:1024px) 38vw, 100vw' },
  { celda: 'col-span-1 lg:col-span-3 lg:col-start-7 lg:self-end', forma: 'aspect-square rounded-foto', sizes: '(min-width:1024px) 22vw, 50vw' },
  { celda: 'col-span-1 lg:col-span-3 lg:self-end', forma: 'aspect-[4/5] rounded-u', sizes: '(min-width:1024px) 22vw, 50vw' },
  { celda: 'col-span-2 lg:col-span-7 lg:col-start-1', forma: 'aspect-[16/10] rounded-foto', sizes: '(min-width:1024px) 54vw, 100vw' },
  { celda: 'col-span-1 lg:col-span-4 lg:col-start-2 lg:mt-20', forma: 'aspect-[3/4] rounded-arco', sizes: '(min-width:1024px) 30vw, 50vw' },
  { celda: 'col-span-1 lg:col-span-3 lg:mt-44', forma: 'aspect-square rounded-foto', sizes: '(min-width:1024px) 22vw, 50vw' },
  { celda: 'col-span-2 lg:col-span-4 lg:mt-8', forma: 'aspect-[4/3] rounded-foto', sizes: '(min-width:1024px) 30vw, 100vw' },
];

export default function EditorialGallery({
  piezas,
  encabezado,
  nota,
}: {
  piezas: PiezaPortafolio[];
  /** Se coloca junto a la foto grande, como en el boceto. */
  encabezado: ReactNode;
  /** Ocupa el hueco a la derecha de la foto horizontal. */
  nota?: ReactNode;
}) {
  const [abierta, setAbierta] = useState<PiezaPortafolio | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-10">
        {/* Encabezado: en escritorio a la derecha de la foto grande */}
        <div className="col-span-2 lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:pb-6">{encabezado}</div>

        {piezas.slice(0, COMPOSICION.length).map((p, i) => {
          const c = COMPOSICION[i];
          return (
            <Fragment key={p.id}>
            <Revelar
              retraso={(i % 3) * 0.08}
              className={`${c.celda} ${i === 0 ? 'lg:row-start-1' : ''} ${i === 1 || i === 2 ? 'lg:row-start-2' : ''}`}
            >
              <figure>
                <button
                  type="button"
                  onClick={() => setAbierta(p)}
                  className="group relative block w-full text-left"
                  aria-label={`Ver pieza: ${p.titulo}`}
                >
                  <Foto foto={p.foto} className={`${c.forma} w-full`} sizes={c.sizes} zoom />
                  <span className="eyebrow pointer-events-none absolute bottom-3 left-3 z-10 inline-flex translate-y-1 items-center gap-2 rounded-full bg-crema/95 px-3.5 py-2 text-[0.6rem] text-cafe opacity-0 transition-all duration-media ease-numa group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    Ver pieza
                    <Icono.flechaDiagonal tam={12} />
                  </span>
                </button>
                <figcaption className="mt-3 flex items-baseline justify-between gap-3 text-[0.8rem]">
                  <span className="text-cafe">{p.titulo}</span>
                  <span className="eyebrow text-[0.58rem] text-cafe/55">{p.autora ? `${p.categoria} · ${p.autora}` : p.categoria}</span>
                </figcaption>
              </figure>
            </Revelar>
            {i === 3 && nota && (
              <div className="col-span-2 lg:col-span-4 lg:col-start-9 lg:self-center">{nota}</div>
            )}
            </Fragment>
          );
        })}
      </div>

      <VisorPieza pieza={abierta} onCerrar={() => setAbierta(null)} />
    </>
  );
}

function VisorPieza({ pieza, onCerrar }: { pieza: PiezaPortafolio | null; onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pieza) return;
    previo.current = document.activeElement as HTMLElement;
    cerrar.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', alTeclear);
      previo.current?.focus();
    };
  }, [pieza, onCerrar]);

  return (
    <AnimatePresence>
      {pieza && (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-cafe/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCerrar}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={pieza.titulo}
            className="relative grid max-h-[92svh] w-full max-w-5xl overflow-y-auto rounded-t-suave bg-crema sm:grid-cols-[1.25fr_1fr] sm:rounded-suave"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_NUMA }}
            onClick={(e) => e.stopPropagation()}
          >
            <Foto foto={pieza.foto} className="aspect-[4/5] w-full sm:aspect-auto sm:min-h-[34rem]" sizes="(min-width:640px) 55vw, 100vw" />
            <div className="flex flex-col p-7 sm:p-10">
              <button
                ref={cerrar}
                type="button"
                onClick={onCerrar}
                className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-crema/90 text-cafe"
                aria-label="Cerrar"
              >
                <Icono.cerrar tam={22} />
              </button>
              <p className="eyebrow text-cafe/60">{pieza.categoria}</p>
              <h3 className="mt-4 font-display text-t2 font-light">{pieza.titulo}</h3>
              {pieza.autora && <p className="mt-2 text-nota text-cafe/70">Obra de {pieza.autora}</p>}
              <p className="mt-6 text-cuerpo text-cafe/80">
                Una pieza nacida en nuestro estudio. El portafolio es para inspirarte; las piezas disponibles para
                comprar viven en NUMA Store.
              </p>
              <div className="mt-auto space-y-4 pt-10">
                <p className="text-nota text-cafe/70">¿Te gustaría algo así para ti?</p>
                <EnlaceFlecha to="/numa-store">Ver NUMA Store y encargos</EnlaceFlecha>
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
