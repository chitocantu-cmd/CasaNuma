import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorDatos } from '../../datos';
import type { Contacto } from '../../datos/tipos';
import { CUENTA_DEMO } from '../../datos/demo/repoDemo';
import { fuenteDatos } from '../../config/site';
import { useSesion } from '../../features/cuenta/sesion';
import { correoValido, soloDigitos } from '../../lib/formato';
import { Boton } from '../base/Boton';
import { Aviso, Campo, Casilla } from '../base/Campos';

/**
 * Tus datos + tu cuenta, en una sola pantalla.
 *
 * Con sesión: se confirman los datos de contacto y se sigue.
 * Sin sesión: crear cuenta (nombre, correo, teléfono, contraseña) o entrar.
 * La casilla de novedades es opcional, va sin marcar y está separada.
 */
export default function PasoCuenta({
  titulo = 'Tus datos',
  nota,
  onListo,
}: {
  titulo?: string;
  nota?: string;
  onListo: (contacto: Contacto) => void;
}) {
  const { usuario, entrar, registrar } = useSesion();
  const [modo, setModo] = useState<'crear' | 'entrar'>('crear');
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [novedades, setNovedades] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** Cuenta creada que espera la confirmación del correo. */
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // La sesión puede resolverse después de montar: rellenar sin pisar lo escrito.
  useEffect(() => {
    if (!usuario) return;
    setNombre((n) => n || usuario.nombre);
    setTelefono((t) => t || usuario.telefono);
  }, [usuario]);

  async function continuar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Con sesión: solo confirmar datos de contacto.
    if (usuario) {
      const errs: Record<string, string> = {};
      if (!nombre.trim()) errs.nombre = 'Escribe tu nombre.';
      if (soloDigitos(telefono).length < 10) errs.telefono = 'Tu teléfono necesita 10 dígitos.';
      setErrores(errs);
      if (Object.keys(errs).length) return;
      onListo({ nombre: nombre.trim(), email: usuario.email, telefono: telefono.trim() });
      return;
    }

    const errs: Record<string, string> = {};
    if (modo === 'crear') {
      if (!nombre.trim()) errs.nombre = 'Escribe tu nombre.';
      if (soloDigitos(telefono).length < 10) errs.telefono = 'Tu teléfono necesita 10 dígitos.';
    }
    if (!correoValido(email)) errs.email = 'Revisa tu correo, parece incompleto.';
    if (modo === 'crear' && password.length < 8) errs.password = 'Usa al menos 8 caracteres.';
    if (modo === 'entrar' && !password) errs.password = 'Escribe tu contraseña.';
    setErrores(errs);
    if (Object.keys(errs).length) return;

    setEnviando(true);
    try {
      const u =
        modo === 'crear'
          ? await registrar({ nombre, email, telefono, password, novedades })
          : await entrar(email, password);
      onListo({ nombre: u.nombre, email: u.email, telefono: u.telefono });
    } catch (err) {
      // Cuenta creada que espera confirmar el correo: el enlace la trae de
      // vuelta a esta página, ya con sesión.
      if (err instanceof ErrorDatos && err.codigo === 'CONFIRMAR_CORREO') {
        setPorConfirmar(err.message);
        setModo('entrar');
        return;
      }
      setError(err instanceof ErrorDatos ? err.message : 'Algo salió mal. Intenta de nuevo.');
      if (err instanceof ErrorDatos && err.codigo === 'CORREO_REGISTRADO') setModo('entrar');
    } finally {
      setEnviando(false);
    }
  }

  if (usuario) {
    return (
      <form onSubmit={continuar} noValidate>
        <h2 className="font-display text-t3 font-light">{titulo}</h2>
        <p className="mt-3 text-cuerpo text-cafe/75">
          Reservas con tu cuenta <strong className="font-medium text-cafe">{usuario.email}</strong>. Confirma cómo te
          contactamos.
        </p>
        {nota && <p className="mt-2 text-nota text-cafe/65">{nota}</p>}
        <div className="mt-8 grid gap-7 sm:grid-cols-2">
          <Campo id="c-nombre" label="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" error={errores.nombre} />
          <Campo id="c-telefono" label="WhatsApp" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" placeholder="81 0000 0000" error={errores.telefono} />
        </div>
        <Boton type="submit" className="mt-10" flecha>Continuar al pago</Boton>
      </form>
    );
  }

  return (
    <form onSubmit={continuar} noValidate>
      <h2 className="font-display text-t3 font-light">{titulo}</h2>
      <p className="mt-3 max-w-lectura text-cuerpo text-cafe/75">
        Tu cuenta guarda tus reservas: ahí consultas fechas, horarios y el estado de tu pago.
      </p>
      {nota && <p className="mt-2 text-nota text-cafe/65">{nota}</p>}

      <div className="mt-8 inline-flex rounded-full border border-cafe/20 p-1" role="tablist" aria-label="Cuenta">
        {(['crear', 'entrar'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => { setModo(m); setErrores({}); setError(null); }}
            className={`min-h-10 rounded-full px-5 text-[0.78rem] transition-colors ${modo === m ? 'bg-cafe text-crema' : 'text-cafe/75 hover:text-cafe'}`}
          >
            {m === 'crear' ? 'Crear cuenta' : 'Ya tengo cuenta'}
          </button>
        ))}
      </div>

      {porConfirmar && !error && <div className="mt-6"><Aviso tipo="info">{porConfirmar}</Aviso></div>}
      {error && <div className="mt-6"><Aviso>{error}</Aviso></div>}

      <div className="mt-8 grid gap-7 sm:grid-cols-2">
        {modo === 'crear' && (
          <>
            <Campo id="c-nombre" label="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" error={errores.nombre} />
            <Campo id="c-telefono" label="WhatsApp" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" placeholder="81 0000 0000" error={errores.telefono} />
          </>
        )}
        <Campo id="c-email" label="Correo" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" error={errores.email} />
        <Campo
          id="c-password" label="Contraseña" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          error={errores.password}
          ayuda={modo === 'crear' ? 'Mínimo 8 caracteres.' : undefined}
        />
      </div>

      {modo === 'crear' ? (
        <div className="mt-8 space-y-4">
          <Casilla id="c-novedades" checked={novedades} onChange={(e) => setNovedades(e.target.checked)}>
            Quiero recibir novedades de Casa Numa por correo. <span className="text-cafe/55">(Opcional)</span>
          </Casilla>
          <p className="text-[0.74rem] text-cafe/60">
            Al crear tu cuenta aceptas el <Link to="/aviso-de-privacidad" className="underline underline-offset-2">aviso de privacidad</Link> y
            los <Link to="/terminos" className="underline underline-offset-2">términos</Link>.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/cuenta/recuperar" className="subrayado-fijo pb-0.5 text-nota">¿Olvidaste tu contraseña?</Link>
          {fuenteDatos === 'demo' && (
            <button
              type="button"
              onClick={() => { setEmail(CUENTA_DEMO.email); setPassword(CUENTA_DEMO.password); }}
              className="text-[0.74rem] text-indigo underline underline-offset-2"
            >
              Usar la cuenta de demostración
            </button>
          )}
        </div>
      )}

      <Boton type="submit" className="mt-10" disabled={enviando} flecha={!enviando}>
        {enviando ? 'Un momento…' : modo === 'crear' ? 'Crear cuenta y continuar' : 'Entrar y continuar'}
      </Boton>
    </form>
  );
}
