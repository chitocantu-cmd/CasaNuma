import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV } from '../contenido/navegacion';
import { enlaceInstagram } from '../config/site';
import { useSesion } from '../features/cuenta/sesion';
import { Logo } from './marca/Logo';
import { Icono } from './base/Iconos';
import ReservarMenu from './layout/ReservarMenu';
import MobileMenu from './MobileMenu';

/**
 * Transparente sobre la portada; al bajar, fondo crema y una línea fina.
 * El logo nunca se achica: es la pieza más reconocible de la marca.
 */
export default function Header() {
  const [conFondo, setConFondo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();
  const { usuario } = useSesion();
  const instagram = enlaceInstagram();

  useEffect(() => {
    const revisar = () => setConFondo(window.scrollY > 24);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-media ease-numa ${
          conFondo ? 'border-b border-cafe/10 bg-crema/[0.93] backdrop-blur-[6px]' : 'border-b border-transparent'
        }`}
      >
        <div className="contenedor flex h-header items-center justify-between gap-6">
          <Link to="/" className="shrink-0 text-cafe transition-colors hover:text-terracota" aria-label="Casa Numa, ir al inicio">
            <Logo className="h-11 w-auto" titulo="Casa Numa" />
          </Link>

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-6 xl:gap-9">
              {NAV.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    className={({ isActive }) =>
                      `eyebrow subrayado pb-1 text-[0.7rem] transition-colors ${isActive ? 'text-cafe' : 'text-cafe/75 hover:text-cafe'}`
                    }
                  >
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-cafe/80 transition-colors hover:bg-cafe/[0.06] hover:text-cafe lg:inline-flex"
                aria-label="Instagram de Casa Numa"
              >
                <Icono.instagram tam={20} />
              </a>
            )}
            <Link
              to="/cuenta"
              className="hidden h-10 items-center gap-2 rounded-full px-2.5 text-cafe/80 transition-colors hover:bg-cafe/[0.06] hover:text-cafe lg:inline-flex"
              aria-label={usuario ? `Mi cuenta: ${usuario.nombre}` : 'Mi cuenta'}
            >
              <Icono.usuario tam={20} />
              {usuario && <span className="eyebrow max-w-[7rem] truncate text-[0.62rem]">{usuario.nombre.split(' ')[0]}</span>}
            </Link>

            <ReservarMenu compacto />

            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-cafe lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
            >
              <Icono.menu tam={26} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </>
  );
}
