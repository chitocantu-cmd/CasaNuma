import { BotonEnlace } from '../componentes/base/Boton';
import CeramicShape from '../componentes/marca/CeramicShape';
import { useSeo } from '../lib/seo';

export default function NoEncontrado() {
  useSeo({ titulo: 'Página no encontrada | Casa Numa', descripcion: 'Esta página no existe.', indexar: false });
  return (
    <section className="contenedor flex min-h-[80vh] flex-col items-start justify-center pb-seccion-s pt-[calc(theme(spacing.header)+3rem)]">
      <CeramicShape nombre="cuenco" className="h-14 w-auto" />
      <p className="eyebrow mt-10 text-cafe/65">Error 404</p>
      <h1 className="mt-5 max-w-[16ch] font-display text-t1 font-light">Esta pieza no salió del horno.</h1>
      <p className="mt-6 max-w-lectura text-cuerpo-l text-cafe/80">La página que buscas no existe o cambió de lugar.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <BotonEnlace to="/" flecha>Volver al inicio</BotonEnlace>
        <BotonEnlace to="/talleres" variante="secundario">Ver talleres</BotonEnlace>
      </div>
    </section>
  );
}
