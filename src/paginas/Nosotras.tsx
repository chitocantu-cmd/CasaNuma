import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { BotonEnlace } from '../componentes/base/Boton';
import { Pendiente } from '../componentes/base/Pendiente';
import CeramicShape from '../componentes/marca/CeramicShape';
import { IconoU } from '../componentes/marca/Logo';
import type { IdFoto } from '../contenido/fotos';
import type { NombreSilueta } from '../componentes/marca/trazos';
import { useSeo } from '../lib/seo';

// Texto: documento de contenido, sección 8. Pendiente revisarlo con Mónica y Gloria.

const FUNDADORAS: { nombre: string; rol: string; bio: string; foto: IdFoto; silueta: NombreSilueta }[] = [
  {
    nombre: 'Mónica',
    rol: 'Artista ceramista y diseñadora industrial',
    bio: 'Con más de siete años de experiencia, Mónica ha encontrado en la cerámica una forma de transformar sus ideas en piezas que cuentan historias. Su trabajo abarca desde murales y piezas de gran formato hasta creaciones inspiradas en el arte y las raíces culturales de México. Le apasionan las formas, texturas y símbolos de nuestras culturas ancestrales, especialmente el arte maya y las piezas arqueológicas que reflejan la riqueza de nuestra historia. Su amor por el diseño y la cerámica se refleja en cada proyecto y en su manera de enseñar.',
    foto: 'retrato-monica',
    silueta: 'anfora',
  },
  {
    nombre: 'Gloria',
    rol: 'Creatividad, ideas y experiencias',
    bio: 'Gloria aporta la visión creativa detrás de las experiencias y de la manera en que Casa Numa conecta con las personas. Su pasión está en imaginar nuevas posibilidades, transformar ideas en proyectos y crear experiencias que hagan que cada persona se sienta bienvenida desde el momento en que entra al estudio. Para ella, Casa Numa es mucho más que un taller de cerámica: es un espacio para compartir, conectar con otros y disfrutar de esos momentos en los que dejamos de lado la rutina para hacer algo simplemente porque nos hace felices.',
    foto: 'retrato-gloria',
    silueta: 'jarron',
  },
];

