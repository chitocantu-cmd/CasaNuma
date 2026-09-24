import SectionHeading from '../componentes/SectionHeading';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { BotonEnlace } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import CeramicShape from '../componentes/marca/CeramicShape';
import { MEMBRESIA } from '../contenido/oferta';
import { rango } from '../lib/calendario';
import { pesosCortos } from '../lib/formato';
import { useSeo } from '../lib/seo';

// Texto: documento de contenido, sección 3 ("texto final").

export default function Membresia() {
  useSeo({
    titulo: 'Membresía de Cerámica | Casa Numa',
    descripcion:
      'Cuatro clases de tres horas al mes, arcilla, materiales, vidriado y horneado incluidos. Membresía de cerámica en San Pedro Garza García por $3,200 MXN al mes.',
  });

  return (
    <>
      {/* Portada ---------------------------------------------------------- */}
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <Revelar>
          <p className="eyebrow flex items-center gap-3 text-cafe/70">
            <CeramicShape nombre="guaje" className="h-5 w-auto" />
            Membresía NUMA
          </p>
        </Revelar>
        <Revelar retraso={0.05} className="mt-8">
          <Foto id="membresia-hero" prioridad className="aspect-[4/3] w-full rounded-suave sm:aspect-[16/9] lg:aspect-[21/9]" sizes="100vw" />
        </Revelar>

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <Revelar className="lg:col-span-6">
            <h1 className="font-display text-t1 font-light">Haz de la cerámica parte de tu rutina.</h1>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <BotonEnlace to="/membresia/reservar" flecha>Quiero mi membresía</BotonEnlace>
              <p className="text-nota text-cafe/75">
                <span className="cifra text-[1.5rem] text-cafe">{pesosCortos(MEMBRESIA.precio)}</span> al mes
              </p>
            </div>
          </Revelar>
          <Revelar retraso={0.1} className="space-y-5 text-cuerpo-l text-cafe/85 lg:col-span-5 lg:col-start-8">
            <p>
              Un espacio para desconectarte de la rutina, explorar tu creatividad y descubrir todo lo que puedes crear con
              tus propias manos.
            </p>
            <p>
              Nuestra membresía está diseñada para que aprendas nuevas técnicas de cerámica, experimentes con el barro y
              desarrolles tus propios proyectos a tu ritmo.
            </p>
            <p>
              No necesitas experiencia previa. En Casa Numa te acompañamos durante todo el proceso, desde tu primera pieza
              hasta tus creaciones más ambiciosas.
            </p>
          </Revelar>
        </div>
      </section>

      {/* Qué incluye --------------------------------------------------------- */}
      <section className="contenedor py-seccion" aria-labelledby="t-incluye">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <SectionHeading numero="01" eyebrow="Incluye" titulo={<span id="t-incluye">¿Qué incluye tu membresía?</span>} tamano="t2" />
              <Revelar retraso={0.1} className="mt-10 hidden lg:block">
                <p className="cifra text-cifra leading-none text-terracota">12 h</p>
                <p className="mt-2 text-nota text-cafe/70">de cerámica al mes</p>
              </Revelar>
            </div>
          </div>
          <ul className="border-t border-cafe/15 lg:col-span-7 lg:col-start-6">
            {MEMBRESIA.incluye.map((i, n) => {
              const Pictograma = Icono[i.icono];
              return (
                <Revelar
                  key={i.titulo}
                  como="li"
                  retraso={Math.min(n, 4) * 0.04}
                  className="grid grid-cols-[3rem_1fr] gap-x-5 border-b border-cafe/15 py-7 sm:grid-cols-[3.5rem_1fr_auto]"
                >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracota/[0.14] text-cafe">
                      <Pictograma tam={24} />
                    </span>
                    <div>
                      <h3 className="font-display text-t4 font-light">{i.titulo}</h3>
                      <p className="mt-1.5 max-w-[46ch] text-cuerpo text-cafe/75">{i.texto}</p>
                    </div>
                    <span className="cifra hidden text-[1rem] text-cafe/35 sm:block">{String(n + 1).padStart(2, '0')}</span>
                </Revelar>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Tú decides ------------------------------------------------------------ */}
      <section className="bg-cafe/[0.035] py-seccion" aria-labelledby="t-decides">
        <div className="contenedor">
          <SectionHeading numero="02" eyebrow="Tus proyectos" titulo={<span id="t-decides">Tú decides qué quieres crear.</span>} tamano="t2" />
          <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-8">
            <Revelar>
              <Foto id="membresia-proyecto-clase" className="aspect-[4/3.4] w-full rounded-suave" sizes="(min-width:768px) 45vw, 100vw" zoom />
              <p className="cifra mt-7 text-[1rem] text-cafe/55">4 clases · 4 piezas</p>
              <h3 className="mt-2 font-display text-t3 font-light">Un proyecto por clase</h3>
              <p className="mt-3 max-w-[44ch] text-cuerpo text-cafe/80">
                Crea una pieza diferente en cada sesión y explora distintas formas, técnicas y acabados.
              </p>
            </Revelar>
            <Revelar retraso={0.1} className="md:mt-24">
              <Foto id="membresia-gran-formato" className="aspect-[4/3.4] w-full rounded-arco" sizes="(min-width:768px) 45vw, 100vw" zoom />
              <p className="cifra mt-7 text-[1rem] text-cafe/55">4 clases · 1 pieza</p>
              <h3 className="mt-2 font-display text-t3 font-light">Un proyecto de gran formato</h3>
              <p className="mt-3 max-w-[44ch] text-cuerpo text-cafe/80">
                Dedica tus cuatro clases a desarrollar una pieza de mayor tamaño, trabajando cada detalle a tu ritmo.
              </p>
            </Revelar>
          </div>
          <Revelar className="mt-14 flex items-center gap-3 text-nota text-cafe/75">
            <Icono.arcilla tam={20} className="text-terracota" />
            Los proyectos se realizan con la arcilla incluida en la membresía.
          </Revelar>
        </div>
      </section>

      {/* Horarios --------------------------------------------------------------- */}
      <section className="contenedor py-seccion" aria-labelledby="t-horarios">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <SectionHeading numero="03" eyebrow="Horarios" titulo={<span id="t-horarios">Elige tus horarios.</span>} tamano="t2" />
            <Revelar retraso={0.1}>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85">
                Puedes distribuir tus cuatro clases mensuales entre viernes, sábados y domingos, según la disponibilidad de
                lugares en cada sesión. No es necesario asistir siempre el mismo día de la semana.
              </p>
            </Revelar>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {MEMBRESIA.horarios.map((h, i) => (
              <Revelar key={h.dia} retraso={i * 0.06}>
                <div className={`flex h-full flex-col justify-between rounded-suave border border-cafe/15 p-6 ${i === 1 ? 'sm:mt-10' : ''}`}>
                  <p className="cifra text-[2.6rem] leading-none tracking-[0.02em]">{h.dia}</p>
                  <p className="mt-10 text-cuerpo text-cafe/85">{rango(h.inicio, h.fin)}</p>
                  <p className="mt-1 text-[0.74rem] text-cafe/55">3 horas</p>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      {/* Inversión --------------------------------------------------------------- */}
      <section className="contenedor pb-seccion" aria-labelledby="t-inversion">
        <Revelar>
          <div data-fondo="oscuro" className="relative grid gap-12 overflow-hidden rounded-suave bg-cafe p-8 text-crema sm:p-14 lg:grid-cols-12 lg:gap-8">
            <CeramicShape nombre="botellon" className="pointer-events-none absolute -bottom-24 right-8 h-44 w-auto sm:h-52" />
            <div className="relative lg:col-span-6">
              <p className="eyebrow flex items-center gap-4 text-crema/70">
                <span className="cifra text-[1.35rem] leading-none">04</span>
                <span className="h-px w-10 bg-crema/40" aria-hidden="true" />
                Inversión mensual
              </p>
              <h2 id="t-inversion" className="mt-8">
                <span className="cifra block text-[clamp(4rem,11vw,8.5rem)] leading-[0.85]">{pesosCortos(MEMBRESIA.precio)}</span>
                <span className="mt-3 block font-display text-t3 font-light text-crema/85">al mes</span>
              </h2>
              <p className="mt-8 max-w-[40ch] text-cuerpo text-crema/80">
                El pago se realiza al iniciar la membresía; se aceptan todas las formas de pago.
              </p>
              <div className="mt-10">
                <BotonEnlace to="/membresia/reservar" variante="claro" flecha>Quiero mi membresía</BotonEnlace>
              </div>
            </div>
            <div className="relative lg:col-span-5 lg:col-start-8">
              <p className="eyebrow text-crema/60">Incluye</p>
              <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
                {MEMBRESIA.incluyeCorto.map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-cuerpo text-crema/90">
                    <Icono.check tam={16} className="mt-1 shrink-0 text-amarillo" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Revelar>
        <Pendiente className="mt-6">
          Reglas de reprogramación, vigencia de las clases no usadas y cupo por sesión (el documento pide confirmarlas con
          Casa Numa antes de implementarlas). ¿La sesión del sábado 11:00 comparte espacio con los talleres de fin de
          semana de la misma hora?
        </Pendiente>
      </section>
    </>
  );
}
