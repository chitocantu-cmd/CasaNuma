import type { IdFoto } from '../contenido/fotos';

// ===========================================================================
// Agenda de talleres · datos confirmados por Casa Numa
// ---------------------------------------------------------------------------
// Fuente: "Talleres octubre numa.docx" (Casa Numa, 24 sep 2026), que
// reemplaza la publicación de la Semana 1. Tiene prioridad sobre cualquier
// dato de ejemplo.
//
// Cada registro tiene la forma de una fila de la futura tabla `workshops`
// (snake_case, mismos campos), para que el panel de administración cargue
// noviembre, diciembre, etc. sin tocar componentes. El repositorio convierte
// estas filas al tipo `Taller` que usan las páginas.
//
// Regla: lo que Casa Numa no publicó va en null. Nunca se rellena.
//   price: null        → se muestra `price_label` ("Info DM") y se pide
//                         información en vez de cobrar en línea.
//   capacity: null     → "Cupo limitado", sin número.
//   end_time: null     → solo se muestra la hora de inicio.
// ===========================================================================

export interface SesionRegistro {
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  available_spots: number | null;
  is_sold_out: boolean;
}

export interface RegistroTaller {
  id: string;
  slug: string;
  title: string;
  /** Primer párrafo = resumen de la tarjeta. */
  description: string[];
  date: string;
  sessions: SesionRegistro[];
  category: 'kids' | 'adults' | 'seasonal';
  /** Texto de la etiqueta cuando no basta la categoría ("Clases"). */
  label: string | null;
  /** Foto principal de esta fecha. */
  image: IdFoto;
  /** Todas las fotos del taller (incluida la principal), para la galería. */
  gallery: IdFoto[];
  price: number | null;
  price_type: 'per_person';
  price_label: string | null;
  age_min: number | null;
  age_max: number | null;
  includes: string[];
  is_featured: boolean;
  is_active: boolean;
  /**
   * 'online'     = reserva y pago en línea (los de categoría 'kids' van por
   *                el flujo de NUMA Kids: nombre y edad de cada niño).
   * 'membership' = es una clase de la membresía: se aparta desde la membresía.
   * 'inquiry'    = se pide información.
   */
  booking_type: 'online' | 'membership' | 'inquiry';
}

const sesion = (start_time: string, end_time: string | null = null): SesionRegistro => ({
  start_time,
  end_time,
  capacity: null, // cupo pendiente de Casa Numa
  available_spots: null,
  is_sold_out: false,
});

const MESES_SLUG = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Base = Omit<RegistroTaller, 'id' | 'slug' | 'date' | 'sessions'>;

/**
 * Una fila por fecha, como en la tabla: `tardes-de-ceramica-ninos-08-oct`.
 * `fechas` = fecha → horarios de ese día. Si el taller tiene varias fotos,
 * cada fecha usa la siguiente de la galería como principal.
 */
function porFecha(id: string, slug: string, base: Base, fechas: Record<string, SesionRegistro[]>): RegistroTaller[] {
  return Object.entries(fechas).map(([date, sessions], i) => {
    const [, m, d] = date.split('-');
    const sufijo = `${d}-${MESES_SLUG[Number(m) - 1]}`;
    const image = base.gallery.length ? base.gallery[i % base.gallery.length] : base.image;
    return { ...base, image, id: `${id}-${sufijo}`, slug: `${slug}-${sufijo}`, date, sessions };
  });
}

const comun: Pick<RegistroTaller, 'price_type' | 'age_min' | 'age_max' | 'includes' | 'is_active'> = {
  price_type: 'per_person',
  age_min: null,
  age_max: null,
  includes: [],
  is_active: true,
};

// ---------------------------------------------------------------------------
// Clases y talleres fijos
// ---------------------------------------------------------------------------
const tardesNinos: Base = {
  ...comun,
  title: 'Tardes de Cerámica (Niños)',
  description: [
    'Un espacio diseñado para que los niños exploren la cerámica, experimenten con el barro y desarrollen su creatividad.',
  ],
  category: 'kids',
  label: null,
  image: 'taller-tardes-ninos',
  gallery: ['taller-tardes-ninos'],
  price: 680,
  price_label: null,
  age_min: 10,
  age_max: 14,
  is_featured: false,
  booking_type: 'online',
};

const tardesAdultos: Base = {
  ...comun,
  title: 'Tardes de Cerámica (Adultos)',
  description: [
    'Puedes crear tu propia pieza desde cero o elegir una pieza de bizcochito para pintar y personalizar a tu estilo.',
  ],
  category: 'adults',
  label: null,
  image: 'taller-tardes-adultos',
  gallery: ['taller-tardes-adultos', 'taller-tardes-adultos-2', 'taller-tardes-adultos-3'],
  price: 800,
  price_label: null,
  is_featured: false,
  booking_type: 'online',
};

const clases: Base = {
  ...comun,
  title: 'Clases de Cerámica (Principiantes / Continuas)',
  description: [
    'Clases continuas para aprender y desarrollar tus proyectos de cerámica con acompañamiento paso a paso durante toda la clase.',
  ],
  category: 'adults',
  label: 'Clases',
  image: 'taller-clases',
  gallery: ['taller-clases', 'taller-clases-2', 'taller-clases-3'],
  price: null,
  price_label: 'Membresía',
  is_featured: false,
  booking_type: 'membership',
};

// ---------------------------------------------------------------------------
// Talleres de fin de semana
// ---------------------------------------------------------------------------
const finDeSemana = (
  title: string,
  description: string[],
  category: RegistroTaller['category'],
  gallery: IdFoto[],
  price: number,
): Base => ({
  ...comun,
  title, description, category, label: null, image: gallery[0], gallery, price, price_label: null,
  is_featured: true, booking_type: 'online',
});

