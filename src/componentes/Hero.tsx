import { Link } from 'react-router-dom';
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { siteConfig } from '../config/site';
import { OPCIONES_RESERVA } from '../contenido/navegacion';
import Foto from './base/Foto';
import { BotonEnlace } from './base/Boton';
import { EASE_NUMA } from './base/Revelar';
import CeramicShape from './marca/CeramicShape';

const LINEAS = ['Un espacio', 'donde las ideas', 'toman forma.'];

/**
 * Portada. Primero el deseo, después la agenda.
 *
 * La foto principal vive dentro de un arco (la U de NUMA girada) con un
 * segundo arco fino alrededor: el mismo "aire" que separa las dos U del
 * logotipo. Al cargar, la foto sube desde abajo como el barro en el torno.
 */
export default function Hero() {
  const reducir = useReducedMotion();
  const { scrollY } = useScroll();
  const ySecundaria = useTransform(scrollY, [0, 700], [0, reducir ? 0 : -56]);
  const yFoto = useTransform(scrollY, [0, 700], [0, reducir ? 0 : 36]);

  return (
    <section className="relative overflow-hidden pb-seccion-s pt-[calc(theme(spacing.header)+2.5rem)] lg:min-h-[100svh] lg:pt-[calc(theme(spacing.header)+3.5rem)]">
      <div className="contenedor grid items-end gap-14 lg:grid-cols-12 lg:gap-8">
        {/* Texto */}
        <div className="relative z-10 lg:col-span-7 lg:pb-10">
          <m.p
            className="eyebrow flex items-center gap-4 text-cafe/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <span className="cifra text-[1.3rem] tracking-[0.06em] text-cafe">Casa Numa</span>
            <span className="h-px w-10 bg-cafe/30" aria-hidden="true" />
            <span>Estudio de cerámica</span>
          </m.p>

          <h1 className="mt-7 font-display text-hero font-light text-cafe">
            {LINEAS.map((linea, i) => (
              <span key={linea} className="block overflow-hidden pb-[0.08em]">
                <m.span
                  className="block"
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.1, ease: EASE_NUMA, delay: 0.15 + i * 0.12 }}
                >
                  {i === 2 ? (
                    <>
                      toman <em className="font-light italic text-terracota">forma.</em>
                    </>
                  ) : (
                    linea
                  )}
                </m.span>
              </span>
            ))}
          </h1>

          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE_NUMA, delay: 0.65 }}
          >
            <p className="mt-8 max-w-[34rem] text-cuerpo-l text-cafe/85">
              Cerámica, creatividad y experiencias para conectar con tus manos y desconectarte de la rutina.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <BotonEnlace to="/talleres" flecha>Ver talleres</BotonEnlace>
              <BotonEnlace to="/nosotras" variante="secundario">Conocer NUMA</BotonEnlace>
            </div>
            <p className="eyebrow mt-10 flex items-center gap-3 text-[0.64rem] text-cafe/65">
              <CeramicShape nombre="botellon" className="h-4 w-auto" />
              {siteConfig.zona.replace('Casco de ', '').replace(', ', ' · ')}
            </p>
          </m.div>
        </div>

        {/* Composición fotográfica */}
        <div className="relative lg:col-span-5">
          <div className="relative mx-auto w-[86%] max-w-[30rem] lg:mr-0 lg:w-full">
            {/* Arco fino: el aire entre las dos U del logo */}
            <m.div
              className="absolute -inset-3 rounded-arco border border-terracota/50 sm:-inset-4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.4, ease: EASE_NUMA, delay: 0.5 }}
              aria-hidden="true"
            />
            <m.div
              className="relative overflow-hidden rounded-arco"
              initial={{ clipPath: 'inset(100% 0 0 0)' }}
              animate={{ clipPath: 'inset(0% 0 0 0)' }}
              transition={{ duration: 1.5, ease: EASE_NUMA, delay: 0.2 }}
            >
              <m.div style={{ y: yFoto, scale: 1.08 }}>
                <Foto id="inicio-hero" prioridad className="aspect-[4/5.4] w-full" sizes="(min-width: 1024px) 34vw, 86vw" />
              </m.div>
            </m.div>

            <m.div
              className="absolute -right-2 -top-7 w-14 sm:w-16"
              initial={{ opacity: 0, rotate: -10, y: 10 }}
              animate={{ opacity: 1, rotate: 0, y: 0 }}
              transition={{ duration: 1, ease: EASE_NUMA, delay: 1.2 }}
              aria-hidden="true"
            >
              <CeramicShape nombre="guaje" className="h-auto w-full" />
            </m.div>
          </div>

          {/* Foto secundaria, horizontal, que entra por la izquierda */}
          <m.div
            className="absolute -bottom-10 -left-2 w-[52%] max-w-[17rem] sm:-left-6 lg:-left-[28%] lg:bottom-6"
            style={{ y: ySecundaria }}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, ease: EASE_NUMA, delay: 0.85 }}
          >
            <Foto id="inicio-hero-mesa" className="aspect-[4/3] w-full rounded-foto ring-[6px] ring-crema" sizes="17rem" />
          </m.div>
        </div>
      </div>

      {/* Índice rápido: qué se puede reservar, sin tener que buscarlo */}
      <m.nav
        aria-label="Reservas"
        className="contenedor mt-24 lg:mt-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
      >
        <ul className="grid grid-cols-2 border-t border-cafe/15 sm:grid-cols-4">
          {OPCIONES_RESERVA.map((o, i) => (
            <li key={o.to} className={`border-cafe/15 ${i % 2 === 1 ? 'border-l' : ''} sm:border-l sm:first:border-l-0`}>
              <Link to={o.to} className="group flex h-full flex-col gap-1 px-1 py-5 sm:px-5 sm:first:pl-0">
                <span className="cifra text-[0.95rem] text-cafe/55">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-[1.15rem] leading-tight text-cafe transition-colors group-hover:text-terracota sm:text-[1.3rem]">
                  {o.titulo}
                </span>
                <span className="text-[0.74rem] text-cafe/65">{o.detalle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </m.nav>
    </section>
  );
}
