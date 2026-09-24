import { enlaceComoLlegar, enlaceMapaEmbebido, siteConfig } from '../../config/site';
import SectionHeading from '../SectionHeading';
import Foto from '../base/Foto';
import { BotonExterno } from '../base/Boton';
import { Icono } from '../base/Iconos';
import { Pendiente } from '../base/Pendiente';
import Revelar from '../base/Revelar';
import { IconoU } from '../marca/Logo';

/**
 * Ubicación: dirección, mapa y "Cómo llegar". Sin dirección confirmada no se
 * inventa ninguna: se muestra la zona (confirmada) y un mapa dibujado.
 */
export default function Ubicacion({ numero }: { numero?: string }) {
  const comoLlegar = enlaceComoLlegar();
  const mapa = enlaceMapaEmbebido();
  const { direccion, direccionProvisional, horarios, zona } = siteConfig;

  return (
    <section id="ubicacion" className="contenedor py-seccion" aria-labelledby="titulo-ubicacion">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <SectionHeading
            numero={numero}
            eyebrow="Ubicación"
            titulo={<span id="titulo-ubicacion">Ven a crear con nosotros.</span>}
            intro={<p>Te esperamos en nuestro estudio, en el corazón del Casco de San Pedro Garza García, Nuevo León.</p>}
            tamano="t2"
          />

          <Revelar retraso={0.1} className="mt-10 space-y-6">
            <div className="flex gap-4">
              <Icono.pin tam={22} className="mt-0.5 shrink-0 text-terracota" />
              <address className="not-italic text-cuerpo text-cafe">
                {direccion && <span className="block">{direccion}</span>}
                <span className={direccion ? 'block text-cafe/70' : 'block'}>{zona}</span>
              </address>
            </div>

            {horarios.length > 0 && (
              <div className="flex gap-4">
                <Icono.reloj tam={22} className="mt-0.5 shrink-0 text-terracota" />
                <ul className="text-cuerpo text-cafe">
                  {horarios.map((h) => (
                    <li key={h.dia}>
                      {h.dia} · <span className="text-cafe/70">{h.horas}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {comoLlegar && (
              <BotonExterno href={comoLlegar} variante="secundario" flecha>
                Cómo llegar
              </BotonExterno>
            )}

            {(direccionProvisional || horarios.length === 0) && (
              <Pendiente>
                {direccionProvisional && 'Dirección tomada de la publicación de octubre; confirmar la ficha de Google Maps. '}
                {horarios.length === 0 && 'Falta el horario de atención del estudio.'}
              </Pendiente>
            )}
          </Revelar>
        </div>

        <Revelar retraso={0.15} className="lg:col-span-6 lg:col-start-7">
          {mapa ? (
            <iframe
              src={mapa}
              title={`Mapa: Casa Numa, ${zona}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/3] w-full rounded-suave border-0 grayscale-[35%] sepia-[15%]"
            />
          ) : (
            <div className="relative">
              <Foto id="mapa" className="aspect-[4/3] w-full rounded-suave" sizes="(min-width:1024px) 45vw, 100vw" />
              {/* Mapa dibujado mientras no hay mapa real */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <div className="flex flex-col items-center gap-3 rounded-full bg-crema/90 px-7 py-5 text-center">
                  <IconoU className="h-8 w-auto text-terracota" />
                  <span className="eyebrow text-[0.6rem] text-cafe">Casco de San Pedro</span>
                </div>
              </div>
            </div>
          )}
        </Revelar>
      </div>
    </section>
  );
}
