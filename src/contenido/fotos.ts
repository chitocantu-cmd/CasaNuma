import type { NombreSilueta } from '../componentes/marca/trazos';

// ===========================================================================
// Registro de fotografías
// ---------------------------------------------------------------------------
// Cada lugar del sitio que lleva foto tiene aquí una entrada con el encuadre
// que necesita. La lista completa ES el guion de la sesión de fotos.
//
// Para publicar una foto real: poner `src` (ruta en /public/fotos o URL de
// Cloudinary) y listo. Mientras no haya `src`:
//   · en desarrollo/demo se muestra la foto de `referencia` (recortes del
//     brandbook, con la etiqueta "Referencia"), o un marcador que describe el
//     encuadre;
//   · en producción NUNCA se muestra una referencia: solo el marcador con la
//     silueta NUMA. Así ninguna foto ajena se presenta como de Casa Numa.
// ===========================================================================

/** Recortes de las fotos del brandbook, en /public/fotos/referencia. */
export const REFERENCIAS = {
  'mesa-piezas': [640, 1280, 1920],
  'manos-amasando': [640, 1280, 1920],
  'cuenco-corazon': [640, 1280, 1920],
  jarrones: [640, 810],
  esmaltes: [640, 1280, 1920],
  'manos-pieza': [640, 1280, 1920],
  'mano-interior': [640, 1280, 1920],
} as const;

export type Referencia = keyof typeof REFERENCIAS;
export type Tono = 'terracota' | 'crema' | 'amarillo' | 'verde' | 'indigo' | 'naranja';

export interface EntradaFoto {
  alt: string;
  /** Qué debe mostrar la foto definitiva. */
  encuadre: string;
  /** Foto definitiva de Casa Numa. */
  src?: string;
  referencia?: Referencia;
  tono?: Tono;
  silueta?: NombreSilueta;
  /** object-position para el recorte. */
  posicion?: string;
}

