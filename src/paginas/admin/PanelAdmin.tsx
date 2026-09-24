import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider, RequiereAdmin } from '../../features/admin/auth';

// ---------------------------------------------------------------------------
// El panel completo vive en su propio chunk, con la sesión de administración
// y el cliente de Supabase adentro. Quien abre el sitio público no descarga
// nada de esto.
// ---------------------------------------------------------------------------
const AdminLayout = lazy(() => import('./AdminLayout'));
const AdminLogin = lazy(() => import('./AdminLogin'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const AdminTalleres = lazy(() => import('./AdminTalleres'));
const AdminTallerForm = lazy(() => import('./AdminTallerForm'));
const AdminReservaciones = lazy(() => import('./AdminReservaciones'));
const AdminPagos = lazy(() => import('./AdminPagos'));
const AdminProspectos = lazy(() => import('./AdminProspectos'));

export default function PanelAdmin() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<RequiereAdmin><AdminLayout /></RequiereAdmin>}>
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
  );
}
