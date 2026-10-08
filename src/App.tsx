import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import Layout from './componentes/layout/Layout';
import LimiteError from './componentes/base/LimiteError';
import { fuenteDatos } from './config/site';
import { SesionProvider } from './features/cuenta/sesion';
import SinConfigurar from './paginas/SinConfigurar';
import Inicio from './paginas/Inicio';
import { CargandoPagina } from './componentes/base/Cargando';

// ---------------------------------------------------------------------------
// La portada va en el bundle principal; todo lo demás se carga al entrar.
// Quien abre el sitio desde Instagram en su teléfono no descarga el flujo de
// membresía, la tienda ni el panel hasta que los necesita.
// ---------------------------------------------------------------------------
const Talleres = lazy(() => import('./paginas/Talleres'));
const ReservarTaller = lazy(() => import('./paginas/ReservarTaller'));
const Membresia = lazy(() => import('./paginas/Membresia'));
const ReservarMembresia = lazy(() => import('./paginas/ReservarMembresia'));
const Kids = lazy(() => import('./paginas/Kids'));
const ReservarKids = lazy(() => import('./paginas/ReservarKids'));
const PintaTuPieza = lazy(() => import('./paginas/PintaTuPieza'));
const ReservarPinta = lazy(() => import('./paginas/ReservarPinta'));
const Eventos = lazy(() => import('./paginas/Eventos'));
const Tienda = lazy(() => import('./paginas/Tienda'));
const Producto = lazy(() => import('./paginas/Producto'));
const Nosotras = lazy(() => import('./paginas/Nosotras'));
const Cuenta = lazy(() => import('./paginas/cuenta/Cuenta'));
const Acceso = lazy(() => import('./paginas/cuenta/Acceso'));
const Legal = lazy(() => import('./paginas/Legal'));
const NoEncontrado = lazy(() => import('./paginas/NoEncontrado'));

// La presentación de un solo archivo (npm run presentacion) no tiene servidor:
// usa rutas con # y deja fuera todo lo que necesita Supabase.
const SIN_BACKEND = import.meta.env.VITE_SIN_BACKEND === 'true';
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

// Estado de pago con Stripe (backend real). Siguen vivas porque los correos
// de confirmación y Stripe redirigen aquí.
const Reserva = SIN_BACKEND ? null : lazy(() => import('./paginas/Reserva'));
const PagoExitoso = SIN_BACKEND ? null : lazy(() => import('./paginas/PagoExitoso'));
const PagoCancelado = SIN_BACKEND ? null : lazy(() => import('./paginas/PagoCancelado'));

// Panel administrativo: aparte, solo para el equipo. Habla con el mismo
// repositorio que el sitio: en la demo, con los datos locales (funciona incluso
// en la presentación); con fuenteDatos = 'supabase', con la base real.
const PanelAdmin = fuenteDatos !== 'demo' && SIN_BACKEND ? null : lazy(() => import('./paginas/panel/Panel'));
const panelConBackend = fuenteDatos !== 'demo';

// Se lee de las variables en vez de importar el cliente de Supabase: así el
// cliente (y su peso) solo se descarga en las rutas que lo usan.
const configurado = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

function Cargando() {
  return <CargandoPagina />;
}

/** Direcciones con parámetro que cambiaron de nombre (p. ej. /store/:slug). */
function Redirigir({ a }: { a: string }) {
  const { slug = '' } = useParams();
  return <Navigate to={a.replace(':slug', slug)} replace />;
}

