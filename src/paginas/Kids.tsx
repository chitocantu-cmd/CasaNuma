import { Link } from 'react-router-dom';
import SectionHeading from '../componentes/SectionHeading';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { BotonEnlace } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import CeramicShape from '../componentes/marca/CeramicShape';
import { sinLugar, textoLugares } from '../lib/cupo';
import { KIDS } from '../contenido/oferta';
import { useSesionesKids } from '../datos/hooks';
import { duracionTexto, fechaCompacta, hora } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { useSeo } from '../lib/seo';

// Texto: documento de contenido, sección 4.

const DATOS = [
  { k: 'Edad', v: `A partir de ${KIDS.edadMinima} años` },
  { k: 'Modalidad', v: 'Taller individual por sesión, no membresía' },
  { k: 'Horario', v: `${KIDS.dia} · ${hora(KIDS.inicio)}` },
  { k: 'Duración', v: duracionTexto(KIDS.duracionMin) },
];

export default function Kids() {
  useSeo({
    titulo: 'NUMA Kids | Talleres de Cerámica para Niños',
    descripcion:
      'Talleres de cerámica para niñas y niños a partir de 7 años. Jueves a las 5:00 p.m., 90 minutos, $680 MXN por sesión con materiales, vidriado y horneado incluidos.',
  });
  const { datos: sesiones } = useSesionesKids();
  const proximas = (sesiones ?? []).slice(0, 4);

  return (
    <>
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-6">
            <SectionHeading
              como="h1"
              eyebrow="NUMA Kids"
              silueta="tarro"
              titulo="Pequeñas manos, grandes creaciones."
            />
            <Revelar retraso={0.1}>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85">
                En NUMA Kids creemos que las mejores ideas nacen de la imaginación. Nuestros talleres infantiles son un
                espacio para que los niños experimenten con el barro, descubran nuevas formas de expresarse y creen piezas
                únicas con sus propias manos.
              </p>
              <p className="mt-5 max-w-lectura text-cuerpo-l text-cafe/85">
                Aquí pueden ensuciarse, explorar, aprender y divertirse mientras transforman sus ideas en cerámica. No
                necesitan experiencia previa, ¡solo muchas ganas de crear!
              </p>
            </Revelar>
          </div>
          <Revelar retraso={0.1} className="relative lg:col-span-5 lg:col-start-8">
            <Foto id="kids-hero" prioridad className="aspect-[4/5] w-full rounded-u" sizes="(min-width:1024px) 38vw, 100vw" />
            <CeramicShape nombre="olla" className="absolute -left-5 top-10 h-16 w-auto" />
            <CeramicShape nombre="botellon" className="absolute -right-3 bottom-16 h-14 w-auto" />
          </Revelar>
        </div>
      </section>

      {/* Datos clave + precio -------------------------------------------------- */}
      <section className="contenedor py-seccion-s">
        <Revelar>
          <div className="grid overflow-hidden rounded-suave border border-cafe/15 lg:grid-cols-12">
            <dl className="grid grid-cols-2 lg:col-span-8 lg:grid-cols-4">
              {DATOS.map((d, i) => (
                <div key={d.k} className={`border-cafe/15 p-6 sm:p-7 ${i % 2 === 1 ? 'border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} lg:border-l lg:first:border-l-0`}>
                  <dt className="eyebrow text-[0.6rem] text-cafe/60">{d.k}</dt>
                  <dd className="mt-3 text-cuerpo text-cafe">{d.v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col justify-between gap-6 bg-amarillo/25 p-6 sm:p-7 lg:col-span-4">
              <p>
                <span className="cifra block text-[3.2rem] leading-none">{pesosCortos(KIDS.precio)}</span>
                <span className="mt-2 block text-nota text-cafe/80">por niño y por sesión</span>
              </p>
              <BotonEnlace to="/numa-kids/reservar" flecha className="self-start">Reservar taller infantil</BotonEnlace>
            </div>
          </div>
        </Revelar>
      </section>

      {/* Incluye ----------------------------------------------------------------- */}
      <section className="contenedor py-seccion-s" aria-labelledby="k-incluye">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <SectionHeading numero="01" eyebrow="Incluye" titulo={<span id="k-incluye">¿Qué incluye cada taller?</span>} tamano="t2" />
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-7 lg:col-start-6">
            {KIDS.incluye.map((i, n) => {
              const P = Icono[i.icono];
              return (
                <Revelar key={i.titulo} como="li" retraso={n * 0.05} className="flex flex-col items-start gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-verde/25 text-cafe">
                    <P tam={26} />
                  </span>
                  <span className="font-display text-t4 font-light">{i.titulo}</span>
                </Revelar>
              );
            })}
          </ul>
        </div>
        <Revelar className="mt-16 flex max-w-2xl gap-4 rounded-suave bg-cafe/[0.04] p-6">
          <Icono.horno tam={24} className="shrink-0 text-terracota" />
          <p className="text-cuerpo text-cafe/85">
            Las piezas requieren secado, horneado y acabado, por lo que no se entregan el mismo día del taller.
          </p>
        </Revelar>
        <Pendiente className="mt-4 max-w-2xl">Plazo estimado de entrega de las piezas y cupo por sesión.</Pendiente>
      </section>

      {/* Próximos jueves ----------------------------------------------------------- */}
      <section className="bg-cafe/[0.035] py-seccion" aria-labelledby="k-fechas">
        <div className="contenedor">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <SectionHeading numero="02" eyebrow="Próximos jueves" titulo={<span id="k-fechas">Elige su próximo taller.</span>} tamano="t2" />
            <Revelar retraso={0.1}>
              <BotonEnlace to="/numa-kids/reservar" variante="secundario" flecha>Ver todas las fechas</BotonEnlace>
            </Revelar>
          </div>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proximas.map((s, i) => {
              const lleno = sinLugar(s);
              return (
                <Revelar key={s.id} como="li" retraso={i * 0.05}>
                  <Link
                    to={lleno ? '/numa-kids/reservar' : `/numa-kids/reservar?sesion=${s.id}`}
                    aria-disabled={lleno}
                    className={`group flex h-full flex-col justify-between gap-8 rounded-suave border p-6 transition-colors ${
                      lleno ? 'border-cafe/10 text-cafe/45' : 'border-cafe/15 bg-crema hover:border-cafe'
                    }`}
                  >
                    <span className={`cifra text-[2.2rem] leading-none capitalize ${lleno ? 'line-through' : ''}`}>{fechaCompacta(s.fecha)}</span>
                    <span className="flex items-center justify-between text-nota">
                      <span>{hora(s.inicio)} · {textoLugares(s)}</span>
                      {!lleno && <Icono.flecha tam={17} className="transition-transform group-hover:translate-x-1" />}
                    </span>
                  </Link>
                </Revelar>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
