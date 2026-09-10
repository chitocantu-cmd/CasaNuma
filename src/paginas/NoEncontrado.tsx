import { useTitulo } from '../features/workshops/hooks';
import { BotonEnlace } from '../componentes/ui';

export default function NoEncontrado() {
  useTitulo('Página no encontrada');
  return (
    <div className="contenedor flex min-h-[70vh] flex-col justify-center py-32 text-center">
      <p className="dato text-tinta/45">Página no encontrada</p>
      <h1 className="titular mt-6">Esta puerta no lleva a ningún lado.</h1>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <BotonEnlace to="/">Volver al inicio</BotonEnlace>
        <BotonEnlace to="/talleres" variante="secundario">Ver talleres</BotonEnlace>
      </div>
    </div>
  );
}
