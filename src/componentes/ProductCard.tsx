import { Link } from 'react-router-dom';
import type { Producto } from '../datos/tipos';
import { pesosCortos } from '../lib/formato';
import Foto from './base/Foto';
import { MarcaDemo } from './base/Pendiente';

export const ETIQUETA_DISPONIBILIDAD: Record<Producto['disponibilidad'], string> = {
  disponible: 'Disponible',
  agotado: 'Agotado',
  'bajo-pedido': 'Por encargo',
};

export function precioProducto(p: Producto): string {
  return p.precio === null ? 'Cotizar' : pesosCortos(p.precio);
}

/** Ficha de NUMA Store: foto, nombre, precio o "Cotizar", disponibilidad. */
export default function ProductCard({ producto: p }: { producto: Producto }) {
  const agotado = p.disponibilidad === 'agotado';
  return (
    <Link to={`/numa-store/${p.slug}`} className="group block">
      <div className="relative">
        <Foto
          foto={p.fotos[0]}
          className={`aspect-[4/5] w-full rounded-foto ${agotado ? 'opacity-70 saturate-50' : ''}`}
          sizes="(min-width:1024px) 22vw, 45vw"
          zoom
        />
        <span
          className={`eyebrow absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[0.56rem] ${
            agotado ? 'bg-cafe text-crema' : p.modalidad === 'encargo' ? 'bg-indigo text-crema' : 'bg-crema/95 text-cafe'
          }`}
        >
          {ETIQUETA_DISPONIBILIDAD[p.disponibilidad]}
        </span>
        {p.demo && <MarcaDemo className="absolute right-3 top-3 z-10 bg-crema/95" />}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1.3rem] font-light leading-tight text-cafe transition-colors group-hover:text-terracota">
            {p.nombre}
          </h3>
          <p className="mt-1 text-[0.74rem] text-cafe/60">{p.categoria}</p>
        </div>
        <p className={`shrink-0 pt-1 text-[0.92rem] ${p.precio === null ? 'text-indigo' : 'text-cafe'}`}>{precioProducto(p)}</p>
      </div>
    </Link>
  );
}
