import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWorkshop, useTitulo } from '../features/workshops/hooks';
import { ETIQUETAS_CATEGORIA } from '../tipos';
import {
  fechaLarga, rangoHorario, duracion, pesos, textoCupo, estadoCupo,
} from '../lib/formato';
import { Boton, BotonEnlace, ImagenPendiente, ImagenTaller, Cargando, Aviso } from '../componentes/ui';
import ModalReserva from '../componentes/ModalReserva';

export default function TallerDetalle() {
  const { slug } = useParams<{ slug: string }>();
  const { datos: taller, cargando, error } = useWorkshop(slug);
  const [modalAbierto, setModalAbierto] = useState(false);

  useTitulo(taller?.title ?? 'Taller', taller?.short_description ?? undefined);

  if (cargando) return <Cargando texto="Cargando taller…" />;

  if (error || !taller) {
    return (
      <div className="contenedor flex min-h-[70vh] flex-col justify-center py-32 text-center">
        <p className="dato text-tinta/45">Taller no encontrado</p>
        <h1 className="titular mt-6">Esta fecha ya no está.</h1>
        <div className="mt-10 flex justify-center">
          <BotonEnlace to="/talleres">Ver todas las fechas</BotonEnlace>
        </div>
      </div>
    );
  }

  const estado = estadoCupo(taller.seats_available);
  const lleno = estado === 'lleno';
  const cotizable = taller.booking_mode === 'quote';

  return (
    <div className="pb-24">
      {/* Portada */}
      <section className="contenedor pt-32 sm:pt-40">
        <Link to="/talleres" className="dato text-tinta/45 transition-colors hover:text-terracota">
          ← Reservaciones
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="dato text-tinta/45">{ETIQUETAS_CATEGORIA[taller.category]}</p>
            <h1 className="titular mt-4">{taller.title}</h1>
            <p className="mt-6 max-w-[48ch] text-[1.05rem] leading-relaxed text-tinta/70">
              {taller.short_description}
            </p>
          </div>

          {/* Ficha de reserva */}
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="border border-tinta/15 bg-crema p-6">
              <dl className="space-y-3 text-[0.92rem]">
                <Dato k="Cuándo" v={fechaLarga(taller.date)} />
                <Dato k="Horario" v={rangoHorario(taller.start_time, taller.end_time)} />
                <Dato k="Duración" v={duracion(taller.start_time, taller.end_time)} />
                {taller.level && <Dato k="Nivel" v={taller.level} />}
                {taller.instructor && <Dato k="Imparte" v={taller.instructor} />}
              </dl>

              <div className="mt-6 flex items-baseline justify-between border-t border-tinta/15 pt-5">
                <span className="dato text-tinta/50">Precio</span>
                <span className="font-display text-[1.9rem] leading-none">
                  {pesos(taller.price, taller.currency)}
                </span>
              </div>

              <p className={`mt-4 dato ${lleno ? 'text-tinta/40' : estado === 'ultimos' ? 'text-terracota' : 'text-olivo'}`}>
                {textoCupo(taller.seats_available)}
              </p>

              {cotizable ? (
                <>
                  <BotonEnlace to="/contacto" className="mt-5 w-full">
                    Pedir cotización
                  </BotonEnlace>
                  <p className="mt-3 text-[0.8rem] leading-relaxed text-tinta/50">
                    Este taller se arma a la medida, así que el precio depende de lo
                    que quieras hacer. Escríbenos y lo vemos contigo.
                  </p>
                </>
              ) : (
                <>
                  <Boton
                    className="mt-5 w-full"
                    disabled={lleno}
                    onClick={() => setModalAbierto(true)}
                  >
                    {lleno ? 'Cupo lleno' : 'Reservar y pagar'}
                  </Boton>
                  {lleno && (
                    <p className="mt-3 text-[0.8rem] leading-relaxed text-tinta/50">
                      Escríbenos por WhatsApp para entrar a la lista de espera o
                      avisarte de la próxima fecha.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Imagen principal */}
      <section className="contenedor mt-14">
        <ImagenTaller
          src={taller.image_url}
          encuadre={`${taller.title.toLowerCase()}, ambiente del taller`}
          tono={taller.tono}
          alt={taller.title}
          className="aspect-[16/9] w-full"
        />
      </section>

      {/* Descripción */}
      <section className="contenedor mt-16 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {taller.description.map((parrafo, i) => (
            <p key={i} className="mb-5 text-[1.05rem] leading-relaxed text-tinta/75">
              {parrafo}
            </p>
          ))}
        </div>

        <div className="lg:col-span-4 lg:col-start-9">
          {taller.includes.length > 0 && (
            <>
              <h2 className="dato mb-4 border-b border-tinta/12 pb-3 text-tinta/45">Incluye</h2>
              <ul className="mb-10 space-y-2 text-[0.95rem] text-tinta/75">
                {taller.includes.map((i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-terracota">·</span>{i}
                  </li>
                ))}
              </ul>
            </>
          )}

          {taller.crearas.length > 0 && (
            <>
              <h2 className="dato mb-4 border-b border-tinta/12 pb-3 text-tinta/45">Crearás</h2>
              <ul className="space-y-2 text-[0.95rem] text-tinta/75">
                {taller.crearas.map((i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-terracota">·</span>{i}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Galería */}
      {taller.gallery.length > 0 && (
        <section className="contenedor mt-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {taller.gallery.map((_, i) => (
              <ImagenPendiente
                key={i}
                encuadre={`detalle ${i + 1} del taller`}
                tono={taller.tono}
                className="aspect-square w-full"
              />
            ))}
          </div>
        </section>
      )}

      {/* Preguntas */}
      {taller.faqs.length > 0 && (
        <section className="contenedor mt-20 max-w-3xl">
          <h2 className="font-display text-[2rem] leading-tight">Preguntas</h2>
          <dl className="mt-8">
            {taller.faqs.map((f) => (
              <div key={f.q} className="border-t border-tinta/12 py-5">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-2 leading-relaxed text-tinta/70">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!cotizable && (
        <section className="contenedor mt-16">
          {lleno ? (
            <Aviso tipo="info">
              Esta fecha ya se llenó. Mira las demás fechas abiertas en la agenda.
            </Aviso>
          ) : (
            <div className="flex flex-wrap items-center gap-4 border-t border-tinta/15 pt-8">
              <Boton onClick={() => setModalAbierto(true)}>
                Reservar y pagar {pesos(taller.price, taller.currency)}
              </Boton>
              <span className="text-[0.88rem] text-tinta/55">
                {textoCupo(taller.seats_available)}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Barra fija en móvil.
          La ficha de reserva está arriba de todo, así que después de leer la
          descripción, las FAQ y la galería, reservar quedaba a un scroll de
          distancia. Aquí la acción siempre está a un toque. */}
      {!cotizable && !lleno && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-tinta/12 bg-crema/95 px-5 py-3 backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-[1.25rem] leading-none">
                {pesos(taller.price, taller.currency)}
              </p>
              <p className="mt-1 truncate text-[0.78rem] text-tinta/55">
                {textoCupo(taller.seats_available)}
              </p>
            </div>
            <Boton className="shrink-0 px-7" onClick={() => setModalAbierto(true)}>
              Reservar
            </Boton>
          </div>
        </div>
      )}
      {/* Espacio para que la barra fija no tape el último bloque. */}
      {!cotizable && !lleno && <div className="h-24 lg:hidden" aria-hidden="true" />}

      <ModalReserva
        taller={taller}
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
      />
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="dato text-tinta/45">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
