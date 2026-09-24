import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorDatos, repoAdmin } from '../../datos';
import { ADMIN_DEMO, CUENTA_DEMO } from '../../datos/demo/repoDemo';
import { fuenteDatos } from '../../config/site';
import { Logo } from '../../componentes/marca/Logo';
import { Boton } from '../../componentes/base/Boton';
import { Aviso, Campo } from '../../componentes/base/Campos';

export default function PanelEntrar() {
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    repoAdmin.adminActual().then((a) => a && navigate(destino, { replace: true })).catch(() => undefined);
  }, [navigate, destino]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await repoAdmin.entrarAdmin(email, password);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No pudimos iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-crema px-4 py-16 text-cafe">
      <div className="w-full max-w-sm">
        <Logo className="h-14 w-auto" titulo="Casa Numa" />
        <p className="eyebrow mt-10 text-cafe/60">Casa Numa</p>
        <h1 className="mt-3 font-display text-[2.2rem] font-light leading-tight">Panel de administración</h1>
        <p className="mt-3 text-nota text-cafe/70">Acceso solo para el equipo. Las cuentas de clientas no entran aquí.</p>

        <form onSubmit={entrar} className="mt-10 space-y-7" noValidate>
          {error && <Aviso>{error}</Aviso>}
          <Campo id="p-email" label="Correo" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo id="p-pass" label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Boton type="submit" className="w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar al panel'}</Boton>
        </form>

        {fuenteDatos === 'demo' && (
          <div className="mt-8 space-y-2 rounded-suave border border-dashed border-indigo/40 p-4 text-[0.78rem] text-indigo">
            <p>
              <strong className="font-medium">Cuenta del equipo (demo):</strong> {ADMIN_DEMO.email} · {ADMIN_DEMO.password}{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => { setEmail(ADMIN_DEMO.email); setPassword(ADMIN_DEMO.password); }}>
                Usarla
              </button>
            </p>
            <p className="text-indigo/80">Prueba entrar con la de clienta ({CUENTA_DEMO.email}): el panel la rechaza.</p>
          </div>
        )}
      </div>
    </div>
  );
}
