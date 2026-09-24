import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { repo, ErrorDatos } from '../../datos';
import { useSesion } from '../../features/cuenta/sesion';
import SectionHeading from '../SectionHeading';
import { Boton, BotonEnlace } from '../base/Boton';
import { Aviso, Campo } from '../base/Campos';
import Revelar from '../base/Revelar';
import { IconoU } from '../marca/Logo';

/**
 * Registro y novedades: dos cosas distintas, dos formularios distintos.
 * Crear cuenta NO suscribe a correos; suscribirse NO crea cuenta.
 */
export default function Comunidad({ numero }: { numero?: string }) {
  const { usuario } = useSesion();

  return (
    <section className="relative isolate overflow-hidden bg-terracota/[0.14] py-seccion" aria-labelledby="titulo-comunidad">
      <IconoU className="pointer-events-none absolute -right-16 top-1/2 -z-10 h-[34rem] w-auto -translate-y-1/2 text-crema/60" />
      <div className="contenedor">
        <SectionHeading
          numero={numero}
          eyebrow="Comunidad NUMA"
          titulo={<span id="titulo-comunidad">Sé parte de nuestra comunidad creativa.</span>}
          intro={<p>Crea tu cuenta para organizar tus próximas experiencias y recibe las novedades de Casa Numa.</p>}
          tamano="t2"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          <Revelar className="flex flex-col rounded-suave bg-crema p-7 sm:p-10">
            <p className="cifra text-[1.1rem] text-cafe/60">01 · Tu cuenta</p>
            <h3 className="mt-4 font-display text-t3 font-light">
              {usuario ? `Hola, ${usuario.nombre.split(' ')[0]}.` : 'Tus reservas, en un solo lugar.'}
            </h3>
            <p className="mt-3 max-w-[40ch] text-cuerpo text-cafe/80">
              Consulta tus próximas experiencias, tus clases de membresía y tu historial.
            </p>
            <div className="mt-auto pt-8">
              {usuario ? (
                <BotonEnlace to="/cuenta" flecha>Ir a mi cuenta</BotonEnlace>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                  <BotonEnlace to="/cuenta/registro" flecha>Crear mi cuenta</BotonEnlace>
                  <Link to="/cuenta/entrar" className="subrayado-fijo pb-0.5 text-nota">Ya tengo cuenta</Link>
                </div>
              )}
            </div>
          </Revelar>

          <Revelar retraso={0.08} className="rounded-suave border border-cafe/15 p-7 sm:p-10">
            <p className="cifra text-[1.1rem] text-cafe/60">02 · Novedades</p>
            <h3 className="mt-4 font-display text-t3 font-light">Nuevas fechas, antes que nadie.</h3>
            <FormNovedades />
          </Revelar>
        </div>
      </div>
    </section>
  );
}

export function FormNovedades() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo'>('inicial');
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    try {
      await repo.suscribirNovedades(email);
      setEstado('listo');
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No pudimos suscribirte. Intenta de nuevo.');
      setEstado('inicial');
    }
  }

  if (estado === 'listo') {
    return (
      <div className="mt-6">
        <Aviso tipo="exito">Listo. Te escribiremos a {email.trim()} cuando haya novedades.</Aviso>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-6" noValidate>
      <Campo
        id="novedades-correo"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        required
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Boton type="submit" variante="secundario" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Enviando…' : 'Quiero recibir novedades'}
        </Boton>
        <p className="max-w-[26ch] text-[0.72rem] leading-snug text-cafe/65">
          Al suscribirte aceptas el <Link to="/aviso-de-privacidad" className="underline underline-offset-2">aviso de privacidad</Link>.
        </p>
      </div>
    </form>
  );
}
