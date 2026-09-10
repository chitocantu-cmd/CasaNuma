import { useMemo, useState } from 'react';
import { useWorkshops, useTitulo } from '../features/workshops/hooks';
import type { Categoria, Workshop } from '../tipos';
import { mesDeFecha } from '../lib/formato';
import TarjetaTaller from '../componentes/TarjetaTaller';
import { Cargando, Aviso, Boton } from '../componentes/ui';
import ModalReserva from '../componentes/ModalReserva';

const FILTROS: { id: Categoria | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ceramica', label: 'Cerámica' },
  { id: 'pintura', label: 'Pintura' },
  { id: 'libre', label: 'Taller libre' },
  { id: 'especiales', label: 'Especiales' },
];

export default function Talleres() {
  useTitulo(
    'Reservaciones',
    'Calendario de talleres de cerámica y pintura en Casa Numa. Reserva tu lugar en línea.',
  );

  const { datos, cargando, error, recargar } = useWorkshops();
  const [filtro, setFiltro] = useState<Categoria | 'todos'>('todos');
  // Reservar sin salir de la agenda: el modal vive aqui y cualquier tarjeta
  // lo abre. Una pagina menos entre "quiero ir" y "ya aparte mi lugar".
  const [reservando, setReservando] = useState<Workshop | null>(null);

  const visibles = useMemo(
    () => (datos ?? []).filter((t) => filtro === 'todos' || t.category === filtro),
    [datos, filtro],
  );

  // Agrupados por mes, que es como la gente piensa una agenda.
  const porMes = useMemo(() => {
    const mapa = new Map<string, typeof visibles>();
    for (const t of visibles) {
      const clave = t.date.slice(0, 7);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(t);
    }
    return [...mapa.entries()];
  }, [visibles]);

  return (
    <div className="pb-24 pt-32 sm:pt-40">
      <section className="contenedor">
        <h1 className="titular max-w-4xl">Agenda</h1>
        <p className="mt-6 max-w-[45ch] text-[1.05rem] leading-relaxed text-tinta/70">
          Fechas abiertas para los próximos meses. Los lugares se apartan al pagar
          y se van rápido.
        </p>

        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`dato border px-4 py-2 transition-colors ${
                filtro === f.id
                  ? 'border-tinta bg-tinta text-crema'
                  : 'border-tinta/20 text-tinta/60 hover:border-tinta/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {cargando && <Cargando texto="Cargando talleres…" />}

      {error && (
        <section className="contenedor mt-12">
          <Aviso>No pudimos cargar los talleres. {error}</Aviso>
          <Boton className="mt-4" onClick={recargar}>Reintentar</Boton>
        </section>
      )}

      {!cargando && !error && visibles.length === 0 && (
        <section className="contenedor mt-16">
          <p className="text-tinta/60">
            No hay talleres en esta categoría por ahora. Prueba con otra o escríbenos
            para avisarte cuando abramos fechas.
          </p>
        </section>
      )}

      {porMes.map(([clave, talleres]) => (
        <section key={clave} className="contenedor mt-16">
          <h2 className="dato mb-6 border-b border-tinta/12 pb-3 text-tinta/45">
            {mesDeFecha(talleres[0].date)}
          </h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.map((t) => (
              <TarjetaTaller key={t.id} taller={t} onReservar={setReservando} />
            ))}
          </div>
        </section>
      ))}

      <ModalReserva
        taller={reservando}
        abierto={reservando !== null}
        onCerrar={() => setReservando(null)}
        onCupoAgotado={recargar}
      />
    </div>
  );
}
