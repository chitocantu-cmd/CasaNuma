import type { IdFoto } from '../contenido/fotos';

// ===========================================================================
// Agenda de talleres · datos confirmados por Casa Numa
// ---------------------------------------------------------------------------
// Fuente: publicación de octubre 2026 (Semana 1). Tiene prioridad sobre
// cualquier dato de ejemplo.
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
  image: IdFoto;
  price: number | null;
  price_type: 'per_person';
  price_label: string | null;
  age_min: number | null;
  age_max: number | null;
  includes: string[];
  is_featured: boolean;
  is_active: boolean;
  /** 'online' = reserva y pago en línea · 'inquiry' = se pide información. */
  booking_type: 'online' | 'inquiry';
}

const sesion = (start_time: string, end_time: string | null = null): SesionRegistro => ({
  start_time,
  end_time,
  capacity: null, // cupo pendiente de Casa Numa
  available_spots: null,
  is_sold_out: false,
});

export const AGENDA: RegistroTaller[] = [
  // --- Octubre · Semana 1 ----------------------------------------------------
  {
    id: 'tardes-ceramica-ninos-01-oct',
    slug: 'tardes-de-ceramica-ninos-01-oct',
    title: 'Tardes de Cerámica (Niños)',
    description: [
      'Un espacio para que los niños exploren la cerámica, experimenten con el barro y desarrollen su creatividad.',
    ],
    date: '2026-10-01',
    sessions: [sesion('17:00', '18:30')],
    category: 'kids',
    label: null,
    image: 'taller-tardes-ninos',
    price: null,
    price_type: 'per_person',
    price_label: 'Info DM',
    age_min: 10,
    age_max: 14,
    includes: [],
    is_featured: false,
    is_active: true,
    booking_type: 'inquiry',
  },
  {
    id: 'tardes-ceramica-adultos-01-oct',
    slug: 'tardes-de-ceramica-adultos-01-oct',
    title: 'Tardes de Cerámica (Adultos)',
    description: [
      'Puedes crear tu propia pieza desde cero o elegir una pieza de bizcochito para pintar y personalizar a tu estilo.',
    ],
    date: '2026-10-01',
    sessions: [sesion('19:00', '21:00')],
    category: 'adults',
    label: null,
    image: 'taller-tardes-adultos',
    price: null,
    price_type: 'per_person',
    price_label: 'Info DM',
    age_min: null,
    age_max: null,
    includes: [],
    is_featured: false,
    is_active: true,
    booking_type: 'inquiry',
  },
  {
    id: 'clases-ceramica-02-oct',
    slug: 'clases-de-ceramica-02-oct',
    title: 'Clases de Cerámica',
    description: ['Clases continuas para aprender y desarrollar tus proyectos de cerámica con acompañamiento.'],
    date: '2026-10-02',
    sessions: [sesion('10:00')],
    category: 'adults',
    label: 'Clases',
    image: 'taller-clases',
    price: null,
    price_type: 'per_person',
    price_label: 'Info DM',
    age_min: null,
    age_max: null,
    includes: [],
    is_featured: false,
    is_active: true,
    booking_type: 'inquiry',
  },
  {
    id: 'tazas-halloween-03-oct',
    slug: 'tazas-de-halloween-03-oct',
    title: 'Tazas de Halloween',
    description: [
      'Crea y personaliza una taza inspirada en Halloween, perfecta para darle un toque divertido y spooky a tus bebidas.',
    ],
    date: '2026-10-03',
    sessions: [sesion('11:00'), sesion('16:00')],
    category: 'seasonal',
    label: null,
    image: 'taller-halloween',
    price: 800,
    price_type: 'per_person',
    price_label: null,
    age_min: null,
    age_max: null,
    includes: [],
    is_featured: true,
    is_active: true,
    booking_type: 'online',
  },
  {
    id: 'tazas-halloween-pan-muerto-04-oct',
    slug: 'tazas-de-halloween-y-pan-de-muerto-04-oct',
    title: 'Tazas de Halloween + Pan de Muerto',
    description: [
      'Una experiencia especial de temporada: crea tu taza de Halloween y disfruta el taller acompañado de pan de muerto.',
    ],
    date: '2026-10-04',
    sessions: [sesion('11:00')],
    category: 'seasonal',
    label: null,
    image: 'taller-halloween-pan',
    price: 800,
    price_type: 'per_person',
    price_label: null,
    age_min: null,
    age_max: null,
    includes: [],
    is_featured: true,
    is_active: true,
    booking_type: 'online',
  },
];
