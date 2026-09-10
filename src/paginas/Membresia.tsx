import { useState } from 'react';
import { enviarFormulario } from '../services/forms';
import { ErrorApi } from '../services/api';
import { correoValido, soloDigitos } from '../lib/formato';
import { useTitulo } from '../features/workshops/hooks';
import { Boton, Campo, AreaTexto, Aviso, ImagenPendiente } from '../componentes/ui';

const INTERESES = [
  { id: 'ceramica', label: 'Cerámica' },
  { id: 'pintura', label: 'Pintura' },
  { id: 'libre', label: 'Taller libre' },
  { id: 'especiales', label: 'Especiales' },
];

const BENEFICIOS = [
  'Sesiones abiertas cada semana para que la práctica no dependa de encontrar un hueco en la agenda.',
  'Técnicas nuevas cada temporada: esmaltes, torno, engobes, cocciones distintas.',
  'Actividades solo para miembros y prioridad cuando abrimos fechas nuevas.',
];

export default function Membresia() {
  useTitulo(
    'Membresía',
    'Practica cada semana en Casa Numa, con prioridad en fechas nuevas y actividades solo para miembros.',
  );

  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [intereses, setIntereses] = useState<string[]>([]);
  const [trampa, setTrampa] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternar(id: string) {
    setIntereses((v) => (v.includes(id) ? v.filter((i) => i !== id) : [...v, id]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('Falta tu nombre.');
    if (!correoValido(email)) return setError('Revisa el correo, parece incompleto.');
    if (whatsapp && soloDigitos(whatsapp).length < 10) {
      return setError('El WhatsApp necesita 10 dígitos.');
    }

    setError(null);
    setEnviando(true);
    try {
      await enviarFormulario('membresia', {
        name: nombre.trim(),
        email: email.trim(),
        phone: whatsapp.trim(),
        message: mensaje.trim(),
        interests: intereses,
        company: trampa,
      });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No pudimos enviar tus datos. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pb-24 pt-32 sm:pt-40">
      <section className="contenedor">
        <h1 className="titular max-w-4xl">
          Para quien
          <br />
          vuelve cada
          <br />
          semana.
        </h1>

        <div className="mt-14 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ImagenPendiente
              encuadre="mesa larga con miembros trabajando en sus piezas"
              tono="olivo"
              alt="La comunidad de Casa Numa"
              className="aspect-[16/10] w-full"
            />
          </div>
          <div className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
            <ul className="space-y-5">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex gap-3 text-[1rem] leading-relaxed text-tinta/75">
                  <span className="text-terracota">·</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="contenedor mt-20">
        <div className="grid gap-12 border-t border-tinta/15 pt-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-display text-[2rem] leading-tight">Cuéntanos de ti</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-tinta/65">
              Todavía estamos armando los planes. Déjanos tus datos y te
              avisamos en cuanto abramos lugares, antes que a nadie.
            </p>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            {enviado ? (
              <div className="border border-olivo/40 bg-olivo/8 p-8">
                <p className="font-display text-[1.6rem] leading-tight">Quedaste en la lista.</p>
                <p className="mt-3 text-tinta/70">
                  Te escribimos en cuanto abramos lugares de membresía.
                </p>
              </div>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
                {error && <Aviso>{error}</Aviso>}

                <Campo id="m-nombre" label="Nombre" requerido value={nombre}
                  onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
                <Campo id="m-whatsapp" label="WhatsApp" type="tel" value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="81 0000 0000" autoComplete="tel" />
                <Campo id="m-correo" label="Correo" requerido type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com" autoComplete="email" />

                <fieldset>
                  <legend className="dato mb-3 text-tinta/55">¿Qué te interesa practicar?</legend>
                  <div className="flex flex-wrap gap-2">
                    {INTERESES.map((i) => (
                      <button
                        key={i.id} type="button" onClick={() => alternar(i.id)}
                        aria-pressed={intereses.includes(i.id)}
                        className={`dato border px-4 py-2 transition-colors ${
                          intereses.includes(i.id)
                            ? 'border-tinta bg-tinta text-crema'
                            : 'border-tinta/20 text-tinta/60 hover:border-tinta/50'
                        }`}
                      >
                        {i.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <AreaTexto id="m-mensaje" label="Mensaje" ayuda="Opcional" value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="¿Qué te gustaría practicar?" />

                <input
                  type="text" name="empresa" tabIndex={-1} autoComplete="off"
                  value={trampa} onChange={(e) => setTrampa(e.target.value)}
                  aria-hidden="true"
                  className="absolute left-[-9999px] h-px w-px opacity-0"
                />

                <Boton type="submit" disabled={enviando} className="w-full sm:w-fit">
                  {enviando ? 'Enviando…' : 'Quiero formar parte'}
                </Boton>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
