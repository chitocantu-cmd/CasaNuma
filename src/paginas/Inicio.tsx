import Hero from '../componentes/Hero';
import SectionHeading from '../componentes/SectionHeading';
import EditorialGallery from '../componentes/EditorialGallery';
import ExperienceCard from '../componentes/ExperienceCard';
import ProductCard from '../componentes/ProductCard';
import WorkshopCard from '../componentes/WorkshopCard';
import Testimonial from '../componentes/Testimonial';
import Ubicacion from '../componentes/secciones/Ubicacion';
import Comunidad from '../componentes/secciones/Comunidad';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { BotonEnlace, EnlaceFlecha } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import CeramicShape from '../componentes/marca/CeramicShape';
import { PORTAFOLIO } from '../contenido/portafolio';
import { TESTIMONIOS } from '../contenido/testimonios';
import { MEMBRESIA, KIDS } from '../contenido/oferta';
import { mostrarPendientes } from '../config/site';
import { useProductos, useTalleres } from '../datos/hooks';
import { pesosCortos } from '../lib/formato';
import { MESES } from '../lib/calendario';
import { esProximo } from '../lib/talleres';
import { ldNegocio, useSeo } from '../lib/seo';

const OCASIONES = ['Cumpleaños', 'Baby shower', 'Despedidas', 'Tardes entre amigas', 'Eventos empresariales', 'Reuniones privadas'];