export const FOTOS = {
  // --- Inicio --------------------------------------------------------------
  'inicio-hero': {
    alt: 'Manos amasando barro sobre la mesa de trabajo',
    encuadre: 'Manos amasando barro sobre mesa manchada, luz natural lateral. Vertical.',
    referencia: 'manos-amasando', tono: 'terracota', silueta: 'jarron', posicion: '50% 60%',
  },
  'inicio-hero-mesa': {
    alt: 'Piezas de cerámica secándose sobre la mesa del estudio',
    encuadre: 'Piezas recién hechas secándose en la mesa del estudio. Horizontal.',
    referencia: 'mesa-piezas', tono: 'crema', silueta: 'olla',
  },
  'exp-talleres': {
    alt: 'Pinturas y esmaltes listos para decorar piezas',
    encuadre: 'Mesa de un taller de fin de semana: esmaltes, pinceles y piezas a medio pintar. Vertical.',
    referencia: 'esmaltes', tono: 'amarillo', silueta: 'taza',
  },
  'exp-membresia': {
    alt: 'Mano dando forma al interior de una pieza de barro',
    encuadre: 'Alumna de membresía trabajando su pieza, plano cerrado de manos. Vertical.',
    referencia: 'mano-interior', tono: 'terracota', silueta: 'guaje', posicion: '60% 50%',
  },
  'exp-kids': {
    alt: 'Niñas y niños modelando barro en NUMA Kids',
    encuadre: 'Niños de 7+ años modelando barro en la mesa, manos y caras concentradas (con permiso de sus papás). Vertical.',
    tono: 'amarillo', silueta: 'tarro',
  },
  'eventos-grupo': {
    alt: 'Grupo celebrando alrededor de la mesa de trabajo',
    encuadre: 'Grupo pequeño celebrando alrededor de la mesa larga, risas y barro. Horizontal amplia.',
    tono: 'indigo', silueta: 'doble',
  },
  'hola-estudio': {
    alt: 'El estudio de Casa Numa con luz de mañana',
    encuadre: 'El estudio completo con luz de mañana: mesa, repisas con piezas, horno al fondo. Vertical.',
    tono: 'crema', silueta: 'anfora',
  },
  'hola-fundadoras': {
    alt: 'Mónica y Gloria en la mesa de trabajo',
    encuadre: 'Mónica y Gloria juntas en la mesa de trabajo, retrato natural, sin posar. Horizontal.',
    tono: 'terracota', silueta: 'olla',
  },
  mapa: {
    alt: 'Fachada del estudio en el Casco de San Pedro',
    encuadre: 'Fachada o puerta del estudio para reconocerlo al llegar. Horizontal.',
    tono: 'verde', silueta: 'botellon',
  },

  // --- Membresía -----------------------------------------------------------
  'membresia-hero': {
    alt: 'Manos trabajando una pieza grande de barro',
    encuadre: 'Alumna de membresía modelando una pieza en el estudio, plano medio. Horizontal amplia.',
    referencia: 'manos-pieza', tono: 'terracota', silueta: 'guaje', posicion: '50% 40%',
  },
  'membresia-proyecto-clase': {
    alt: 'Pieza pequeña terminada en una sola clase',
    encuadre: 'Varias piezas pequeñas distintas, cada una hecha en una clase. Cuadrada.',
    referencia: 'cuenco-corazon', tono: 'crema', silueta: 'cuenco',
  },
  'membresia-gran-formato': {
    alt: 'Detalle de textura en una pieza de gran formato',
    encuadre: 'Pieza de gran formato en proceso, trabajada durante cuatro clases. Vertical.',
    referencia: 'jarrones', tono: 'terracota', silueta: 'botellon',
  },

  // --- Talleres (agenda) ------------------------------------------------------
  'taller-tardes-ninos': {
    alt: 'Niñas y niños trabajando barro en Tardes de Cerámica',
    encuadre: 'Niñas y niños de 10 a 14 años modelando barro en la mesa (con permiso de sus papás). Horizontal 4:3.',
    tono: 'amarillo', silueta: 'tarro',
  },
  'taller-tardes-adultos': {
    alt: 'Piezas de bizcochito listas para pintar',
    encuadre: 'Mesa de una tarde de cerámica: piezas de bizcochito, pinceles y pinturas. Horizontal 4:3.',
    referencia: 'esmaltes', tono: 'terracota', silueta: 'cuenco',
  },
  'taller-clases': {
    alt: 'Manos trabajando una pieza durante una clase',
    encuadre: 'Alumna trabajando su proyecto con acompañamiento, plano de manos. Horizontal 4:3.',
    referencia: 'manos-pieza', tono: 'terracota', silueta: 'guaje',
  },
  'taller-halloween': {
    alt: 'Tazas decoradas con motivos de Halloween',
    encuadre: 'Tazas terminadas del taller de Halloween sobre la mesa, luz cálida. Horizontal 4:3.',
    tono: 'naranja', silueta: 'taza',
  },
  'taller-halloween-pan': {
    alt: 'Taza de Halloween junto a un pan de muerto',
    encuadre: 'Taza de Halloween recién decorada junto a un pan de muerto sobre la mesa de trabajo. Horizontal 4:3.',
    tono: 'naranja', silueta: 'tarro',
  },

  // --- NUMA Kids -----------------------------------------------------------
  'kids-hero': {
    alt: 'Niña mostrando su pieza de barro',
    encuadre: 'Niña o niño mostrando orgulloso su pieza, luz natural (con permiso). Horizontal amplia.',
    tono: 'amarillo', silueta: 'olla',
  },
  'kids-mesa': {
    alt: 'Mesa de NUMA Kids con barro y herramientas',
    encuadre: 'La mesa del taller infantil desde arriba: barro, herramientas, manos pequeñas. Vertical.',
    tono: 'verde', silueta: 'taza',
  },

  // --- Eventos -------------------------------------------------------------
  'eventos-hero': {
    alt: 'Celebración privada en el estudio de Casa Numa',
    encuadre: 'Mesa puesta para un evento privado: barro, flores, copas. Horizontal amplia.',
    tono: 'indigo', silueta: 'doble',
  },
  'eventos-detalle': {
    alt: 'Manos de varias personas trabajando juntas',
    encuadre: 'Varias manos trabajando barro al mismo tiempo sobre la mesa. Vertical.',
    tono: 'naranja', silueta: 'jarron',
  },

  // --- Store ---------------------------------------------------------------
  'store-hero': {
    alt: 'Repisa con piezas NUMA disponibles',
    encuadre: 'Repisa del estudio con piezas terminadas a la venta, fondo limpio. Horizontal amplia.',
    tono: 'crema', silueta: 'botellon',
  },

  // --- Nosotras ------------------------------------------------------------
  'nosotras-hero': {
    alt: 'Piezas terminadas en la mesa del estudio',
    encuadre: 'El estudio de Casa Numa en un día normal de trabajo. Horizontal amplia.',
    referencia: 'mesa-piezas', tono: 'crema', silueta: 'olla',
  },
  'retrato-monica': {
    alt: 'Mónica, artista ceramista y diseñadora industrial',
    encuadre: 'Retrato de Mónica trabajando una pieza de gran formato. Vertical.',
    tono: 'terracota', silueta: 'anfora',
  },
  'retrato-gloria': {
    alt: 'Gloria, creatividad, ideas y experiencias',
    encuadre: 'Retrato de Gloria recibiendo a alguien en el estudio. Vertical.',
    tono: 'amarillo', silueta: 'jarron',
  },
  'nosotras-comunidad': {
    alt: 'Personas conversando alrededor de la mesa de trabajo',
    encuadre: 'Conversación alrededor de la mesa durante una clase, plano abierto. Horizontal.',
    tono: 'verde', silueta: 'doble',
  },

  // --- Cuenta --------------------------------------------------------------
  'cuenta-acceso': {
    alt: 'Barro trabajado a mano',
    encuadre: 'Detalle de textura de barro trabajado. Vertical.',
    referencia: 'manos-amasando', tono: 'terracota', silueta: 'cuenco',
  },
} satisfies Record<string, EntradaFoto>;

export type IdFoto = keyof typeof FOTOS;