const dosHorarios = () => [sesion('11:00'), sesion('16:00')];
const unHorario = () => [sesion('11:00')];

export const AGENDA: RegistroTaller[] = [
  // --- Octubre · clases y talleres fijos ------------------------------------
  ...porFecha('tardes-ceramica-ninos', 'tardes-de-ceramica-ninos', tardesNinos, {
    '2026-10-01': [sesion('17:00', '18:30')],
    '2026-10-08': [sesion('17:00', '18:30')],
    '2026-10-15': [sesion('17:00', '18:30')],
    '2026-10-29': [sesion('17:00', '18:30')],
  }),
  ...porFecha('tardes-ceramica-adultos', 'tardes-de-ceramica-adultos', tardesAdultos, {
    '2026-10-01': [sesion('19:00', '21:00')],
    '2026-10-08': [sesion('19:00', '21:00')],
    '2026-10-15': [sesion('19:00', '21:00')],
    '2026-10-22': [sesion('19:00', '21:00')],
    '2026-10-29': [sesion('19:00', '21:00')],
  }),
  ...porFecha('clases-ceramica', 'clases-de-ceramica', clases, {
    '2026-10-02': [sesion('10:00', '13:00')],
    '2026-10-09': [sesion('10:00', '13:00')],
    '2026-10-16': [sesion('10:00', '13:00')],
    '2026-10-23': [sesion('10:00', '13:00')],
    '2026-10-30': [sesion('10:00', '13:00')],
  }),

  // --- Octubre · talleres de fin de semana -----------------------------------
  ...porFecha('tazas-halloween', 'tazas-de-halloween', finDeSemana(
    'Tazas de Halloween',
    ['Crea y personaliza una taza inspirada en Halloween, perfecta para darle un toque divertido y spooky a tus bebidas.'],
    'seasonal', ['taller-halloween'], 800,
  ), { '2026-10-03': dosHorarios() }),
  ...porFecha('tazas-halloween-pan-muerto', 'tazas-de-halloween-y-pan-de-muerto', finDeSemana(
    'Tazas de Halloween + Pan de Muerto',
    ['Una experiencia especial de temporada: crea tu taza de Halloween y disfruta del taller acompañado de pan de muerto.'],
    'seasonal', ['taller-halloween-pan'], 800,
  ), { '2026-10-04': unHorario() }),
  ...porFecha('calabazas-ceramica', 'calabazas-de-ceramica', finDeSemana(
    'Calabazas de Cerámica',
    ['Crea y personaliza tu propia calabaza de cerámica con diseños únicos para darle un toque especial a tu decoración de otoño.'],
    'seasonal', ['taller-calabazas', 'taller-calabazas-2', 'taller-calabazas-3'], 800,
  ), { '2026-10-10': dosHorarios() }),
  ...porFecha('ceramica-libre', 'ceramica-libre', finDeSemana(
    'Cerámica Libre',
    ['Un espacio para dejar volar tu creatividad y trabajar libremente en tu propia pieza de cerámica.'],
    'adults', ['taller-ceramica-libre', 'taller-clases-3', 'taller-clases-2'], 800,
  ), {
    '2026-10-11': unHorario(),
    '2026-10-31': dosHorarios(),
    '2026-11-01': unHorario(),
  }),
  ...porFecha('tazas-catrina', 'tazas-de-catrina', finDeSemana(
    'Tazas de Catrina',
    ['Crea y personaliza una taza inspirada en la Catrina, perfecta para celebrar la temporada de Día de Muertos.'],
    'seasonal', ['taller-catrina'], 800,
  ), { '2026-10-17': dosHorarios() }),
  ...porFecha('pinta-calabaza', 'pinta-una-calabaza-de-ceramica', finDeSemana(
    'Pinta una Calabaza de Cerámica',
    ['Dale color y personalidad a tu propia calabaza de cerámica y crea una pieza única para tu hogar.'],
    'seasonal', ['taller-pinta-calabaza', 'taller-pinta-calabaza-2'], 699,
  ), { '2026-10-18': unHorario() }),
  ...porFecha('lampara-ceramica', 'construye-una-lampara-de-ceramica', finDeSemana(
    'Construye una Lámpara de Cerámica',
    [
      'Crea desde cero una lámpara de cerámica única y funcional para darle un toque especial a tu espacio.',
      'Importante: el taller no incluye foco ni cableado.',
    ],
    'adults', ['taller-lampara', 'taller-lampara-2', 'taller-lampara-3'], 800,
  ), { '2026-10-24': dosHorarios() }),
  ...porFecha('tazas-van-gogh', 'tazas-van-gogh', finDeSemana(
    'Tazas Van Gogh',
    ['Inspírate en el arte de Van Gogh para crear y personalizar una taza llena de color y creatividad.'],
    'adults', ['taller-van-gogh', 'taller-van-gogh-2'], 800,
  ), { '2026-10-25': unHorario() }),
];

/** Id de una sesión de la agenda: `tardes-ceramica-ninos-08-oct-1700`. */
export function idSesionAgenda(r: RegistroTaller, inicio: string): string {
  return `${r.id}-${inicio.replace(':', '')}`;
}

/** Por dónde se aparta cada fila (ver `booking_type`). */
export function flujoAgenda(r: RegistroTaller): 'taller' | 'kids' | 'membresia' {
  if (r.booking_type === 'membership') return 'membresia';
  if (r.category === 'kids' && r.booking_type === 'online' && r.price !== null) return 'kids';
  return 'taller';
}