export default function Nosotras() {
  useSeo({
    titulo: 'Nosotras | Casa Numa',
    descripcion:
      'Casa Numa nació del sueño de Mónica y Gloria: un espacio propio para crear, experimentar y compartir la cerámica en San Pedro Garza García.',
  });

  return (
    <>
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <Revelar>
          <p className="eyebrow flex items-center gap-3 text-cafe/70">
            <IconoU className="h-4 w-auto text-terracota" /> Nosotras
          </p>
          <h1 className="mt-7 max-w-[20ch] font-display text-t1 font-light">
            Todo comenzó con dos personas y un <em className="italic text-terracota">mismo sueño.</em>
          </h1>
        </Revelar>

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-8">
          <Revelar className="lg:col-span-7">
            <Foto id="nosotras-hero" prioridad className="aspect-[4/3] w-full rounded-suave" sizes="(min-width:1024px) 55vw, 100vw" />
          </Revelar>
          <Revelar retraso={0.1} className="space-y-5 text-cuerpo-l text-cafe/85 lg:col-span-4 lg:col-start-9 lg:pt-24">
            <p className="font-display text-t4 font-light text-cafe">
              Tener un espacio propio donde pudiéramos crear, experimentar y hacer lo que más nos gusta: cerámica. Así
              nació Casa Numa.
            </p>
            <p>
              Lo que comenzó como el deseo de tener nuestro propio taller se convirtió en algo mucho más grande: un lugar
              donde podemos compartir nuestra pasión, enseñar lo que sabemos y recibir a personas que, como nosotras,
              encuentran en el arte una forma de expresarse.
            </p>
            <p>
              Hoy, Casa Numa es nuestro espacio creativo, pero también es un poquito de cada persona que llega, se sienta
              frente al barro y descubre que es capaz de crear algo con sus propias manos.
            </p>
          </Revelar>
        </div>
      </section>

      {/* Mónica y Gloria */}
      <section className="contenedor py-seccion" aria-label="Quiénes somos">
        <div className="space-y-seccion-s">
          {FUNDADORAS.map((f, i) => (
            <article key={f.nombre} className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8">
              <Revelar className={`relative lg:col-span-5 ${i % 2 === 1 ? 'lg:order-2 lg:col-start-8' : ''}`}>
                <div className="relative mx-auto w-[82%] sm:w-[70%] lg:w-full">
                  <div className="absolute -inset-3 rounded-arco border border-terracota/45" aria-hidden="true" />
                  <Foto id={f.foto} className="aspect-[4/5.2] w-full rounded-arco" sizes="(min-width:1024px) 36vw, 80vw" />
                  <CeramicShape nombre={f.silueta} className={`absolute -bottom-6 h-16 w-auto ${i % 2 === 1 ? '-left-4' : '-right-4'}`} />
                </div>
              </Revelar>
              <Revelar retraso={0.1} className={`lg:col-span-6 ${i % 2 === 1 ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-7'}`}>
                <p className="cifra text-[1.2rem] text-cafe/50">{String(i + 1).padStart(2, '0')}</p>
                <h2 className="mt-3 font-display text-[clamp(3rem,7vw,6rem)] font-light leading-none">{f.nombre}</h2>
                <p className="eyebrow mt-5 text-cafe/70">{f.rol}</p>
                <p className="mt-8 max-w-[52ch] text-cuerpo-l text-cafe/85">{f.bio}</p>
              </Revelar>
            </article>
          ))}
        </div>
        <Pendiente className="mt-16">Revisar con Mónica y Gloria la redacción biográfica antes de publicar, y sus fotografías reales.</Pendiente>
      </section>

      {/* Cierre */}
      <section data-fondo="oscuro" className="relative overflow-hidden bg-cafe py-seccion text-crema" aria-labelledby="n-favorita">
        <IconoU className="pointer-events-none absolute -left-24 top-1/2 h-[40rem] w-auto -translate-y-1/2 text-crema/[0.06]" />
        <div className="contenedor relative grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <Revelar>
              <h2 id="n-favorita" className="font-display text-t1 font-light">
                Nuestra parte favorita de NUMA <em className="italic text-amarillo">eres tú.</em>
              </h2>
            </Revelar>
            <Revelar retraso={0.1} className="mt-10 space-y-5 text-cuerpo-l text-crema/85">
              <p>
                Amamos crear, pero hay algo que disfrutamos todavía más: compartir nuestro espacio con ustedes. Nos encanta
                recibir a quienes llegan por primera vez sin saber qué hacer con un pedazo de barro, ver cómo descubren
                nuevas habilidades y acompañarlos hasta que tienen su propia pieza entre las manos.
              </p>
              <p>
                Amamos las conversaciones alrededor de una mesa, las risas durante una clase y esa emoción de ver una pieza
                terminada después de haberla creado desde cero.
              </p>
              <p>
                Porque para nosotras, Casa Numa no se trata solamente de hacer cerámica. Se trata de crear un espacio donde
                puedas sentirte libre de experimentar, equivocarte, aprender y disfrutar de cada momento.
              </p>
            </Revelar>
          </div>
          <Revelar retraso={0.15} className="lg:col-span-5 lg:col-start-8">
            <Foto id="nosotras-comunidad" className="aspect-[4/5] w-full rounded-u" sizes="(min-width:1024px) 38vw, 100vw" />
          </Revelar>
        </div>
        <Revelar className="contenedor relative mt-seccion-s text-center">
          <p className="font-display text-t2 font-light italic">Bienvenido a nuestra casa.</p>
          <p className="mt-2 font-display text-t2 font-light">Bienvenido a Casa Numa.</p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <BotonEnlace to="/talleres" variante="claro" flecha>Ver talleres</BotonEnlace>
            <BotonEnlace to="/membresia" variante="contorno-claro">Conocer la membresía</BotonEnlace>
          </div>
        </Revelar>
      </section>
    </>
  );
}
