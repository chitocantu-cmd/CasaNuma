import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import { Icono } from './ui';

// "Nosotras" salio del menu: su contenido vive ahora dentro de Inicio, para
// que el cliente tenga menos lugares donde perderse. Y "Talleres" se llama
// "Reservaciones", que es lo que la gente viene a hacer.
const NAV = [
  { label: 'Inicio', to: '/' },
  { label: 'Reservaciones', to: '/talleres' },
  { label: 'Membresía', to: '/membresia' },
  { label: 'Contacto', to: '/contacto' },
];

interface Config {
  nombre: string;
  lema: string | null;
  whatsapp: string | null;
  whatsapp_url: string | null;
  email: string | null;
  instagram: string | null;
  instagram_url: string | null;
  direccion_linea1: string | null;
  direccion_linea2: string | null;
  horarios: { dia: string; horas: string }[];
  mapa_embed_url: string | null;
  politica_cancelacion: string | null;
}

// La configuración vive en la tabla `site_settings`, no en el código. En el
// demo el WhatsApp y la dirección estaban escritos dentro del bundle como
// "[PENDIENTE: ...]", así que cambiarlos exigía recompilar y volver a publicar.
export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setConfig(data as Config | null));
  }, []);

  return config;
}

function Header() {
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  // Cuerpo con llaves, NO flecha concisa: una flecha concisa devuelve el valor
  // de la expresion, React lo toma como funcion de limpieza y truena al
  // desmontar con "destroy is not a function" — dejando la pagina en blanco.
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-papel/85 backdrop-blur-md">
      <div className="contenedor flex h-20 items-center justify-between">
        <Link to="/" className="font-display text-[1.35rem] leading-none">
          Casa Numa
        </Link>

        <nav className="hidden gap-8 md:flex" aria-label="Principal">
          {NAV.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `dato transition-colors ${isActive ? 'text-terracota' : 'text-tinta/60 hover:text-tinta'}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setAbierto((v) => !v)}
          className="p-2 md:hidden"
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        >
          {abierto ? <Icono.cerrar size={22} /> : <Icono.menu size={22} />}
        </button>
      </div>

      {abierto && (
        <nav className="border-t border-tinta/10 bg-papel md:hidden" aria-label="Principal móvil">
          <div className="contenedor flex flex-col py-4">
            {NAV.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/'}
                className={({ isActive }) =>
                  `dato py-3 ${isActive ? 'text-terracota' : 'text-tinta/70'}`
                }
              >
                {i.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const config = useConfig();
  const pendiente = (v: string | null | undefined, etiqueta: string) =>
    v ?? `[PENDIENTE: ${etiqueta}]`;

  return (
    <footer className="mt-24 bg-tinta py-16 text-crema">
      <div className="contenedor">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-[1.5rem] leading-none">Casa Numa</p>
            <p className="mt-3 max-w-[22ch] text-[0.9rem] text-crema/60">
              {config?.lema ?? 'Un lugar para hacer, crear y compartir.'}
            </p>
          </div>

          <div>
            <p className="dato mb-3 text-crema/40">Visítanos</p>
            <p className="text-[0.9rem] text-crema/75">
              {pendiente(config?.direccion_linea1, 'calle y número')}
              <br />
              {pendiente(config?.direccion_linea2, 'colonia, ciudad')}
            </p>
          </div>

          <div>
            <p className="dato mb-3 text-crema/40">Horarios</p>
            <ul className="space-y-1 text-[0.9rem] text-crema/75">
              {(config?.horarios?.length
                ? config.horarios
                : [
                    { dia: 'Martes a viernes', horas: '11:00 — 19:00' },
                    { dia: 'Sábado', horas: '10:00 — 18:00' },
                    { dia: 'Domingo y lunes', horas: 'Cerrado' },
                  ]
              ).map((h) => (
                <li key={h.dia}>
                  {h.dia} · {h.horas}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="dato mb-3 text-crema/40">Contacto</p>
            <ul className="space-y-1 text-[0.9rem] text-crema/75">
              <li>{pendiente(config?.whatsapp, 'WhatsApp')}</li>
              <li>{pendiente(config?.email, 'correo')}</li>
              <li>
                <a
                  href={config?.instagram_url ?? 'https://instagram.com/casanumamx'}
                  className="transition-colors hover:text-crema"
                  target="_blank"
                  rel="noreferrer"
                >
                  {config?.instagram ?? '@casanumamx'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-crema/15 pt-6 text-[0.78rem] text-crema/45">
          <p>© Casa Numa {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}

/** Al cambiar de ruta, volver arriba. */
function IrArriba() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function Layout() {
  return (
    <>
      <IrArriba />
      <Header />
      <main id="contenido" className="entrada-pagina">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
