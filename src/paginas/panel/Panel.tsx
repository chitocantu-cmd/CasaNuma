import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { repoAdmin } from '../../datos';
import { invalidarCupos } from '../../datos/hooks';
import type { Usuario } from '../../datos/tipos';
import { fuenteDatos, siteConfig } from '../../config/site';
import { Logo } from '../../componentes/marca/Logo';
import { Icono, type NombreIcono } from '../../componentes/base/Iconos';
import { useSeo } from '../../lib/seo';
import { ContextoPanel } from './ui';
import PanelEntrar from './PanelEntrar';

// ---------------------------------------------------------------------------
// Panel de Casa Numa: el centro de operaciones.
// ---------------------------------------------------------------------------
// Cada reserva confirmada aparece aquí sola. El acceso exige una cuenta con
// rol 'admin'; una cuenta de clienta no entra aunque tenga contraseña.
// ---------------------------------------------------------------------------

const Resumen = lazy(() => import('./PanelResumen'));
const Reservas = lazy(() => import('./PanelReservas'));
const Reserva = lazy(() => import('./PanelReserva'));
const NuevaReserva = lazy(() => import('./PanelNuevaReserva'));
const Calendario = lazy(() => import('./PanelCalendario'));
const Talleres = lazy(() => import('./PanelTalleres'));
const Membresias = lazy(() => import('./PanelMembresias'));
const Clientes = lazy(() => import('./PanelClientes'));
const Pagos = lazy(() => import('./PanelPagos'));
const Avisos = lazy(() => import('./PanelAvisos'));

const NAV: { to: string; label: string; icono: NombreIcono; fin?: boolean }[] = [
  { to: '/admin', label: 'Resumen', icono: 'resumen', fin: true },
  { to: '/admin/reservas', label: 'Reservas', icono: 'lista' },
  { to: '/admin/calendario', label: 'Calendario', icono: 'calendario' },
  { to: '/admin/talleres', label: 'Talleres', icono: 'pieza' },
  { to: '/admin/membresias', label: 'Membresías', icono: 'arcilla' },
  { to: '/admin/clientes', label: 'Clientes', icono: 'personas' },
  { to: '/admin/pagos', label: 'Pagos', icono: 'tarjeta' },
  { to: '/admin/avisos', label: 'Avisos', icono: 'sobre' },
];

function Cargando() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

function Layout({ admin, onSalir }: { admin: Usuario; onSalir: () => Promise<void> }) {
  const Ic = (n: NombreIcono) => Icono[n];
  return (
    <ContextoPanel.Provider value={{ admin, salir: onSalir }}>
      <div className="min-h-screen bg-crema text-cafe">
        {/* Barra lateral (escritorio) */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-cafe/12 bg-crema lg:flex">
          <Link to="/admin" className="flex items-center gap-3 px-6 pb-6 pt-7">
            <Logo className="h-10 w-auto text-cafe" titulo="Casa Numa" />
            <span className="eyebrow text-[0.58rem] leading-tight text-cafe/60">Panel de<br />administración</span>
          </Link>
          <nav aria-label="Panel" className="flex-1 space-y-0.5 px-3">
            {NAV.map((n) => {
              const I = Ic(n.icono);
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.fin}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center gap-3 rounded-[0.55rem] px-3 text-[0.86rem] transition-colors ${
                      isActive ? 'bg-cafe text-crema' : 'text-cafe/80 hover:bg-cafe/[0.06] hover:text-cafe'
                    }`
                  }
                >
                  <I tam={18} /> {n.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-cafe/12 px-5 py-4 text-[0.78rem]">
            <p className="truncate font-medium">{admin.nombre}</p>
            <p className="truncate text-cafe/60">{admin.email}</p>
            <div className="mt-3 flex gap-4">
              <Link to="/" className="subrayado-fijo pb-0.5 text-cafe/75">Ver sitio</Link>
              <button type="button" onClick={onSalir} className="subrayado-fijo pb-0.5 text-cafe/75">Salir</button>
            </div>
          </div>
        </aside>

        {/* Barra superior (móvil y tableta) */}
        <div className="sticky top-0 z-30 border-b border-cafe/12 bg-crema/95 backdrop-blur-sm lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/admin" className="flex items-center gap-2.5">
              <Logo className="h-8 w-auto text-cafe" titulo="Casa Numa" />
              <span className="eyebrow text-[0.55rem] text-cafe/60">Panel</span>
            </Link>
            <button type="button" onClick={onSalir} className="inline-flex min-h-10 items-center gap-1.5 text-[0.78rem] text-cafe/75">
              <Icono.salir tam={16} /> Salir
            </button>
          </div>
          <nav aria-label="Panel" className="carril flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.fin}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3.5 py-2 text-[0.78rem] ${isActive ? 'bg-cafe text-crema' : 'text-cafe/75 hover:bg-cafe/[0.06]'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="lg:pl-60">
          {fuenteDatos === 'demo' && (
            <div className="border-b border-indigo/20 bg-indigo/[0.06] px-4 py-2 text-[0.74rem] text-indigo sm:px-8">
              <strong className="font-medium">Demo.</strong> Los datos viven en este navegador: aquí aparece lo que se reserva en este
              mismo navegador. Las reservas de ejemplo llevan la marca DEMO. Pagos simulados.
              {!siteConfig.correoAvisosEquipo && ' Falta configurar el correo de avisos del equipo (ADMIN_NOTIFICATION_EMAIL).'}
            </div>
          )}
          <div className="mx-auto max-w-[80rem] px-4 py-8 sm:px-8 lg:py-10">
            <Suspense fallback={<Cargando />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </ContextoPanel.Provider>
  );
}

/** Solo entra quien tiene sesión con rol 'admin'. */
function Protegido() {
  const [admin, setAdmin] = useState<Usuario | null | undefined>(undefined);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    repoAdmin.adminActual().then(setAdmin).catch(() => setAdmin(null));
  }, [location.pathname]);

  const salir = useCallback(async () => {
    await repoAdmin.salirAdmin();
    invalidarCupos();
    navigate('/admin/entrar');
  }, [navigate]);

  if (admin === undefined) return <Cargando />;
  if (!admin) return <Navigate to="/admin/entrar" replace state={{ desde: location.pathname }} />;
  return <Layout admin={admin} onSalir={salir} />;
}

export default function Panel() {
  useSeo({ titulo: 'Panel | Casa Numa', descripcion: 'Panel de administración de Casa Numa.', indexar: false });
  return (
    <Routes>
      <Route path="entrar" element={<PanelEntrar />} />
      <Route path="login" element={<Navigate to="/admin/entrar" replace />} />
      <Route element={<Protegido />}>
        <Route index element={<Resumen />} />
        <Route path="reservas" element={<Reservas />} />
        <Route path="reservas/nueva" element={<NuevaReserva />} />
        <Route path="reservas/:id" element={<Reserva />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="talleres" element={<Talleres />} />
        <Route path="membresias" element={<Membresias />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="pagos" element={<Pagos />} />
        <Route path="avisos" element={<Avisos />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
