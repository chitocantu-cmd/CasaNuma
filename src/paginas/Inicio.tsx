import { useState } from 'react';
import { useWorkshops, useTitulo } from '../features/workshops/hooks';
import type { Workshop } from '../tipos';
import ModalReserva from '../componentes/ModalReserva';
import TarjetaTaller from '../componentes/TarjetaTaller';
import { BotonEnlace, ImagenPendiente, Cargando } from '../componentes/ui';

const EXPERIENCIAS = [
  {
    titulo: 'Empiezas con las manos limpias',
    texto: 'y terminas con barro hasta los codos.',
    encuadre: 'manos amasando arcilla, luz lateral',
    tono: 'terracota',
  },
  {
    titulo: 'Mesa larga, gente que vuelve',
    texto: 'Las mejores ideas salen viendo lo que hace la de al lado.',
    encuadre: 'mesa larga con varias personas trabajando',
    tono: 'olivo',
  },
  {
    titulo: 'Nada sale perfecto la primera vez',
    texto: 'y esa es justo la parte buena.',
    encuadre: 'piezas imperfectas secándose en repisa',
    tono: 'arcilla',
  },
];

export default function Inicio() {
  useTitulo(
    'Talleres creativos y cerámica',
    'Un espacio para crear. Talleres, cerámica y experiencias para reconectar con tu lado creativo.',
  );

  const { datos, cargando, recargar } = useWorkshops();
  // Tambien se reserva desde la portada, sin dar un solo clic de mas.
  const [reservando, setReservando] = useState<Workshop | null>(null);
  const proximos = (datos ?? []).slice(0, 3);

  return (
    <div className="pb-24">
      {/* Portada */}
      <section className="contenedor pt-32 sm:pt-40">
        <h1 className="titular max-w-5xl">
          Un lugar
          <br />
          para hacer
          <br />
          con las manos.
        </h1>

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ImagenPendiente
              encuadre="manos trabajando el barro en el torno"
              tono="terracota"
              alt="Manos trabajando el barro"
              className="aspect-[16/11] w-full"
            />
          </div>
          <div className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
            <p className="text-[1.05rem] leading-relaxed text-tinta/75">
              Casa Numa es un estudio de cerámica y talleres creativos. Vienes,
              te sientas en la mesa larga, y sales con algo hecho por ti.
            </p>
            <div className="mt-8">
              <BotonEnlace to="/talleres">Ver fechas y reservar</BotonEnlace>
            </div>
          </div>
        </div>
      </section>

      {/* Próximos talleres */}
      <section className="contenedor mt-24">
        <div className="mb-10 flex items-end justify-between border-b border-tinta/12 pb-4">
          <h2 className="font-display text-[2rem] leading-none">Próximos talleres</h2>
          <BotonEnlace to="/talleres" variante="secundario" className="hidden px-5 py-2 sm:inline-flex">
            Ver todos
          </BotonEnlace>
        </div>

        {cargando ? (
          <Cargando texto="Cargando talleres…" />
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {proximos.map((t) => (
              <TarjetaTaller key={t.id} taller={t} onReservar={setReservando} />
            ))}
          </div>
        )}
      </section>

      {/* Cómo se siente */}
      <section className="contenedor mt-24">
        <div className="grid gap-10 sm:grid-cols-3">
          {EXPERIENCIAS.map((e) => (
            <article key={e.titulo}>
              <ImagenPendiente
                encuadre={e.encuadre}
                tono={e.tono}
                className="aspect-[4/5] w-full"
              />
              <h3 className="mt-5 font-display text-[1.3rem] leading-tight">{e.titulo}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-tinta/65">{e.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Nosotras · vivia en su propia pagina; se movio aqui para que el
          menu tenga menos lugares donde perderse. */}
      <section className="contenedor mt-24" id="nosotras">
        <div className="grid gap-10 border-t border-tinta/15 pt-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="dato text-tinta/45">Nosotras</p>
            <h2 className="mt-4 font-display text-[2.4rem] leading-tight">
              Una casa hecha para crear.
            </h2>
            <p className="mt-6 text-[1.02rem] leading-relaxed text-tinta/75">
              Casa Numa empezó como una mesa, un costal de barro y ganas de que
              más gente probara hacer algo con las manos.
            </p>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-tinta/70">
              [PENDIENTE: reemplazar con la historia real — cómo nació, quién la
              fundó y por qué el nombre.]
            </p>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <ImagenPendiente
              encuadre="plano amplio del estudio vacío, luz de mañana"
              tono="arcilla"
              alt="El estudio de Casa Numa"
              className="aspect-[16/11] w-full"
            />
          </div>
        </div>
      </section>

      {/* Membresía */}
      <section className="contenedor mt-24">
        <div className="grid gap-10 bg-tinta p-10 text-crema sm:p-14 lg:grid-cols-2">
          <div>
            <p className="dato text-crema/45">Membresía</p>
            <h2 className="mt-4 font-display text-[2.4rem] leading-tight">
              Para quien vuelve cada semana.
            </h2>
          </div>
          <div className="flex flex-col justify-between gap-8">
            <p className="text-[1.02rem] leading-relaxed text-crema/70">
              Sesiones abiertas cada semana para que la práctica no dependa de
              encontrar un hueco en la agenda, con prioridad cuando abrimos fechas
              nuevas.
            </p>
            <div>
              <BotonEnlace
                to="/membresia"
                className="border border-crema/30 bg-transparent text-crema hover:border-crema hover:bg-crema hover:text-tinta"
              >
                Conocer la membresía
              </BotonEnlace>
            </div>
          </div>
        </div>
      </section>
      <ModalReserva
        taller={reservando}
        abierto={reservando !== null}
        onCerrar={() => setReservando(null)}
        onCupoAgotado={recargar}
      />
    </div>
  );
}
