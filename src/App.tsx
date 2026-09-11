import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './componentes/Layout';
import { AuthProvider, RequiereAdmin } from './features/admin/auth';
import { configurado } from './lib/supabase/client';
import SinConfigurar from './paginas/SinConfigurar';

import Inicio from './paginas/Inicio';
import Talleres from './paginas/Talleres';
import TallerDetalle from './paginas/TallerDetalle';
import Membresia from './paginas/Membresia';
import Contacto from './paginas/Contacto';
import Reserva from './paginas/Reserva';
import PagoExitoso from './paginas/PagoExitoso';
import PagoCancelado from './paginas/PagoCancelado';
import NoEncontrado from './paginas/NoEncontrado';

// ---------------------------------------------------------------------------
// El panel se carga aparte, solo cuando alguien entra a /admin.
// ---------------------------------------------------------------------------
// Es un tercio del codigo de la aplicacion y lo usan dos o tres personas. Sin
// esta separacion, cada clienta que abre la agenda desde su telefono descarga
// tambien las tablas de reservaciones, el formulario de talleres y el cliente
// de Cloudinary — codigo que nunca va a ejecutar.
// ---------------------------------------------------------------------------
const AdminLayout = lazy(() => import('./paginas/admin/AdminLayout'));
const AdminLogin = lazy(() => import('./paginas/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./paginas/admin/AdminDashboard'));
const AdminTalleres = lazy(() => import('./paginas/admin/AdminTalleres'));
const AdminTallerForm = lazy(() => import('./paginas/admin/AdminTallerForm'));
const AdminReservaciones = lazy(() => import('./paginas/admin/AdminReservaciones'));
const AdminPagos = lazy(() => import('./paginas/admin/AdminPagos'));
const AdminProspectos = lazy(() => import('./paginas/admin/AdminProspectos'));

function CargandoPanel() {
  return (
    <div className="contenedor py-32 text-center">
      <p className="dato text-tinta/45">Cargando panel…</p>
    </div>
  );
}

export default function App() {
  // Sin las variables de Supabase no hay nada que mostrar: mejor decir qué
  // falta que servir una pagina en blanco.
  if (!configurado) return <SinConfigurar />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<CargandoPanel />}>
        <Routes>
          {/* Sitio público. Los clientes NUNCA crean cuenta. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/talleres" element={<Talleres />} />
            <Route path="/talleres/:slug" element={<TallerDetalle />} />
            <Route path="/membresia" element={<Membresia />} />
            {/* /nosotras ya no existe como pagina: su contenido vive en
                Inicio. Se redirige para no romper enlaces viejos. */}
            <Route path="/nosotras" element={<Navigate to="/#nosotras" replace />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/reserva/:code" element={<Reserva />} />
            <Route path="/pago/exitoso" element={<PagoExitoso />} />
            <Route path="/pago/cancelado" element={<PagoCancelado />} />
            <Route path="*" element={<NoEncontrado />} />
          </Route>

          {/* Panel. El login queda fuera del guardián, por razones obvias. */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={<RequiereAdmin><AdminLayout /></RequiereAdmin>}
          >
            <Route index element={<AdminDashboard />} />
            <Route path="talleres" element={<AdminTalleres />} />
            <Route path="talleres/nuevo" element={<AdminTallerForm />} />
            <Route path="talleres/:id" element={<AdminTallerForm />} />
            <Route path="reservaciones" element={<AdminReservaciones />} />
            <Route path="pagos" element={<AdminPagos />} />
            <Route path="prospectos" element={<AdminProspectos />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
