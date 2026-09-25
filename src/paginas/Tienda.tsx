import { useMemo, useState } from 'react';
import SectionHeading from '../componentes/SectionHeading';
import ProductCard from '../componentes/ProductCard';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import CtaWhatsapp from '../componentes/base/CtaWhatsapp';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import CeramicShape from '../componentes/marca/CeramicShape';
import { mensajeEncargo } from '../contenido/whatsapp';
import { useProductos } from '../datos/hooks';
import type { Producto } from '../datos/tipos';
import { useSeo } from '../lib/seo';

// Texto: documento de contenido, sección 7.

const CATEGORIAS: ('Todas' | Producto['categoria'])[] = ['Todas', 'Tazas', 'Vajillas', 'Objetos decorativos', 'Creaciones especiales'];

export default function Tienda() {
  useSeo({
    titulo: 'NUMA Store | Cerámica hecha a mano | Casa Numa',
    descripcion:
      'Tazas, vajillas, objetos decorativos y piezas por encargo hechas a mano en Casa Numa. Compra y cotiza por WhatsApp.',
  });

  const { datos: productos } = useProductos();
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('Todas');
  const filtrados = useMemo(
    () => (productos ?? []).filter((p) => categoria === 'Todas' || p.categoria === categoria),
    [productos, categoria],
  );
  const disponibles = filtrados.filter((p) => p.modalidad === 'disponible');
  const encargo = filtrados.filter((p) => p.modalidad === 'encargo');

  return (
    <>
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-6">
            <SectionHeading como="h1" eyebrow="NUMA Store" titulo="Piezas únicas para espacios con personalidad." />
            <Revelar retraso={0.1}>
              <p className="mt-8 max-w-lectura text-cuerpo-l text-cafe/85">
                En NUMA Store encontrarás piezas de cerámica creadas a mano en nuestro estudio. Desde tazas y vajillas hasta
                objetos decorativos y creaciones especiales, cada pieza refleja nuestro amor por el diseño, las formas y los
                pequeños detalles.
              </p>
              <p className="mt-5 max-w-lectura text-cuerpo-l text-cafe/85">
                Descubre nuestras piezas disponibles o cuéntanos qué tienes en mente para crear algo especialmente para ti.
              </p>
            </Revelar>
          </div>
          <Revelar retraso={0.1} className="lg:col-span-5 lg:col-start-8">
            <Foto id="store-hero" prioridad className="aspect-[5/4] w-full rounded-suave" sizes="(min-width:1024px) 40vw, 100vw" />
          </Revelar>
        </div>

        <Revelar className="mt-12 flex flex-col gap-3 border-y border-cafe/12 py-5 text-nota text-cafe/80 sm:flex-row sm:items-center sm:gap-8">
          <span className="flex items-center gap-2.5"><Icono.whatsapp tam={18} className="text-terracota" /> Compras y encargos por WhatsApp</span>
          <span className="flex items-center gap-2.5"><Icono.pieza tam={18} className="text-terracota" /> Cada pieza es única</span>
        </Revelar>
        <Pendiente className="mt-6">
          Faltan precio, medidas y disponibilidad de cada pieza: mientras, se cotizan por WhatsApp. Las dos fichas por encargo son
          de ejemplo.
        </Pendiente>
      </section>

      {/* Filtro por categoría */}
      <div className="contenedor mt-12">
        <div className="carril -mx-canal flex gap-2 overflow-x-auto px-canal pb-1" role="group" aria-label="Filtrar por categoría">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`min-h-11 shrink-0 rounded-full border px-5 text-[0.8rem] transition-colors ${
                categoria === c ? 'border-cafe bg-cafe text-crema' : 'border-cafe/20 text-cafe/80 hover:border-cafe'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section className="contenedor py-seccion-s" aria-labelledby="s-disponibles">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="s-disponibles" className="font-display text-t2 font-light">Piezas disponibles</h2>
            <p className="mt-3 text-cuerpo text-cafe/75">Explora nuestra colección de cerámica lista para llevar a casa.</p>
          </div>
          <CeramicShape nombre="taza" className="hidden h-12 w-auto sm:block" />
        </div>
        {disponibles.length ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
            {disponibles.map((p, i) => (
              <Revelar key={p.id} retraso={(i % 4) * 0.05}>
                <ProductCard producto={p} />
              </Revelar>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-cuerpo text-cafe/70">No hay piezas disponibles en esta categoría por ahora.</p>
        )}
      </section>

      <section className="bg-cafe/[0.035] py-seccion" aria-labelledby="s-encargo">
        <div className="contenedor">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <SectionHeading eyebrow="Piezas por encargo" titulo={<span id="s-encargo">¿Tienes una idea especial?</span>} tamano="t2" />
              <Revelar retraso={0.1}>
                <p className="mt-6 text-cuerpo-l text-cafe/85">Podemos crear una pieza personalizada para ti.</p>
                <div className="mt-8">
                  <CtaWhatsapp mensaje={mensajeEncargo()}>Cotizar por WhatsApp</CtaWhatsapp>
                </div>
              </Revelar>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:col-span-6 lg:col-start-7">
              {encargo.map((p, i) => (
                <Revelar key={p.id} retraso={i * 0.06}>
                  <ProductCard producto={p} />
                </Revelar>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
