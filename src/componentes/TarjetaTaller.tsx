import { Link } from 'react-router-dom';
import type { Workshop } from '../tipos';
import { ETIQUETAS_CATEGORIA } from '../tipos';
import { fechaLarga, rangoHorario, pesos, textoCupo, estadoCupo } from '../lib/formato';
import { ImagenTaller, Boton } from './ui';

// ---------------------------------------------------------------------------
// La tarjeta lleva su propio botón de reservar.
// ---------------------------------------------------------------------------
// Antes había que entrar al detalle del taller para poder reservar: una página
// de por medio entre "quiero ir" y "ya aparté mi lugar". Aquí se reserva desde
// la agenda misma, y el detalle queda para quien quiera leer más.
//
// Por eso la tarjeta ya no es un <Link> completo: un botón dentro de un enlace
// es HTML inválido, y en móvil los dos se pelean por el toque.
// ---------------------------------------------------------------------------

export default function TarjetaTaller({
  taller,
  onReservar,
}: {
  taller: Workshop;
  onReservar?: (t: Workshop) => void;
}) {
  const estado = estadoCupo(taller.seats_available);
  const lleno = estado === 'lleno';
  const cotizable = taller.booking_mode === 'quote';

  return (
    <article className="flex flex-col">
      <Link to={`/talleres/${taller.slug}`} className="group flex flex-col">
        <div className="relative">
          <ImagenTaller
            src={taller.image_url}
            alt={taller.title}
            encuadre={`${taller.title.toLowerCase()}, plano de manos trabajando`}
            tono={taller.tono}
            className="aspect-[4/3] w-full"
          />
          <span
            className={`dato absolute left-0 top-0 px-3 py-2 ${
              lleno
                ? 'bg-tinta/85 text-crema/70'
                : estado === 'ultimos'
                  ? 'bg-terracota text-crema'
                  : 'bg-crema/90 text-tinta/70'
            }`}
          >
            {textoCupo(taller.seats_available)}
          </span>
        </div>

        <p className="dato mt-4 text-tinta/45">{ETIQUETAS_CATEGORIA[taller.category]}</p>
        <h3 className="mt-2 font-display text-[1.45rem] leading-tight transition-colors group-hover:text-terracota">
          {taller.title}
        </h3>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-tinta/65">
          {taller.short_description}
        </p>
      </Link>

      {/* Fecha, precio y acción — todo sin salir de la agenda */}
      <div className="mt-4 flex items-end justify-between gap-4 border-t border-tinta/12 pt-3">
        <span className="text-[0.85rem] text-tinta/60">
          {fechaLarga(taller.date)}
          <span className="block text-[0.8rem] text-tinta/45">
            {rangoHorario(taller.start_time, taller.end_time)}
          </span>
        </span>
        <span className="font-display text-[1.15rem]">
          {pesos(taller.price, taller.currency)}
        </span>
      </div>

      <div className="mt-3">
        {cotizable ? (
          <Link
            to="/contacto"
            className="inline-flex w-full items-center justify-center border border-tinta/25 px-5 py-2.5 text-[0.88rem] font-semibold transition-colors hover:border-tinta"
          >
            Pedir cotización
          </Link>
        ) : (
          <Boton
            className="w-full px-5 py-2.5 text-[0.88rem]"
            disabled={lleno}
            onClick={() => onReservar?.(taller)}
          >
            {lleno ? 'Cupo lleno' : 'Reservar'}
          </Boton>
        )}
      </div>
    </article>
  );
}
