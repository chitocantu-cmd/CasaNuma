import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/admin/auth';
import { Boton, Campo, Aviso } from '../../componentes/ui';
import { useTitulo } from '../../features/workshops/hooks';

export default function AdminLogin() {
  useTitulo('Acceso al panel');

  const { entrar, session, esAdmin, cargando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión válida, no tiene sentido mostrar el formulario.
  useEffect(() => {
    if (!cargando && session && esAdmin) {
      navigate(location.state?.from ?? '/admin', { replace: true });
    }
  }, [cargando, session, esAdmin, navigate, location.state]);

  if (!cargando && session && esAdmin) {
    return <Navigate to={location.state?.from ?? '/admin'} replace />;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await entrar(email.trim(), password);
      // El guardián de ruta se encarga de verificar admin_profiles; si el
      // usuario existe pero no es admin, verá el aviso de abajo.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  const sesionSinPermiso = Boolean(session) && !esAdmin && !cargando;

  return (
    <div className="contenedor flex min-h-screen max-w-sm flex-col justify-center py-20">
      <p className="dato text-tinta/45">Casa Numa</p>
      <h1 className="mt-3 font-display text-[2.2rem] leading-tight">Panel</h1>
      <p className="mt-3 text-[0.95rem] text-tinta/60">
        Acceso solo para el equipo. Los clientes reservan sin crear cuenta.
      </p>

      {sesionSinPermiso && (
        <div className="mt-6">
          <Aviso>
            Tu cuenta no tiene permisos de administración. Pide que te agreguen
            a <code>admin_profiles</code>.
          </Aviso>
        </div>
      )}

      <form onSubmit={enviar} className="mt-8 flex flex-col gap-6" noValidate>
        {error && <Aviso>{error}</Aviso>}

        <Campo id="admin-email" label="Correo" type="email" requerido
          value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="username" placeholder="tu@casanuma.mx" />
        <Campo id="admin-password" label="Contraseña" type="password" requerido
          value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" placeholder="••••••••" />

        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>
    </div>
  );
}
