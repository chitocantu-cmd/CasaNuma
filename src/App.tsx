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

import AdminLayout from './paginas/admin/AdminLayout';
import AdminLogin from './paginas/admin/AdminLogin';
import AdminDashboard from './paginas/admin/AdminDashboard';
import AdminTalleres from './paginas/admin/AdminTalleres';
import AdminTallerForm from './paginas/admin/AdminTallerForm';
import AdminReservaciones from './paginas/admin/AdminReservaciones';
import AdminPagos from './paginas/admin/AdminPagos';
import AdminProspectos from './paginas/admin/AdminProspectos';

export default function App() {
  // Sin las variables de Supabase no hay nada que mostrar: mejor decir qué
  // falta que servir una pagina en blanco.
  if (!configurado) return <SinConfigurar />;

  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
