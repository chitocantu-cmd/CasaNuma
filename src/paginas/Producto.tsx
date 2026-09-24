import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCard, { ETIQUETA_DISPONIBILIDAD, precioProducto } from '../componentes/ProductCard';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import CtaWhatsapp from '../componentes/base/CtaWhatsapp';
import { BotonEnlace } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import { MarcaDemo } from '../componentes/base/Pendiente';
import { mensajeEncargo, mensajePieza } from '../contenido/whatsapp';
import { useProducto, useProductos } from '../datos/hooks';
import { ldProducto, useSeo } from '../lib/seo';

export default function Producto() {
  const { slug } = useParams();
  const { datos: p, cargando } = useProducto(slug);
  const { datos: todos } = useProductos();
  const [foto, setFoto] = useState(0);

  useSeo({
    titulo: p ? `${p.nombre} | NUMA Store | Casa Numa` : 'NUMA Store | Casa Numa',
    descripcion: p?.descripcion ?? 'Piezas de cerámica hechas a mano en Casa Numa.',
    jsonLd: p ? ldProducto({ nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, agotado: p.disponibilidad === 'agotado', demo: p.demo }) : null,
  });

  if (cargando && !p) return <div className="min-h-[80vh]" aria-busy="true" />;
  if (!p) {
    return (
      <div className="contenedor flex min-h-[70vh] flex-col items-start justify-center pt-header">
        <p className="eyebrow text-cafe/60">Pieza no encontrada</p>
        <h1 className="mt-5 font-display text-t1 font-light">Esta pieza ya encontró casa.</h1>
        <BotonEnlace to="/numa-store" className="mt-10" flecha>Ver NUMA Store</BotonEnlace>
      </div>
    );
  }

  const agotado = p.disponibilidad === 'agotado';
  const encargo = p.modalidad === 'encargo';
  const otras = (todos ?? []).filter((x) => x.id !== p.id).slice(0, 4);

  return (
    <>
      <section className="contenedor pb-seccion-s pt-[calc(theme(spacing.header)+2rem)]">
        <Link to="/numa-store" className="group inline-flex items-center gap-2 text-nota text-cafe/70 hover:text-cafe">
          <Icono.flechaIzq tam={16} className="transition-transform group-hover:-translate-x-1" /> NUMA Store
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-8">
          <Revelar className="lg:col-span-7">
            <Foto foto={p.fotos[foto]} prioridad className="aspect-[4/5] w-full rounded-suave sm:aspect-[5/4] lg:aspect-[4/4.2]" sizes="(min-width:1024px) 55vw, 100vw" />
            {p.fotos.length > 1 && (
              <div className="mt-3 flex gap-2">
                {p.fotos.map((f, i) => (
                  <button key={i} type="button" onClick={() => setFoto(i)} aria-label={`Foto ${i + 1}`} aria-pressed={i === foto}
                    className={`w-20 overflow-hidden rounded-foto ring-offset-2 ${i === foto ? 'ring-1 ring-cafe' : ''}`}>
                    <Foto foto={f} className="aspect-square w-full" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </Revelar>

          <Revelar retraso={0.1} className="lg:col-span-4 lg:col-start-9">
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow text-cafe/60">{p.categoria}</p>
              {p.demo && <MarcaDemo />}
            </div>
            <h1 className="mt-4 font-display text-t2 font-light">{p.nombre}</h1>
            <p className={`cifra mt-5 text-[2.4rem] leading-none ${p.precio === null ? 'text-indigo' : ''}`}>{precioProducto(p)}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-nota">
              <span className={`h-2 w-2 rounded-full ${agotado ? 'bg-cafe/40' : encargo ? 'bg-indigo' : 'bg-verde'}`} aria-hidden="true" />
              {ETIQUETA_DISPONIBILIDAD[p.disponibilidad]}
              {encargo && ' · Se hace para ti'}
            </p>

            <p className="mt-8 text-cuerpo-l text-cafe/85">{p.descripcion}</p>

            <dl className="mt-8 divide-y divide-cafe/12 border-y border-cafe/12 text-nota">
              {p.dimensiones && (
                <div className="flex justify-between gap-6 py-4"><dt className="text-cafe/60">Medidas</dt><dd className="text-right">{p.dimensiones}</dd></div>
              )}
              {p.acabados && (
                <div className="flex justify-between gap-6 py-4"><dt className="text-cafe/60">Acabado</dt><dd className="text-right">{p.acabados}</dd></div>
              )}
              <div className="flex justify-between gap-6 py-4">
                <dt className="text-cafe/60">Modalidad</dt>
                <dd className="text-right">{encargo ? 'Por encargo' : 'Lista para entrega'}</dd>
              </div>
            </dl>

            <div className="mt-8">
              {agotado ? (
                <CtaWhatsapp mensaje={mensajeEncargo(p.nombre)} variante="secundario">Pedir una similar</CtaWhatsapp>
              ) : encargo ? (
                <CtaWhatsapp mensaje={mensajeEncargo(p.nombre)}>Cotizar por WhatsApp</CtaWhatsapp>
              ) : (
                <CtaWhatsapp mensaje={mensajePieza(p.nombre)}>Comprar por WhatsApp</CtaWhatsapp>
              )}
            </div>
            <p className="mt-4 text-[0.74rem] text-cafe/60">
              Se abre WhatsApp con el nombre de la pieza. Ahí confirmamos disponibilidad y forma de pago.
            </p>
          </Revelar>
        </div>
      </section>

      {otras.length > 0 && (
        <section className="contenedor border-t border-cafe/10 py-seccion-s" aria-labelledby="p-otras">
          <h2 id="p-otras" className="font-display text-t3 font-light">Otras piezas</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8">
            {otras.map((o) => <ProductCard key={o.id} producto={o} />)}
          </div>
        </section>
      )}
    </>
  );
}