export default function Inicio() {
  useSeo({
    titulo: 'Casa Numa | Taller de cerámica en San Pedro Garza García',
    descripcion:
      'Estudio de cerámica en el Casco de San Pedro Garza García. Talleres de fin de semana, membresía, NUMA Kids, eventos privados y piezas hechas a mano.',
    jsonLd: ldNegocio(),
  });

  const { datos: productos } = useProductos();
  const { datos: talleres } = useTalleres();
  const hayTestimonios = TESTIMONIOS.length > 0 || mostrarPendientes;
  // Los próximos tres de la agenda; el mes del título sale del primero.
  const agenda = (talleres ?? []).filter(esProximo).slice(0, 3);
  const mesAgenda = agenda[0] ? MESES[Number(agenda[0].sesiones[0].fecha.slice(5, 7)) - 1] : null;

  // Numeración editorial de las secciones: se calcula en orden de aparición
  // para que no se descuadre cuando una sección se oculta.
  let seccion = 0;
  const n = () => String(++seccion).padStart(2, '0');

  return (
    <>
      <Hero />

      {/* Portafolio ------------------------------------------------ */}
      <section id="portafolio" className="contenedor py-seccion" aria-label="Portafolio NUMA">
        <EditorialGallery
          piezas={PORTAFOLIO}
          encabezado={
            <SectionHeading
              numero={n()}
              eyebrow="Portafolio NUMA"
              titulo="Hecho a mano, hecho con intención."
              intro={
                <p>
                  Descubre las piezas que nacen en nuestro estudio. Cada forma, textura y detalle refleja nuestra pasión por
                  la cerámica y el valor de crear con nuestras propias manos.
                </p>
              }
            />
          }
          nota={
            <Revelar className="border-l border-cafe/20 pl-6">
              <CeramicShape nombre="olla" className="h-10 w-auto" />
              <p className="mt-5 max-w-[30ch] text-nota text-cafe/75">
                El portafolio es inspiración. Las piezas disponibles y los encargos viven en NUMA Store.
              </p>
              <EnlaceFlecha to="/numa-store" className="mt-5">Ir a NUMA Store</EnlaceFlecha>
            </Revelar>
          }
        />
      </section>

      {/* Experiencias ---------------------------------------------- */}
      <section className="py-seccion-s" aria-labelledby="titulo-experiencias">
        <div className="contenedor flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            numero={n()}
            eyebrow="Experiencias"
            titulo={<span id="titulo-experiencias">Encuentra tu forma de crear.</span>}
          />
          <Revelar retraso={0.1} className="max-w-[26rem] lg:pb-3">
            <p className="flex gap-3 text-nota text-cafe/75">
              <Icono.candado tam={18} className="mt-0.5 shrink-0 text-terracota" />
              Talleres de fin de semana, membresía y NUMA Kids se reservan y pagan en línea.
            </p>
          </Revelar>
        </div>

        {/* Móvil: carril táctil. Escritorio: tres columnas, la central desfasada. */}
        <div className="carril mt-14 flex gap-5 overflow-x-auto px-canal pb-4 lg:contenedor lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible">
          <div className="w-[82vw] max-w-[24rem] shrink-0 lg:w-auto lg:max-w-none">
            <Revelar className="h-full">
              <ExperienceCard
                numero="01" titulo="Clases de fin de semana"
                frase="Cada fin de semana, una nueva experiencia para crear con tus manos."
                detalle="Reserva en línea" cta="Ver agenda" to="/talleres" foto="exp-talleres" silueta="taza"
              />
            </Revelar>
          </div>
          <div className="w-[82vw] max-w-[24rem] shrink-0 lg:mt-24 lg:w-auto lg:max-w-none">
            <Revelar retraso={0.08} className="h-full">
              <ExperienceCard
                numero="02" titulo="Membresía NUMA"
                frase="Haz de la cerámica parte de tu rutina."
                detalle={`${pesosCortos(MEMBRESIA.precio)} al mes`} cta="Conocer membresía" to="/membresia"
                foto="exp-membresia" silueta="guaje" forma="rounded-arco"
              />
            </Revelar>
          </div>
          <div className="w-[82vw] max-w-[24rem] shrink-0 lg:w-auto lg:max-w-none">
            <Revelar retraso={0.16} className="h-full">
              <ExperienceCard
                numero="03" titulo="NUMA Kids"
                frase="Pequeñas manos, grandes creaciones."
                detalle={`A partir de ${KIDS.edadMinima} años`} cta="Ver talleres infantiles" to="/numa-kids"
                foto="exp-kids" silueta="tarro"
              />
            </Revelar>
          </div>
        </div>
      </section>

      {/* Agenda: solo lo próximo, la agenda completa vive en /talleres -------- */}
      {agenda.length > 0 && mesAgenda && (
        <section className="contenedor pt-seccion" aria-labelledby="titulo-agenda">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              numero={n()}
              eyebrow="Agenda"
              titulo={<span id="titulo-agenda">Este {mesAgenda} en NUMA.</span>}
              tamano="t2"
            />
            <Revelar retraso={0.1} className="shrink-0 lg:pb-3">
              <BotonEnlace to="/talleres" variante="secundario" flecha>Ver agenda completa</BotonEnlace>
            </Revelar>
          </div>
          <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {agenda.map((t, i) => (
              <Revelar key={t.id} retraso={i * 0.06} className="h-full">
                <WorkshopCard taller={t} compacta />
              </Revelar>
            ))}
          </div>
        </section>
      )}

      {/* Eventos especiales -------------------------------------------------- */}
      <section data-fondo="oscuro" className="relative mt-seccion-s overflow-hidden bg-cafe py-seccion text-crema" aria-labelledby="titulo-eventos">
        <div className="contenedor grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5 lg:py-6">
            <SectionHeading
              numero={n()}
              eyebrow="Eventos especiales"
              titulo={<span id="titulo-eventos">Hay momentos que merecen celebrarse de una forma diferente.</span>}
              intro={
                <p>
                  En Casa Numa creamos experiencias privadas de cerámica para compartir, celebrar y crear recuerdos únicos.
                  Tú nos cuentas qué tienes en mente y nosotros te ayudamos a darle forma.
                </p>
              }
              claro
              tamano="t2"
            />
            <Revelar retraso={0.1}>
              <ul className="mt-10 flex flex-wrap gap-2">
                {OCASIONES.map((o) => (
                  <li key={o} className="rounded-full border border-crema/25 px-4 py-2 text-[0.8rem] text-crema/90">{o}</li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <BotonEnlace to="/eventos" variante="claro" flecha>Cotiza tu evento</BotonEnlace>
                <span className="flex items-center gap-2 text-[0.78rem] text-crema/70">
                  <Icono.whatsapp tam={16} /> Cotización personalizada por WhatsApp
                </span>
              </div>
            </Revelar>
          </div>
          <Revelar retraso={0.1} className="relative lg:col-span-6 lg:col-start-7">
            <Foto id="eventos-grupo" className="aspect-[4/5] w-full rounded-foto sm:aspect-[5/4] lg:aspect-[4/5]" sizes="(min-width:1024px) 45vw, 100vw" zoom />
            <CeramicShape nombre="doble" className="absolute -left-6 -top-8 h-16 w-auto sm:h-20" />
          </Revelar>
        </div>
      </section>

      {/* NUMA Store ------------------------------------------------ */}
      <section className="contenedor py-seccion" aria-labelledby="titulo-store">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            numero={n()}
            eyebrow="NUMA Store"
            titulo={<span id="titulo-store">Piezas únicas, hechas con nuestras manos.</span>}
            intro={
              <p>
                Descubre nuestra colección de cerámica artesanal: tazas, vajillas, objetos decorativos y creaciones
                especiales que combinan diseño, creatividad y el encanto de lo hecho a mano.
              </p>
            }
          />
          <Revelar retraso={0.1} className="shrink-0 lg:pb-3">
            <BotonEnlace to="/numa-store" variante="secundario" flecha>Explorar NUMA Store</BotonEnlace>
          </Revelar>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
          {(productos ?? []).slice(0, 4).map((p, i) => (
            <Revelar key={p.id} retraso={i * 0.06} className={i % 2 === 1 ? 'lg:mt-14' : ''}>
              <ProductCard producto={p} />
            </Revelar>
          ))}
        </div>

        <p className="mt-12 flex items-center gap-3 border-t border-cafe/15 pt-6 text-nota text-cafe/75">
          <Icono.whatsapp tam={18} className="shrink-0 text-terracota" />
          Compras y encargos se atienden por WhatsApp, directo con el estudio.
        </p>
      </section>

      {/* ¡Hola! Somos Casa Numa ------------------------------------ */}
      <section className="contenedor pb-seccion pt-seccion-s" aria-labelledby="titulo-hola">
        <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Revelar>
              <p className="eyebrow flex items-center gap-4 text-cafe/70">
                <span className="cifra text-[1.35rem] leading-none tracking-[0.04em]">{n()}</span>
                <span className="h-px w-10 bg-cafe/30" aria-hidden="true" />
                Nosotras
              </p>
              <h2 id="titulo-hola" className="mt-6 font-display font-light">
                <span className="block text-[clamp(4rem,11vw,9.5rem)] leading-[0.85] text-terracota">¡Hola!</span>
                <span className="mt-3 block text-t2 text-cafe">Somos Casa Numa.</span>
              </h2>
            </Revelar>
            <Revelar retraso={0.1}>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85">
                Un espacio donde las ideas toman forma y las manos cuentan historias. Nacimos del amor por la cerámica y de
                las ganas de compartir un lugar donde crear, aprender y disfrutar del proceso.
              </p>
              <p className="mt-5 max-w-lectura text-cuerpo-l text-cafe/85">
                Aquí creemos que no necesitas ser artista para hacer algo extraordinario. Solo necesitas curiosidad y ganas
                de ensuciarte las manos.
              </p>
              <div className="mt-10">
                <BotonEnlace to="/nosotras" flecha>Conoce nuestra historia</BotonEnlace>
              </div>
            </Revelar>
          </div>

          <div className="relative lg:col-span-6 lg:col-start-7">
            <Revelar className="ml-auto w-[80%] sm:w-[70%]">
              <Foto id="hola-estudio" className="aspect-[4/5] w-full rounded-u" sizes="(min-width:1024px) 34vw, 80vw" />
            </Revelar>
            <Revelar retraso={0.15} className="absolute -bottom-10 left-0 w-[55%] sm:w-[48%]">
              <Foto id="hola-fundadoras" className="aspect-[4/3] w-full rounded-foto ring-[6px] ring-crema" sizes="(min-width:1024px) 22vw, 55vw" />
              <p className="mt-4 font-display text-[1.35rem] font-light italic text-cafe/80">Mónica & Gloria</p>
            </Revelar>
            <CeramicShape nombre="jarron" className="absolute right-[4%] top-[-2.5rem] h-14 w-auto" />
          </div>
        </div>
      </section>

      {/* Testimonios ------------------------------------------------ */}
      {hayTestimonios && (
        <section className="border-y border-cafe/10 bg-cafe/[0.035] py-seccion" aria-labelledby="titulo-testimonios">
          <div className="contenedor">
            <SectionHeading
              numero={n()}
              eyebrow="Testimonios"
              titulo={<span id="titulo-testimonios">Lo que se vive en NUMA, se comparte.</span>}
              intro={
                <p>
                  Cada persona que llega a nuestro estudio crea algo diferente, pero todas se llevan mucho más que una pieza
                  de cerámica.
                </p>
              }
              tamano="t2"
            />
            <div className="mt-14">
              <Testimonial testimonios={TESTIMONIOS} />
            </div>
          </div>
        </section>
      )}

      {/* Ubicación y comunidad ---------------------------------- */}
      <Ubicacion numero={n()} />
      <Comunidad numero={n()} />
    </>
  );
}
