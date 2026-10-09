import { useEffect, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import SectionHeading from '../componentes/SectionHeading';
import Foto from '../componentes/base/Foto';
import Revelar, { EASE_NUMA } from '../componentes/base/Revelar';
import { BotonEnlace, clasesBoton } from '../componentes/base/Boton';
import { Pendiente } from '../componentes/base/Pendiente';
import CtaWhatsapp from '../componentes/base/CtaWhatsapp';
import ErrorCarga from '../componentes/base/ErrorCarga';
import { CargandoBloque } from '../componentes/base/Cargando';
import EnlaceAncla from '../componentes/base/EnlaceAncla';
import CeramicShape from '../componentes/marca/CeramicShape';
import TarjetaPieza from '../componentes/pinta/TarjetaPieza';
import { PINTA } from '../contenido/oferta';
import { CATEGORIAS_PIEZA, GALERIA_PINTA, type CategoriaPieza } from '../contenido/piezasPinta';
import { mensajePintaTuPieza } from '../contenido/whatsapp';
import { usePiezasPinta } from '../datos/hooks';
import { sePuedeElegir } from '../datos/pinta';
import { PORCENTAJE_ANTICIPO, calcularPagoReserva } from '../lib/anticipo';
import { hora, rango } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { useSeo } from '../lib/seo';

// Texto: actualización «Pinta tu pieza» de Casa Numa (oct 2026).

const RESERVAR = '/pinta-tu-pieza/reservar';

const PASOS_EXPERIENCIA = [
  { titulo: 'Elige cuándo venir', texto: 'Selecciona la fecha y horario que mejor te funcionen.' },
  { titulo: 'Elige tu pieza', texto: 'Explora las piezas disponibles y selecciona la que quieres pintar.' },
  { titulo: `Aparta con el ${PORCENTAJE_ANTICIPO} %`, texto: `Paga el ${PORCENTAJE_ANTICIPO} % del valor de la pieza para confirmar tu reservación.` },
  { titulo: 'Ven a crear', texto: 'Te esperamos en Casa Numa para pintar y personalizar tu pieza.' },
  { titulo: 'Liquida el resto', texto: `El ${100 - PORCENTAJE_ANTICIPO} % restante se paga en Casa Numa.` },
];

/** Ejemplos del cálculo (no son el catálogo): mismos números que la actualización de Casa Numa. */
const EJEMPLOS_CALCULO = [200, 500, 800, 1200].map((precio) => calcularPagoReserva(precio));

const CANTIDAD_INICIAL = 8;

export default function PintaTuPieza() {
  useSeo({
    titulo: 'Pinta tu pieza | Pinta cerámica en San Pedro | Casa Numa',
    descripcion: `Elige una pieza de cerámica en bizcochito y píntala a tu gusto en Casa Numa. Piezas de ${pesosCortos(PINTA.precioDesde)} a ${pesosCortos(PINTA.precioHasta)}; reservas pagando el ${PORCENTAJE_ANTICIPO} % del valor de tu pieza.`,
  });
  const { datos: piezas, error, recargar } = usePiezasPinta();
  const [categoria, setCategoria] = useState<CategoriaPieza | 'todas'>('todas');
  const [todas, setTodas] = useState(false);

  const lista = useMemo(() => {
    const filtradas = (piezas ?? []).filter((p) => categoria === 'todas' || p.categoria === categoria);
    return [...filtradas].sort((a, b) => Number(!sePuedeElegir(a)) - Number(!sePuedeElegir(b)));
  }, [piezas, categoria]);
  const visibles = todas ? lista : lista.slice(0, CANTIDAD_INICIAL);

  return (
    <>
      {/* Hero -------------------------------------------------------------- */}
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-8">
          <div className="lg:col-span-6">
            <Revelar>
              <p className="eyebrow flex items-center gap-3 text-cafe/70">
                Experiencia NUMA <CeramicShape nombre="jarron" className="h-5 w-auto" />
              </p>
              <h1 className="mt-6 font-display text-hero font-light text-cafe">Pinta tu pieza</h1>
              <p className="mt-6 max-w-[22ch] font-display text-t3 font-light text-cafe/90">
                Elige tu cerámica favorita y dale tu toque.
              </p>
              <p className="mt-6 max-w-lectura text-cuerpo-l text-cafe/85">
                Elige una pieza, juega con el color y hazla completamente tuya.
              </p>
            </Revelar>
            <Revelar retraso={0.1}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <BotonEnlace to={RESERVAR} flecha>Reservar mi lugar</BotonEnlace>
                <EnlaceAncla destino="como-funciona" className={clasesBoton('secundario')}>Ver cómo funciona</EnlaceAncla>
              </div>
              <p className="mt-6 text-nota text-cafe/70">
                Piezas desde {pesosCortos(PINTA.precioDesde)} · Reservas pagando el {PORCENTAJE_ANTICIPO} % del valor de tu pieza
              </p>
            </Revelar>
          </div>
          <Revelar retraso={0.1} className="relative lg:col-span-5 lg:col-start-8">
            <Foto foto={GALERIA_PINTA[0]} prioridad className="aspect-[4/5] w-full rounded-arco" sizes="(min-width:1024px) 38vw, 100vw" />
            <div className="absolute -bottom-8 -left-4 w-[38%] sm:-left-8">
              <Foto foto={GALERIA_PINTA[2]} className="aspect-[4/5] w-full rounded-foto ring-[6px] ring-crema" sizes="(min-width:1024px) 14vw, 38vw" />
            </div>
            <CeramicShape nombre="taza" className="absolute -right-3 top-8 h-14 w-auto" />
          </Revelar>
        </div>
      </section>

      {/* 01 · La experiencia ------------------------------------------------- */}
      <section className="contenedor pb-seccion-s pt-seccion" aria-labelledby="p-experiencia">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <SectionHeading
              numero="01"
              eyebrow="La experiencia"
              titulo={<span id="p-experiencia">Elige tu cerámica favorita y dale tu toque.</span>}
              tamano="t2"
            />
            <Revelar retraso={0.1}>
              <div className="mt-8 max-w-lectura space-y-5 text-cuerpo-l text-cafe/85">
                <p>
                  Disfruta de un momento creativo pintando una pieza en bizcochito: cerámica ya modelada y con su primera
                  cocción.
                </p>
                <p>No necesitas experiencia; te acompañamos para darle color y personalidad.</p>
                <p>
                  Tenemos diferentes piezas para elegir, con precios desde {pesosCortos(PINTA.precioDesde)} hasta{' '}
                  {pesosCortos(PINTA.precioHasta)}. El precio depende del tamaño, tipo de pieza y acabado.
                </p>
                <p>
                  Al reservar, pagarás el {PORCENTAJE_ANTICIPO} % del valor de la pieza seleccionada para apartar tu lugar.
                  El {100 - PORCENTAJE_ANTICIPO} % restante se paga en Casa Numa.
                </p>
              </div>
            </Revelar>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end lg:col-span-5 lg:col-start-8">
            <Revelar>
              <Foto id="taller-tardes-ninos" className="aspect-[4/5] w-full rounded-u" sizes="(min-width:1024px) 20vw, 45vw" />
            </Revelar>
            <Revelar retraso={0.1} className="pt-12">
              <Foto id="hola-estudio" className="aspect-[4/5] w-full rounded-foto" sizes="(min-width:1024px) 20vw, 45vw" />
            </Revelar>
          </div>
        </div>
      </section>

      {/* 02 · Cómo funciona -------------------------------------------------- */}
      <section id="como-funciona" className="scroll-mt-24 bg-amarillo/[0.18] py-seccion" aria-labelledby="p-como">
        <div className="contenedor">
          <SectionHeading
            numero="02"
            eyebrow="Cómo funciona"
            titulo={<span id="p-como">Tú eliges la pieza. Tú decides cómo hacerla tuya.</span>}
            tamano="t2"
          />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-suave border border-cafe/15 bg-cafe/15 sm:grid-cols-2 lg:grid-cols-5">
            {PASOS_EXPERIENCIA.map((p, i) => (
              <Revelar key={p.titulo} como="li" retraso={i * 0.05} className="flex flex-col gap-4 bg-crema p-6 sm:p-7">
                <span className="cifra text-[2.6rem] leading-none text-terracota">{String(i + 1).padStart(2, '0')}</span>
                <span className="eyebrow text-cafe">{p.titulo}</span>
                <span className="text-nota text-cafe/80">{p.texto}</span>
              </Revelar>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 · Precios -------------------------------------------------------- */}
      <section className="contenedor py-seccion" aria-labelledby="p-precios">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <SectionHeading
              numero="03"
              eyebrow="Precios"
              titulo={<span id="p-precios">Encuentra la pieza que más te guste.</span>}
              tamano="t2"
            />
            <Revelar retraso={0.1}>
              <p className="mt-10 text-nota text-cafe/70">Tenemos opciones desde</p>
              <p className="cifra mt-2 text-[clamp(3rem,8vw,4.8rem)] leading-none">
                {pesosCortos(PINTA.precioDesde).replace(' MXN', '')} a {pesosCortos(PINTA.precioHasta)}
              </p>
              <p className="mt-8 text-nota text-cafe/70">El costo depende de:</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {PINTA.factoresPrecio.map((f) => (
                  <li key={f} className="rounded-full border border-cafe/20 px-4 py-2 text-[0.8rem]">{f}</li>
                ))}
              </ul>
            </Revelar>
          </div>

          <Revelar retraso={0.1} className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-suave bg-cafe p-7 text-crema sm:p-9" data-fondo="oscuro">
              <p className="font-display text-t3 font-light">Reserva pagando únicamente el {PORCENTAJE_ANTICIPO} % del valor de tu pieza.</p>
              <p className="mt-3 text-cuerpo text-crema/80">El resto se liquida en Casa Numa.</p>

              <table className="mt-8 w-full text-left text-[0.9rem]">
                <caption className="eyebrow mb-3 text-left text-[0.6rem] text-crema/60">Así se calcula tu anticipo · ejemplos</caption>
                <thead>
                  <tr className="border-b border-crema/20 text-[0.7rem] uppercase tracking-[0.12em] text-crema/60">
                    <th className="py-2 font-medium">Valor de la pieza</th>
                    <th className="py-2 font-medium">Pagas hoy</th>
                    <th className="py-2 text-right font-medium">En Casa Numa</th>
                  </tr>
                </thead>
                <tbody>
                  {EJEMPLOS_CALCULO.map((e) => (
                    <tr key={e.total} className="border-b border-crema/10 last:border-0">
                      <td className="py-3">{pesosCortos(e.total)}</td>
                      <td className="cifra py-3 text-[1.35rem] leading-none text-amarillo">{pesosCortos(e.anticipo)}</td>
                      <td className="py-3 text-right text-crema/80">{pesosCortos(e.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-6 text-[0.78rem] text-crema/65">
                No es un descuento: es un anticipo. Pagas el {PORCENTAJE_ANTICIPO} % para apartar tu lugar y el resto el día
                que vienes.
              </p>
            </div>
          </Revelar>
        </div>
      </section>

      {/* 04 · Piezas ----------------------------------------------------------- */}
      <section className="bg-cafe/[0.035] py-seccion" aria-labelledby="p-piezas">
        <div className="contenedor">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              numero="04"
              eyebrow="Piezas"
              titulo={<span id="p-piezas">Elige qué quieres pintar.</span>}
              intro={<p>Piezas de bizcochito listas para tu color. En cada una ves su precio y cuánto pagas hoy para reservar.</p>}
              tamano="t2"
            />
            <Revelar retraso={0.1} className="shrink-0 lg:pb-3">
              <BotonEnlace to={RESERVAR} flecha>Reservar mi lugar</BotonEnlace>
            </Revelar>
          </div>

          <div className="carril -mx-canal mt-12 flex gap-2 overflow-x-auto px-canal pb-1" role="group" aria-label="Tipo de pieza">
            {(['todas', ...CATEGORIAS_PIEZA] as const).map((c) => (
              <button
                key={c} type="button" onClick={() => { setCategoria(c); setTodas(false); }} aria-pressed={categoria === c}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-[0.78rem] transition-colors ${
                  categoria === c ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 bg-crema hover:border-cafe'
                }`}
              >
                {c === 'todas' ? 'Todas' : c}
              </button>
            ))}
          </div>

          {error && !piezas && <ErrorCarga className="mt-8" onReintentar={recargar} />}
          {!piezas && !error && <CargandoBloque className="mt-8 h-96" />}
          {piezas && piezas.length === 0 && (
            <div className="mt-8 rounded-suave border border-dashed border-cafe/20 bg-crema p-8">
              <p className="text-cuerpo text-cafe/80">Estamos preparando el catálogo de piezas. Escríbenos y te contamos qué hay disponible.</p>
              <CtaWhatsapp mensaje={mensajePintaTuPieza()} className="mt-6">Preguntar por WhatsApp</CtaWhatsapp>
            </div>
          )}
          {piezas && piezas.length > 0 && (
            <>
              <ul className="mt-8 grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4">
                {visibles.map((p) => (
                  <li key={p.id}>
                    <TarjetaPieza
                      pieza={p}
                      accion={
                        <BotonEnlace to={`${RESERVAR}?pieza=${p.id}`} variante="secundario" tamano="chico" className="w-full whitespace-nowrap px-2">
                          <span className="sm:hidden">Pintarla</span>
                          <span className="hidden sm:inline">Pintar esta pieza</span>
                        </BotonEnlace>
                      }
                    />
                  </li>
                ))}
              </ul>
              {lista.length > CANTIDAD_INICIAL && (
                <div className="mt-10 flex justify-center">
                  <button type="button" onClick={() => setTodas((v) => !v)} className={clasesBoton('secundario')} aria-expanded={todas}>
                    {todas ? 'Ver menos piezas' : `Ver las ${lista.length} piezas`}
                  </button>
                </div>
              )}
            </>
          )}
          <Pendiente className="mt-10">
            Precio, tamaño, acabado y existencias de cada pieza. Los nombres salen de las fotos; los precios marcados
            «de ejemplo» son solo para recorrer la demo.
          </Pendiente>
        </div>
      </section>

      {/* 05 · Horarios -------------------------------------------------------- */}
      <section className="contenedor py-seccion" aria-labelledby="p-horarios">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <SectionHeading numero="05" eyebrow="Horarios" titulo={<span id="p-horarios">Ven cuando te quede mejor.</span>} tamano="t2" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
            {PINTA.horario.map((d, i) => (
              <Revelar key={d.dia} como="li" retraso={i * 0.05} className="rounded-suave border border-cafe/15 p-6">
                <p className="eyebrow text-cafe/60">{d.dia}</p>
                <p className="mt-3 font-display text-t4 font-light">
                  {d.horarios.map((h) => (h.fin ? rango(h.inicio, h.fin) : hora(h.inicio))).join(' · ')}
                </p>
              </Revelar>
            ))}
          </ul>
        </div>
      </section>

      {/* 06 · Galería (inspiración: no es el catálogo) -------------------------- */}
      <section className="contenedor pb-seccion" aria-labelledby="p-galeria">
        <SectionHeading numero="06" eyebrow="Inspiración" titulo={<span id="p-galeria">Una pieza en blanco, mil maneras de hacerla tuya.</span>} tamano="t2" />
        <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
          <Revelar className="col-span-2 md:col-span-7">
            <Foto foto={GALERIA_PINTA[1]} className="aspect-[3/2] w-full rounded-foto" sizes="(min-width:768px) 56vw, 100vw" zoom />
          </Revelar>
          <Revelar retraso={0.08} className="md:col-span-5">
            <Foto id="taller-tardes-ninos" className="aspect-[4/5] w-full rounded-u md:aspect-auto md:h-full" sizes="(min-width:768px) 38vw, 50vw" zoom />
          </Revelar>
          <Revelar retraso={0.04} className="md:col-span-3">
            <Foto foto={GALERIA_PINTA[3]} className="aspect-[4/5] w-full rounded-foto" sizes="(min-width:768px) 22vw, 50vw" zoom />
          </Revelar>
          <Revelar retraso={0.08} className="md:col-span-3 md:mt-16">
            <Foto foto={GALERIA_PINTA[4]} className="aspect-[4/5] w-full rounded-arco" sizes="(min-width:768px) 22vw, 50vw" zoom />
          </Revelar>
          <Revelar retraso={0.12} className="md:col-span-3">
            <Foto foto={GALERIA_PINTA[5]} className="aspect-[4/5] w-full rounded-foto" sizes="(min-width:768px) 22vw, 50vw" zoom />
          </Revelar>
          <Revelar retraso={0.16} className="md:col-span-3 md:mt-16">
            <Foto foto={GALERIA_PINTA[6]} className="aspect-[4/5] w-full rounded-u" sizes="(min-width:768px) 22vw, 50vw" zoom />
          </Revelar>
        </div>
      </section>

      {/* Cierre --------------------------------------------------------------- */}
      <section className="bg-amarillo/30 py-seccion-s" aria-labelledby="p-cierre">
        <div className="contenedor flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p id="p-cierre" className="max-w-[24ch] font-display text-t2 font-light">Elige una pieza, juega con el color y hazla tuya.</p>
            <p className="mt-4 text-nota text-cafe/75">Piezas desde {pesosCortos(PINTA.precioDesde)} · reservas con el {PORCENTAJE_ANTICIPO} % del valor de tu pieza.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BotonEnlace to={RESERVAR} flecha>Reservar mi lugar</BotonEnlace>
            <CtaWhatsapp mensaje={mensajePintaTuPieza()} variante="secundario">¿Dudas? Escríbenos</CtaWhatsapp>
          </div>
        </div>
        <div className="contenedor">
          <Pendiente className="mt-8">Tiempo de entrega de las piezas pintadas y política de cancelación de Pinta tu pieza.</Pendiente>
        </div>
      </section>

      <CtaFijaMovil />
    </>
  );
}

/**
 * En el celular, «Reservar mi lugar» siempre a la mano una vez que se deja
 * atrás el hero. Sin monto: el anticipo depende de la pieza que se elija.
 */
function CtaFijaMovil() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Después del hero y antes del cierre (que ya tiene su botón y el pie de página).
    const revisar = () =>
      setVisible(window.scrollY > 520 && window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 900);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);
  if (!visible) return null;
  return (
    <m.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: EASE_NUMA }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cafe/15 bg-crema/[0.97] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:hidden"
      data-cta-fija
    >
      <div className="flex items-center gap-4">
        <p className="min-w-0 flex-1 text-[0.74rem] leading-snug text-cafe/75">
          Piezas desde {pesosCortos(PINTA.precioDesde)}
          <span className="block">Reservas con el {PORCENTAJE_ANTICIPO} % de tu pieza</span>
        </p>
        <BotonEnlace to={RESERVAR} className="shrink-0 whitespace-nowrap" tamano="chico" flecha>
          Reservar mi lugar
        </BotonEnlace>
      </div>
    </m.div>
  );
}
