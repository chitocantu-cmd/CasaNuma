import { Link } from 'react-router-dom';
import { LEGALES } from '../contenido/navegacion';
import { enlaceComoLlegar, enlaceInstagram, enlaceWhatsapp, siteConfig } from '../config/site';
import { Logo } from './marca/Logo';
import CeramicShape, { type NombreSilueta } from './marca/CeramicShape';
import { Icono } from './base/Iconos';
import { Pendiente } from './base/Pendiente';

const HILERA: NombreSilueta[] = ['olla', 'taza', 'jarron', 'cuenco', 'guaje', 'tarro', 'doble', 'anfora', 'botellon'];

const COLUMNAS: { titulo: string; enlaces: { label: string; to: string }[] }[] = [
  {
    titulo: 'Experiencias',
    enlaces: [
      { label: 'Talleres', to: '/talleres' },
      { label: 'Membresía', to: '/membresia' },
      { label: 'NUMA Kids', to: '/numa-kids' },
      { label: 'Eventos', to: '/eventos' },
    ],
  },
  {
    titulo: 'Casa Numa',
    enlaces: [
      { label: 'NUMA Store', to: '/numa-store' },
      { label: 'Nosotras', to: '/nosotras' },
      { label: 'Mi cuenta', to: '/cuenta' },
    ],
  },
];

export default function Footer() {
  const instagram = enlaceInstagram();
  const whatsapp = enlaceWhatsapp();
  const comoLlegar = enlaceComoLlegar();

  return (
    <footer data-fondo="oscuro" className="relative isolate overflow-hidden bg-cafe text-crema">
      {/* Hilera de piezas: el patrón del brandbook como remate de la página */}
      <div className="contenedor flex items-end justify-between gap-2 pt-16 sm:gap-4" aria-hidden="true">
        {HILERA.map((s, i) => (
          <CeramicShape key={s} nombre={s} className={`h-9 w-auto sm:h-12 ${i > 5 ? 'hidden sm:block' : ''}`} />
        ))}
      </div>

      <div className="contenedor grid gap-12 pb-12 pt-14 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="max-w-[16ch] font-display text-t2 font-light">Un espacio donde las ideas toman forma.</p>
          <p className="mt-5 max-w-[34ch] text-nota text-crema/70">
            Estudio de cerámica en el {siteConfig.zona}.
          </p>
        </div>

        {COLUMNAS.map((c) => (
          <nav key={c.titulo} aria-label={c.titulo} className="md:col-span-2">
            <p className="eyebrow text-crema/55">{c.titulo}</p>
            <ul className="mt-5 space-y-3">
              {c.enlaces.map((e) => (
                <li key={e.to}>
                  <Link to={e.to} className="subrayado pb-0.5 text-[0.95rem] text-crema/90 hover:text-crema">
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="md:col-span-3">
          <p className="eyebrow text-crema/55">Visítanos</p>
          <address className="mt-5 not-italic text-[0.95rem] leading-relaxed text-crema/90">
            {siteConfig.direccion && <span className="block">{siteConfig.direccion}</span>}
            <span className="block">{siteConfig.zona}</span>
          </address>
          {comoLlegar && (
            <a href={comoLlegar} target="_blank" rel="noopener noreferrer" className="subrayado-fijo mt-3 inline-block pb-0.5 text-[0.85rem]">
              Cómo llegar
            </a>
          )}

          <ul className="mt-7 flex gap-2">
            {instagram && (
              <li>
                <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-crema/25 transition-colors hover:bg-crema hover:text-cafe">
                  <Icono.instagram tam={19} />
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-crema/25 transition-colors hover:bg-crema hover:text-cafe">
                  <Icono.whatsapp tam={19} />
                </a>
              </li>
            )}
          </ul>
          {(!instagram || !whatsapp || !siteConfig.direccion) && (
            <Pendiente claro className="mt-5">
              Falta confirmar:{' '}
              {[!siteConfig.direccion && 'dirección', !instagram && 'Instagram', !whatsapp && 'WhatsApp']
                .filter(Boolean).join(', ')}.
            </Pendiente>
          )}
        </div>
      </div>

      <div className="contenedor flex flex-col gap-4 border-t border-crema/15 py-6 text-[0.78rem] text-crema/65 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGALES.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="subrayado pb-0.5 hover:text-crema">{l.label}</Link>
            </li>
          ))}
        </ul>
        <p>© {new Date().getFullYear()} Casa Numa</p>
      </div>

      {/* El logotipo como paisaje: enorme, cortado por el borde inferior */}
      <div className="contenedor pointer-events-none mt-6" aria-hidden="true">
        <div className="relative aspect-[439/345] w-[min(78vw,46rem)] overflow-hidden text-terracota md:ml-auto">
          <Logo className="absolute left-0 top-0 h-auto w-full" titulo="" />
        </div>
      </div>
    </footer>
  );
}
