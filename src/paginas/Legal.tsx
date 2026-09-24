import { enlaceInstagram, enlaceWhatsapp, siteConfig } from '../config/site';
import { Pendiente } from '../componentes/base/Pendiente';
import { useSeo } from '../lib/seo';

// ---------------------------------------------------------------------------
// Documentos legales. El texto lo redacta Casa Numa (idealmente con asesoría
// legal): aquí NO se inventa ni se copia de plantillas. Mientras no exista,
// la página lo dice con honestidad y ofrece un medio de contacto.
// ---------------------------------------------------------------------------

const DOCUMENTOS = {
  privacidad: {
    titulo: 'Aviso de privacidad',
    pendiente:
      'Aviso de privacidad conforme a la LFPDPPP: responsable, datos que se recaban (cuenta, reservas, pagos, novedades), finalidades, derechos ARCO y medio para ejercerlos. Es obligatorio antes de recabar datos en producción.',
    contenido: null as string[] | null,
  },
  terminos: {
    titulo: 'Términos y condiciones',
    pendiente: 'Términos de uso del sitio y de la compra de experiencias.',
    contenido: null as string[] | null,
  },
  reservaciones: {
    titulo: 'Política de reservaciones',
    pendiente:
      'Cancelaciones, reembolsos, reprogramación de clases de membresía, vigencia, llegadas tarde y entrega de piezas.',
    contenido: null as string[] | null,
  },
};

export default function Legal({ documento }: { documento: keyof typeof DOCUMENTOS }) {
  const d = DOCUMENTOS[documento];
  useSeo({ titulo: `${d.titulo} | Casa Numa`, descripcion: `${d.titulo} de Casa Numa.` });
  const contacto = enlaceWhatsapp() ?? enlaceInstagram() ?? (siteConfig.email ? `mailto:${siteConfig.email}` : null);

  return (
    <section className="contenedor min-h-[70vh] pb-seccion pt-[calc(theme(spacing.header)+3rem)]">
      <div className="max-w-lectura">
        <p className="eyebrow text-cafe/65">Casa Numa</p>
        <h1 className="mt-5 font-display text-t1 font-light">{d.titulo}</h1>

        {d.contenido ? (
          <div className="mt-10 space-y-5 text-cuerpo text-cafe/85">
            {d.contenido.map((p) => <p key={p}>{p}</p>)}
          </div>
        ) : (
          <>
            <p className="mt-10 text-cuerpo-l text-cafe/80">
              Estamos terminando este documento. Si necesitas consultarlo antes de reservar, escríbenos y con gusto te lo
              compartimos.
            </p>
            {contacto && (
              <a href={contacto} target="_blank" rel="noopener noreferrer" className="subrayado-fijo mt-6 inline-block pb-0.5 text-nota">
                Escribir a Casa Numa
              </a>
            )}
            <Pendiente className="mt-10">{d.pendiente}</Pendiente>
          </>
        )}
      </div>
    </section>
  );
}
