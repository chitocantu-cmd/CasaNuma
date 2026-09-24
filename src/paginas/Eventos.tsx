import { useState, type FormEvent } from 'react';
import SectionHeading from '../componentes/SectionHeading';
import Foto from '../componentes/base/Foto';
import Revelar from '../componentes/base/Revelar';
import { AreaTexto, Aviso, Campo, Selector } from '../componentes/base/Campos';
import { clasesBoton } from '../componentes/base/Boton';
import { Icono } from '../componentes/base/Iconos';
import { Pendiente } from '../componentes/base/Pendiente';
import EnlaceAncla from '../componentes/base/EnlaceAncla';
import CeramicShape, { type NombreSilueta } from '../componentes/marca/CeramicShape';
import { enlaceWhatsapp, mostrarPendientes } from '../config/site';
import { mensajeEvento } from '../contenido/whatsapp';
import { useSeo } from '../lib/seo';

// Texto: documento de contenido, sección 6.

const OCASIONES: { titulo: string; texto: string; silueta: NombreSilueta }[] = [
  { titulo: 'Cumpleaños', texto: 'Celebra creando algo único con tus personas favoritas.', silueta: 'olla' },
  { titulo: 'Baby shower', texto: 'Una experiencia creativa para celebrar la llegada de alguien muy especial.', silueta: 'guaje' },
  { titulo: 'Despedidas de soltera', texto: 'Un plan diferente para compartir y celebrar antes del gran día.', silueta: 'jarron' },
  { titulo: 'Tardes entre amigas o amigos', texto: 'No necesitas una fecha especial para hacer algo diferente.', silueta: 'taza' },
  { titulo: 'Otras experiencias', texto: 'Reuniones familiares, eventos empresariales y celebraciones personalizadas.', silueta: 'doble' },
];

