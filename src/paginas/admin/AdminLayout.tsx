import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/admin/auth';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/talleres', label: 'Talleres' },
  { to: '/admin/reservaciones', label: 'Reservaciones' },
  { to: '/admin/pagos', label: 'Pagos' },
  { to: '/admin/prospectos', label: 'Prospectos' },
];

export default function AdminLayout() {
  const { salir, session } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-papel">
      <header className="border-b border-tinta/12 bg-crema">
        <div className="contenedor flex h-16 items-center justify-between gap-6">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-[1.15rem] leading-none">Casa Numa</span>
            <span className="dato text-tinta/40">Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-[0.82rem] text-tinta/50 sm:inline">
              {session?.user.email}
            </span>
            <button
              onClick={async () => { await salir(); navigate('/admin/login'); }}
              className="dato text-tinta/55 transition-colors hover:text-terracota"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="contenedor flex gap-6 overflow-x-auto pb-px" aria-label="Panel">
          {NAV.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                `dato whitespace-nowrap border-b-2 py-3 transition-colors ${
                  isActive
                    ? 'border-terracota text-terracota'
                    : 'border-transparent text-tinta/55 hover:text-tinta'
                }`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="contenedor py-10">
        <Outlet />
      </main>
    </div>
  );
}
