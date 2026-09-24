import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { repo, ErrorDatos } from '../../datos';
import { CUENTA_DEMO } from '../../datos/demo/repoDemo';
import { fuenteDatos } from '../../config/site';
import { useSesion } from '../../features/cuenta/sesion';
import { correoValido, soloDigitos } from '../../lib/formato';
import { useSeo } from '../../lib/seo';
import Foto from '../../componentes/base/Foto';
import { Boton } from '../../componentes/base/Boton';
import { Aviso, Campo, Casilla } from '../../componentes/base/Campos';
import { Logo } from '../../componentes/marca/Logo';

type Modo = 'entrar' | 'registro' | 'recuperar';

const TITULOS: Record<Modo, { h1: string; seo: string; bajada: string }> = {
  entrar: { h1: 'Qué gusto verte de nuevo.', seo: 'Iniciar sesión', bajada: 'Entra para ver tus reservas y tus clases de membresía.' },
  registro: {
    h1: 'Crea tu cuenta.',
    seo: 'Crear cuenta',
    bajada: 'Organiza tus próximas experiencias: tus reservas, tus clases y tu historial, en un solo lugar.',
  },
  recuperar: { h1: 'Recupera tu contraseña.', seo: 'Recuperar contraseña', bajada: 'Escribe tu correo y te enviamos un enlace para crear una nueva.' },
};

export default function Acceso({ modo }: { modo: Modo }) {
  const t = TITULOS[modo];
  useSeo({ titulo: `${t.seo} | Casa Numa`, descripcion: t.bajada, indexar: false });

  const { usuario, entrar, registrar } = useSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/cuenta';

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [novedades, setNovedades] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  if (usuario && modo !== 'recuperar') return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (modo === 'registro' && !nombre.trim()) errs.nombre = 'Escribe tu nombre.';
    if (!correoValido(email)) errs.email = 'Revisa tu correo, parece incompleto.';
    if (modo === 'registro' && soloDigitos(telefono).length < 10) errs.telefono = 'Tu teléfono necesita 10 dígitos.';
    if (modo === 'registro' && password.length < 8) errs.password = 'Usa al menos 8 caracteres.';
    if (modo === 'entrar' && !password) errs.password = 'Escribe tu contraseña.';
    setErrores(errs);
    if (Object.keys(errs).length) return;

    setEnviando(true);
    setError(null);
    try {
      if (modo === 'entrar') await entrar(email, password);
      else if (modo === 'registro') await registrar({ nombre, email, telefono, password, novedades });
      else {
        await repo.recuperarPassword(email);
        setEnviado(true);
        return;
      }
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'Algo salió mal. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="contenedor grid min-h-[100svh] gap-12 pb-seccion-s pt-[calc(theme(spacing.header)+3rem)] lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="eyebrow text-cafe/65">Mi cuenta</p>
        <h1 className="mt-5 font-display text-t1 font-light">{t.h1}</h1>
        <p className="mt-5 max-w-lectura text-cuerpo-l text-cafe/80">{t.bajada}</p>

        {enviado ? (
          <div className="mt-10 space-y-6">
            <Aviso tipo="exito">
              Si hay una cuenta con {email.trim()}, te llegará un enlace para crear una nueva contraseña.
              {fuenteDatos === 'demo' && ' (En la demo no se envía ningún correo.)'}
            </Aviso>
            <Link to="/cuenta/entrar" className="subrayado-fijo inline-block pb-0.5 text-nota">Volver a iniciar sesión</Link>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-10 space-y-7" noValidate>
            {error && <Aviso>{error}</Aviso>}
            {modo === 'registro' && (
              <Campo id="a-nombre" label="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" error={errores.nombre} />
            )}
            <Campo id="a-email" label="Correo" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" error={errores.email} />
            {modo === 'registro' && (
              <Campo id="a-telefono" label="WhatsApp" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" placeholder="81 0000 0000" error={errores.telefono} />
            )}
            {modo !== 'recuperar' && (
              <Campo
                id="a-password" label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
                error={errores.password} ayuda={modo === 'registro' ? 'Mínimo 8 caracteres.' : undefined}
              />
            )}

            {modo === 'registro' && (
              <div className="space-y-4">
                <Casilla id="a-novedades" checked={novedades} onChange={(e) => setNovedades(e.target.checked)}>
                  Quiero recibir novedades de Casa Numa por correo. <span className="text-cafe/55">(Opcional)</span>
                </Casilla>
                <p className="text-[0.74rem] text-cafe/60">
                  Al crear tu cuenta aceptas el <Link to="/aviso-de-privacidad" className="underline underline-offset-2">aviso de privacidad</Link> y
                  los <Link to="/terminos" className="underline underline-offset-2">términos</Link>.
                </p>
              </div>
            )}

            <Boton type="submit" disabled={enviando} flecha={!enviando} className="w-full sm:w-auto">
              {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : modo === 'registro' ? 'Crear mi cuenta' : 'Enviar enlace'}
            </Boton>

            <div className="flex flex-col gap-3 border-t border-cafe/12 pt-6 text-nota text-cafe/75">
              {modo === 'entrar' && (
                <>
                  <Link to="/cuenta/recuperar" className="subrayado-fijo self-start pb-0.5">¿Olvidaste tu contraseña?</Link>
                  <p>¿Primera vez? <Link to="/cuenta/registro" state={location.state} className="subrayado-fijo pb-0.5 text-cafe">Crea tu cuenta</Link></p>
                </>
              )}
              {modo === 'registro' && (
                <p>¿Ya tienes cuenta? <Link to="/cuenta/entrar" state={location.state} className="subrayado-fijo pb-0.5 text-cafe">Inicia sesión</Link></p>
              )}
              {modo === 'recuperar' && <Link to="/cuenta/entrar" className="subrayado-fijo self-start pb-0.5">Volver a iniciar sesión</Link>}
            </div>

            {modo === 'entrar' && fuenteDatos === 'demo' && (
              <div className="rounded-suave border border-dashed border-indigo/40 p-4 text-[0.78rem] text-indigo">
                Cuenta de demostración con una membresía a la mitad: {CUENTA_DEMO.email} · {CUENTA_DEMO.password}
                <button type="button" onClick={() => { setEmail(CUENTA_DEMO.email); setPassword(CUENTA_DEMO.password); }}
                  className="ml-2 underline underline-offset-2">Usarla</button>
              </div>
            )}
          </form>
        )}
      </div>

      <div className="relative hidden lg:col-span-6 lg:col-start-7 lg:block">
        <div className="sticky top-28">
          <Foto id="cuenta-acceso" className="aspect-[4/5] w-full rounded-arco" sizes="45vw" />
          <Logo className="absolute bottom-8 left-8 h-20 w-auto text-crema" titulo="" />
        </div>
      </div>
    </section>
  );
}