export default function Eventos() {
  useSeo({
    titulo: 'Eventos de Cerámica | Casa Numa',
    descripcion:
      'Cumpleaños, baby showers, despedidas y eventos empresariales con experiencias privadas de cerámica en San Pedro Garza García. Cotización personalizada por WhatsApp.',
  });

  const [tipo, setTipo] = useState('');
  const [fecha, setFecha] = useState('');
  const [personas, setPersonas] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [sinNumero, setSinNumero] = useState(false);

  const mensaje = mensajeEvento({ tipo, fecha: fecha ? fechaLegible(fecha) : '', personas, comentarios });

  function cotizar(e: FormEvent) {
    e.preventDefault();
    const href = enlaceWhatsapp(mensaje);
    if (!href) {
      setSinNumero(true);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <section className="contenedor pt-[calc(theme(spacing.header)+3rem)]">
        <SectionHeading
          como="h1"
          eyebrow="Eventos especiales"
          silueta="doble"
          titulo={
            <>
              Celebra diferente.
              <span className="block text-terracota">Crea recuerdos que duran para siempre.</span>
            </>
          }
          className="[&_h1]:max-w-[22ch]"
        />
        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <Revelar className="lg:col-span-8">
            <Foto id="eventos-hero" prioridad className="aspect-[4/3] w-full rounded-suave sm:aspect-[16/10]" sizes="(min-width:1024px) 62vw, 100vw" />
          </Revelar>
          <Revelar retraso={0.1} className="flex flex-col justify-end lg:col-span-4">
            <p className="text-cuerpo-l text-cafe/85">
              Hay momentos que merecen algo más que una celebración tradicional. En Casa Numa transformamos tus ocasiones
              especiales en experiencias creativas donde puedes compartir, reír, ensuciarte las manos y crear algo único
              junto a tus personas favoritas.
            </p>
            <p className="mt-5 text-cuerpo-l text-cafe/85">
              Tú eliges el motivo; nosotros ponemos el barro, las ideas y un espacio para disfrutar.
            </p>
            <EnlaceAncla destino="cotiza" className={clasesBoton('primario', 'normal', 'mt-8 self-start')}>
              <Icono.whatsapp tam={18} className="-ml-1" /> Cotizar mi evento
            </EnlaceAncla>
          </Revelar>
        </div>
      </section>

      <section className="contenedor py-seccion" aria-labelledby="e-ocasiones">
        <SectionHeading numero="01" eyebrow="Ocasiones" titulo={<span id="e-ocasiones">¿Qué podemos celebrar juntos?</span>} tamano="t2" />
        <ul className="mt-12 border-t border-cafe/15">
          {OCASIONES.map((o, i) => (
            <Revelar
              key={o.titulo}
              como="li"
              retraso={i * 0.04}
              className="group grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 border-b border-cafe/15 py-7 sm:grid-cols-[3rem_1.1fr_1fr_3.5rem] sm:gap-x-8 sm:py-9"
            >
              <span className="cifra text-[1.1rem] text-cafe/45">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-t3 font-light transition-colors duration-media group-hover:text-terracota">{o.titulo}</h3>
              <p className="col-start-2 mt-2 max-w-[44ch] text-cuerpo text-cafe/75 sm:col-start-auto sm:mt-0">{o.texto}</p>
              <CeramicShape
                nombre={o.silueta}
                className="hidden h-10 w-auto self-center justify-self-end opacity-40 transition-all duration-media ease-numa group-hover:-translate-y-1 group-hover:opacity-100 sm:block"
              />
            </Revelar>
          ))}
        </ul>
      </section>

      <section id="cotiza" className="bg-cafe/[0.035] py-seccion" aria-labelledby="e-cotiza">
        <div className="contenedor grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <SectionHeading numero="02" eyebrow="Cotización" titulo={<span id="e-cotiza">¿Tienes otra idea en mente?</span>} tamano="t2" />
            <Revelar retraso={0.1}>
              <p className="mt-7 max-w-lectura text-cuerpo-l text-cafe/85">
                Cuéntanos qué te gustaría organizar y diseñaremos una experiencia para tu grupo. Cada celebración se cotiza
                de manera personalizada según el número de participantes, la actividad y los detalles del evento.
              </p>
              <div className="mt-10 hidden lg:block">
                <Foto id="eventos-detalle" className="aspect-[4/5] w-2/3 rounded-arco" sizes="22vw" />
              </div>
            </Revelar>
          </div>

          <Revelar retraso={0.1} className="lg:col-span-6 lg:col-start-7">
            <form onSubmit={cotizar} className="rounded-suave bg-crema p-6 sm:p-10" noValidate>
              <div className="grid gap-7 sm:grid-cols-2">
                <Selector id="e-tipo" label="Tipo de evento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="">Elige una opción</option>
                  {['Cumpleaños', 'Baby shower', 'Despedida de soltera', 'Tarde entre amigas o amigos', 'Reunión familiar', 'Evento empresarial', 'Otra celebración'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Selector>
                <Campo id="e-fecha" label="Fecha tentativa" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                <Campo id="e-personas" label="Número de personas" type="number" inputMode="numeric" min={1} value={personas} onChange={(e) => setPersonas(e.target.value)} placeholder="Ej. 10" />
                <div className="sm:col-span-2">
                  <AreaTexto
                    id="e-comentarios" label="Comentarios o necesidades especiales" opcional value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    placeholder="Qué celebran, qué les gustaría crear, horario preferido…"
                  />
                </div>
              </div>

              {/* Vista previa: la persona ve exactamente qué se va a mandar */}
              <div className="mt-8 rounded-[0.75rem] border border-cafe/10 bg-cafe/[0.04] p-5">
                <p className="eyebrow flex items-center gap-2 text-[0.58rem] text-cafe/60">
                  <Icono.whatsapp tam={14} /> Tu mensaje
                </p>
                <p className="mt-3 whitespace-pre-line text-[0.82rem] leading-relaxed text-cafe/85">{mensaje}</p>
              </div>

              {sinNumero && (
                <div className="mt-6">
                  {mostrarPendientes ? (
                    <Pendiente>Falta el número oficial de WhatsApp: con él, este botón abre el chat con el mensaje listo.</Pendiente>
                  ) : (
                    <Aviso>Estamos actualizando nuestro WhatsApp. Intenta de nuevo en unos minutos.</Aviso>
                  )}
                </div>
              )}

              <button type="submit" className={clasesBoton('primario', 'normal', 'mt-8 w-full sm:w-auto')}>
                <Icono.whatsapp tam={18} className="-ml-1" />
                <span>Cotizar mi evento por WhatsApp</span>
              </button>
              <p className="mt-4 text-[0.74rem] text-cafe/60">
                Se abre WhatsApp con tu mensaje listo. Los eventos no se pagan en línea: primero te enviamos tu cotización.
              </p>
            </form>
          </Revelar>
        </div>
      </section>
    </>
  );
}

function fechaLegible(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
