import { useState } from 'react';
import { enviarFormulario } from '../services/forms';
import { ErrorApi } from '../services/api';
import { correoValido, soloDigitos } from '../lib/formato';
import { useTitulo } from '../features/workshops/hooks';
import { useConfig } from '../componentes/Layout';
import { Boton, Campo, AreaTexto, Aviso, ImagenPendiente } from '../componentes/ui';

export default function Contacto() {
  useTitulo('Contacto', 'Escríbenos: dudas, cotizaciones y eventos privados en Casa Numa.');
  const config = useConfig();

  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Campo trampa: los humanos no lo ven, los robots lo llenan.
  const [trampa, setTrampa] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('Falta tu nombre.');
    if (!correoValido(email)) return setError('Revisa el correo, parece incompleto.');
    if (!mensaje.trim()) return setError('Cuéntanos en qué te ayudamos.');
    if (whatsapp && soloDigitos(whatsapp).length < 10) {
      return setError('El WhatsApp necesita 10 dígitos.');
    }

    setError(null);
    setEnviando(true);
    try {
      await enviarFormulario('contacto', {
        name: nombre.trim(),
        email: email.trim(),
        phone: whatsapp.trim(),
        message: mensaje.trim(),
        company: trampa,
      });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No pudimos enviar tu mensaje. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pb-24 pt-32 sm:pt-40">
      <section className="contenedor">
        <h1 className="titular max-w-3xl">Escríbenos</h1>

        <div className="mt-16 grid gap-14 lg:grid-cols-12">
          {/* Datos */}
          <div className="lg:col-span-4">
            <h2 className="dato mb-4 border-b border-tinta/12 pb-3 text-tinta/45">Dónde estamos</h2>
            <p className="text-[0.95rem] leading-relaxed text-tinta/75">
              {config?.direccion_linea1 ?? '[PENDIENTE: calle y número]'}
              <br />
              {config?.direccion_linea2 ?? '[PENDIENTE: colonia, ciudad]'}
            </p>

            <h2 className="dato mb-4 mt-10 border-b border-tinta/12 pb-3 text-tinta/45">Contacto</h2>
            <ul className="space-y-2 text-[0.95rem] text-tinta/75">
              <li>{config?.whatsapp ?? '[PENDIENTE: WhatsApp]'}</li>
              <li>{config?.email ?? '[PENDIENTE: correo]'}</li>
            </ul>
          </div>

          {/* Formulario */}
          <div className="lg:col-span-7 lg:col-start-6">
            {enviado ? (
              <div className="border border-olivo/40 bg-olivo/8 p-8">
                <p className="font-display text-[1.6rem] leading-tight">Recibimos tu mensaje.</p>
                <p className="mt-3 text-tinta/70">
                  Te contestamos por WhatsApp o correo, normalmente el mismo día.
                </p>
              </div>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
                {error && <Aviso>{error}</Aviso>}

                <Campo id="c-nombre" label="Nombre" requerido value={nombre}
                  onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
                <Campo id="c-whatsapp" label="WhatsApp" type="tel" value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="81 0000 0000" autoComplete="tel" />
                <Campo id="c-correo" label="Correo" requerido type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com" autoComplete="email" />
                <AreaTexto id="c-mensaje" label="Mensaje" requerido value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="¿En qué te ayudamos?" />

                {/* Honeypot: oculto para personas, visible para robots. */}
                <input
                  type="text" name="empresa" tabIndex={-1} autoComplete="off"
                  value={trampa} onChange={(e) => setTrampa(e.target.value)}
                  aria-hidden="true"
                  className="absolute left-[-9999px] h-px w-px opacity-0"
                />

                <Boton type="submit" disabled={enviando} className="w-full sm:w-fit">
                  {enviando ? 'Enviando…' : 'Enviar mensaje'}
                </Boton>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="contenedor mt-20">
        {config?.mapa_embed_url ? (
          <iframe
            title="Ubicación de Casa Numa"
            src={config.mapa_embed_url}
            loading="lazy"
            className="h-[26rem] w-full border border-tinta/15"
          />
        ) : (
          <div>
            <ImagenPendiente
              encuadre="fachada del estudio desde la banqueta"
              tono="olivo"
              alt="Fachada de Casa Numa"
              className="aspect-[16/7] w-full"
            />
            <p className="mt-3 text-[0.8rem] text-tinta/50">
              El mapa se activa cuando se cargue la dirección en configuración.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