/** Lo que depende de Supabase explica qué falta en vez de fallar en blanco. */
function ConBackend({ children }: { children: ReactNode }) {
  return configurado ? <>{children}</> : <SinConfigurar />;
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LimiteError>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <SesionProvider>
            <Suspense fallback={<Cargando />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Inicio />} />
                  <Route path="/talleres" element={<Talleres />} />
                  <Route path="/talleres/:slug" element={<ReservarTaller />} />
                  <Route path="/membresia" element={<Membresia />} />
                  <Route path="/membresia/reservar" element={<ReservarMembresia />} />
                  <Route path="/numa-kids" element={<Kids />} />
                  <Route path="/numa-kids/reservar" element={<ReservarKids />} />
                  <Route path="/pinta-tu-pieza" element={<PintaTuPieza />} />
                  <Route path="/pinta-tu-pieza/reservar" element={<ReservarPinta />} />
                  <Route path="/eventos" element={<Eventos />} />
                  <Route path="/numa-store" element={<Tienda />} />
                  <Route path="/numa-store/:slug" element={<Producto />} />
                  <Route path="/nosotras" element={<Nosotras />} />
                  <Route path="/cuenta" element={<Cuenta />} />
                  <Route path="/cuenta/entrar" element={<Acceso modo="entrar" />} />
                  <Route path="/cuenta/registro" element={<Acceso modo="registro" />} />
                  <Route path="/cuenta/recuperar" element={<Acceso modo="recuperar" />} />
                  <Route path="/cuenta/nueva-contrasena" element={<Acceso modo="nueva" />} />
                  <Route path="/aviso-de-privacidad" element={<Legal documento="privacidad" />} />
                  <Route path="/terminos" element={<Legal documento="terminos" />} />
                  <Route path="/politica-de-reservaciones" element={<Legal documento="reservaciones" />} />

                  {/* Direcciones del sitio anterior y nombres comunes */}
                  <Route path="/contacto" element={<Navigate to="/#ubicacion" replace />} />
                  <Route path="/ubicacion" element={<Navigate to="/#ubicacion" replace />} />
                  <Route path="/kids" element={<Navigate to="/numa-kids" replace />} />
                  <Route path="/pinta" element={<Navigate to="/pinta-tu-pieza" replace />} />
                  <Route path="/pinta-tu-pieza/reserva" element={<Navigate to="/pinta-tu-pieza/reservar" replace />} />
                  <Route path="/tienda" element={<Navigate to="/numa-store" replace />} />
                  <Route path="/store" element={<Navigate to="/numa-store" replace />} />
                  <Route path="/store/:slug" element={<Redirigir a="/numa-store/:slug" />} />
                  <Route path="/tienda/:slug" element={<Redirigir a="/numa-store/:slug" />} />
                  <Route path="/checkout" element={<Navigate to="/talleres" replace />} />
                  <Route path="/login" element={<Navigate to="/cuenta/entrar" replace />} />
                  <Route path="/registro" element={<Navigate to="/cuenta/registro" replace />} />
                  <Route path="/recuperar-password" element={<Navigate to="/cuenta/recuperar" replace />} />
                  <Route path="/mi-cuenta" element={<Navigate to="/cuenta" replace />} />
                  <Route path="/mi-cuenta/reservas" element={<Navigate to="/cuenta#proximas" replace />} />
                  <Route path="/mi-cuenta/membresia" element={<Navigate to="/cuenta#membresia" replace />} />
                  <Route path="/mi-cuenta/perfil" element={<Navigate to="/cuenta#perfil" replace />} />

                  {Reserva && <Route path="/reserva/:code" element={<ConBackend><Reserva /></ConBackend>} />}
                  {PagoExitoso && <Route path="/pago/exitoso" element={<ConBackend><PagoExitoso /></ConBackend>} />}
                  {PagoCancelado && <Route path="/pago/cancelado" element={<ConBackend><PagoCancelado /></ConBackend>} />}
                  <Route path="*" element={<NoEncontrado />} />
                </Route>

                {PanelAdmin && (
                  <Route path="/admin/*" element={panelConBackend ? <ConBackend><PanelAdmin /></ConBackend> : <PanelAdmin />} />
                )}
              </Routes>
            </Suspense>
          </SesionProvider>
        </MotionConfig>
      </LazyMotion>
      </LimiteError>
    </Router>
  );
}
