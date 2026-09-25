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

/**
 * Fotos de referencia, en /public/fotos/referencia: recortes del brandbook e
 * imágenes de inspiración que mandó Casa Numa (WeTransfer "web-numa", 24 sep
 * 2026; `pin-*`). Ninguna es obra de Casa Numa: se muestran con la etiqueta
 * "Referencia" y solo mientras `mostrarPendientes` esté activo.
 */
export const REFERENCIAS = {
  'mesa-piezas': [640, 1280, 1920],
  'manos-amasando': [640, 1280, 1920],
  'cuenco-corazon': [640, 1280, 1920],
  jarrones: [640, 810],
  esmaltes: [640, 1280, 1920],
  'manos-pieza': [640, 1280, 1920],
  'mano-interior': [640, 1280, 1920],
  'pin-taza-boo': [736],
  'pin-taza-calabaza': [736],
  'pin-taza-muertos': [736],
  'pin-calabaza-blanca': [736],
  'pin-calabazas-luz': [736],
  'pin-calabazas-apiladas': [736],
  'pin-calabazas-piedras': [736],
  'pin-pintar-calabazas': [736],
  'pin-lamparas-focos': [736],
  'pin-lamparas-azules': [736],
  'pin-lampara-gato': [736],
  'pin-botes': [736],
  'pin-juego-sake': [736],
  'pin-organizador': [683],
  'pin-jarrones': [736],
  'pin-esculturas': [500],
  'pin-bases': [640],
  'pin-plato-lunares': [736],
  'pin-tazas-ninos': [736],
} as const;

export type Referencia = keyof typeof REFERENCIAS;
export type Tono = 'terracota' | 'crema' | 'amarillo' | 'verde' | 'indigo' | 'naranja';

export interface EntradaFoto {
  alt: string;
  /** Qué debe mostrar la foto definitiva. */
  encuadre: string;
  /**
   * Foto definitiva de Casa Numa. Con `anchos`, es la ruta base en /public
   * sin el sufijo: '/fotos/talleres/taza-van-gogh' → taza-van-gogh-1280.webp.
   * Sin `anchos`, una ruta o URL completa (p. ej. Cloudinary).
   */
  src?: string;
  anchos?: readonly number[];
  referencia?: Referencia;
  tono?: Tono;
  silueta?: NombreSilueta;
  /** object-position para el recorte. */
  posicion?: string;
}

/** Anchos generados para cada foto de producción (ver `anchos`). */
const VERTICAL = [640, 1280] as const;
const HORIZONTAL = [640, 1280, 1920] as const;

// Fotos de producción de Casa Numa: WeTransfer «Fotos WEB - NUMA» (25 sep
// 2026) en /public/fotos/{estudio,eventos,kids,membresia,nosotras,piezas}.
// Los talleres de temporada (Halloween, Catrina, calabazas, lámparas) siguen
// esperando su foto: mientras, en producción se ve el marcador.
export const FOTOS = {
  // --- Inicio --------------------------------------------------------------
  'inicio-hero': {
    alt: 'Manos dando forma a una placa de barro con una herramienta de madera',
    encuadre: 'Manos amasando barro sobre mesa manchada, luz natural lateral. Vertical.',
    src: '/fotos/estudio/manos-placa', anchos: VERTICAL,
    tono: 'terracota', silueta: 'jarron', posicion: '55% 50%',
  },
  'inicio-hero-mesa': {
    alt: 'Platos de cerámica apilados con lunares rojos y ondas amarillas en relieve',
    encuadre: 'Piezas recién hechas secándose en la mesa del estudio. Horizontal.',
    src: '/fotos/piezas/platos-relieve', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'olla',
  },
  'exp-talleres': {
    alt: 'Tres alumnas modelando barro en la mesa del estudio',
    encuadre: 'Mesa de un taller de fin de semana: esmaltes, pinceles y piezas a medio pintar. Vertical.',
    src: '/fotos/estudio/alumnas-trabajando', anchos: VERTICAL,
    tono: 'amarillo', silueta: 'taza',
  },
  'exp-membresia': {
    alt: 'Tarjeta «Cerámica & Arte» en la mano, con una clase en el estudio al fondo',
    encuadre: 'Alumna de membresía trabajando su pieza, plano cerrado de manos. Vertical.',
    src: '/fotos/membresia/tarjeta-membresia', anchos: HORIZONTAL,
    tono: 'terracota', silueta: 'guaje', posicion: '72% 50%',
  },
  'exp-kids': {
    alt: 'Niña modelando una flor de barro',
    encuadre: 'Niños de 10 a 14 años modelando barro en la mesa, manos y caras concentradas (con permiso de sus papás). Vertical.',
    src: '/fotos/kids/nina-modelando', anchos: VERTICAL,
    tono: 'amarillo', silueta: 'tarro',
  },
  'eventos-grupo': {
    alt: 'Grupo trabajando barro alrededor de la mesa larga del estudio',
    encuadre: 'Grupo pequeño celebrando alrededor de la mesa larga, risas y barro. Horizontal amplia.',
    src: '/fotos/eventos/evento-mesa', anchos: HORIZONTAL,
    tono: 'indigo', silueta: 'doble',
  },
  'hola-estudio': {
    alt: 'Alumna sonriendo en la mesa del estudio, con pinceles en primer plano',
    encuadre: 'El estudio completo con luz de mañana: mesa, repisas con piezas, horno al fondo. Vertical.',
    src: '/fotos/estudio/alumna-pinceles', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'anfora', posicion: '35% 50%',
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
    alt: 'Tarjeta «Cerámica & Arte» en la mano, con una clase en el estudio al fondo',
    encuadre: 'Alumna de membresía modelando una pieza en el estudio, plano medio. Horizontal amplia.',
    src: '/fotos/membresia/tarjeta-membresia', anchos: HORIZONTAL,
    tono: 'terracota', silueta: 'guaje', posicion: '50% 55%',
  },
  'membresia-proyecto-clase': {
    alt: 'Alumna extendiendo una placa de barro sobre la mesa',
    encuadre: 'Varias piezas pequeñas distintas, cada una hecha en una clase. Cuadrada.',
    src: '/fotos/estudio/placa-barro', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'cuenco',
  },
  'membresia-gran-formato': {
    alt: 'Detalle de textura en una pieza de gran formato',
    encuadre: 'Pieza de gran formato en proceso, trabajada durante cuatro clases. Vertical.',
    referencia: 'jarrones', tono: 'terracota', silueta: 'botellon',
  },

  // --- Talleres (agenda) ------------------------------------------------------
  'taller-tardes-ninos': {
    alt: 'Niño pintando una taza en la mesa del taller',
    encuadre: 'Niñas y niños de 10 a 14 años modelando barro en la mesa (con permiso de sus papás). Horizontal 4:3.',
    src: '/fotos/kids/nino-pintando', anchos: HORIZONTAL,
    tono: 'amarillo', silueta: 'tarro',
  },
  'taller-tardes-adultos': {
    alt: 'Tres alumnas conversando mientras trabajan en la mesa del estudio',
    encuadre: 'Mesa de una tarde de cerámica: piezas de bizcochito, pinceles y pinturas. Horizontal 4:3.',
    src: '/fotos/estudio/mesa-conversacion', anchos: HORIZONTAL,
    tono: 'terracota', silueta: 'cuenco',
  },
  'taller-tardes-adultos-2': {
    alt: 'Alumna sonriendo en la mesa del estudio, con pinceles en primer plano',
    encuadre: 'Pieza terminada en una Tarde de Cerámica. Horizontal 4:3.',
    src: '/fotos/estudio/alumna-pinceles', anchos: HORIZONTAL,
    tono: 'terracota', silueta: 'jarron', posicion: '35% 50%',
  },
  'taller-tardes-adultos-3': {
    alt: 'Alumna extendiendo una placa de barro sobre la mesa',
    encuadre: 'Pieza terminada en una Tarde de Cerámica. Horizontal 4:3.',
    src: '/fotos/estudio/placa-barro', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'cuenco',
  },
  'taller-clases': {
    alt: 'Tarjeta «Cerámica & Arte» en la mano, con una clase en el estudio al fondo',
    encuadre: 'Alumna trabajando su proyecto con acompañamiento, plano de manos. Horizontal 4:3.',
    src: '/fotos/membresia/tarjeta-membresia', anchos: HORIZONTAL,
    tono: 'terracota', silueta: 'guaje',
  },
  'taller-clases-2': {
    alt: 'Manos dando forma a una placa de barro con una herramienta de madera',
    encuadre: 'Proyecto de una alumna de las Clases de Cerámica. Horizontal 4:3.',
    src: '/fotos/estudio/manos-placa', anchos: VERTICAL,
    tono: 'crema', silueta: 'botellon', posicion: '50% 55%',
  },
  'taller-clases-3': {
    alt: 'Alumna extendiendo una placa de barro sobre la mesa',
    encuadre: 'Proyecto de una alumna de las Clases de Cerámica. Horizontal 4:3.',
    src: '/fotos/estudio/placa-barro', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'cuenco',
  },
  'taller-halloween': {
    alt: 'Tazas decoradas con motivos de Halloween: fantasmas, arañas y una calabaza',
    encuadre: 'Tazas terminadas del taller de Halloween sobre la mesa, luz cálida. Horizontal 4:3.',
    referencia: 'pin-taza-boo', tono: 'naranja', silueta: 'taza', posicion: '50% 45%',
  },
  'taller-halloween-pan': {
    alt: 'Taza naranja en forma de calabaza',
    encuadre: 'Taza de Halloween recién decorada junto a un pan de muerto sobre la mesa de trabajo. Horizontal 4:3.',
    referencia: 'pin-taza-calabaza', tono: 'naranja', silueta: 'tarro',
  },
  'taller-calabazas': {
    alt: 'Calabaza de cerámica blanca con cara de Halloween',
    encuadre: 'Calabazas de cerámica terminadas en el taller, luz cálida de otoño. Horizontal 4:3.',
    referencia: 'pin-calabaza-blanca', tono: 'naranja', silueta: 'olla', posicion: '50% 55%',
  },
  'taller-calabazas-2': {
    alt: 'Calabazas de cerámica iluminadas por dentro',
    encuadre: 'Calabazas de cerámica encendidas. Horizontal 4:3.',
    referencia: 'pin-calabazas-luz', tono: 'naranja', silueta: 'olla', posicion: '50% 60%',
  },
  'taller-calabazas-3': {
    alt: 'Tres calabazas de cerámica apiladas: blanca, negra y naranja',
    encuadre: 'Calabazas de cerámica terminadas. Horizontal 4:3.',
    referencia: 'pin-calabazas-apiladas', tono: 'naranja', silueta: 'olla',
  },
  'taller-ceramica-libre': {
    alt: 'Tres alumnas modelando barro en la mesa del estudio',
    encuadre: 'Piezas distintas hechas en una sesión de Cerámica Libre, sobre la mesa del estudio. Horizontal 4:3.',
    src: '/fotos/estudio/alumnas-trabajando', anchos: VERTICAL,
    tono: 'verde', silueta: 'jarron', posicion: '50% 25%',
  },
  'taller-catrina': {
    alt: 'Taza rosa decorada con una calavera de Día de Muertos',
    encuadre: 'Taza de Catrina terminada, con flores de cempasúchil alrededor. Horizontal 4:3.',
    referencia: 'pin-taza-muertos', tono: 'amarillo', silueta: 'taza', posicion: '50% 45%',
  },
  'taller-pinta-calabaza': {
    alt: 'Calabaza de cerámica pintada con hojas de otoño durante un taller',
    encuadre: 'Manos pintando una calabaza de cerámica con pincel fino. Horizontal 4:3.',
    referencia: 'pin-pintar-calabazas', tono: 'naranja', silueta: 'olla', posicion: '50% 70%',
  },
  'taller-pinta-calabaza-2': {
    alt: 'Calabazas pintadas de colores con piedras brillantes',
    encuadre: 'Calabazas pintadas terminadas. Horizontal 4:3.',
    referencia: 'pin-calabazas-piedras', tono: 'naranja', silueta: 'olla',
  },
  'taller-lampara': {
    alt: 'Lámparas de cerámica con focos encendidos',
    encuadre: 'Lámpara de cerámica terminada y encendida (el taller no incluye foco ni cableado). Vertical.',
    referencia: 'pin-lamparas-focos', tono: 'indigo', silueta: 'botellon', posicion: '50% 60%',
  },
  'taller-lampara-2': {
    alt: 'Bases de lámpara de cerámica pintadas en azul',
    encuadre: 'Lámparas de cerámica terminadas. Horizontal 4:3.',
    referencia: 'pin-lamparas-azules', tono: 'indigo', silueta: 'botellon',
  },
  'taller-lampara-3': {
    alt: 'Lámpara de cerámica en forma de gato con estrellas rojas',
    encuadre: 'Lámpara de cerámica terminada. Horizontal 4:3.',
    referencia: 'pin-lampara-gato', tono: 'indigo', silueta: 'botellon',
  },
  'taller-van-gogh': {
    alt: 'Taza con espirales azules en relieve inspiradas en La noche estrellada de Van Gogh',
    encuadre: 'Taza Van Gogh terminada sobre mesa de madera.',
    // Foto de producción de Casa Numa (agosto 2026).
    src: '/fotos/talleres/taza-van-gogh', anchos: [640, 1280, 1920],
    tono: 'indigo', silueta: 'taza', posicion: '50% 55%',
  },
  'taller-van-gogh-2': {
    alt: 'Taza Van Gogh con espirales azules en relieve, vista de lado',
    encuadre: 'Taza Van Gogh terminada sobre mesa de madera.',
    src: '/fotos/talleres/taza-van-gogh-2', anchos: [640, 1280, 1920],
    tono: 'indigo', silueta: 'taza', posicion: '50% 50%',
  },

  // --- NUMA Kids -----------------------------------------------------------
  'kids-hero': {
    alt: 'Niña mostrando la pieza de barro que modeló',
    encuadre: 'Niña o niño mostrando orgulloso su pieza, luz natural (con permiso). Horizontal amplia.',
    src: '/fotos/kids/nina-pieza', anchos: HORIZONTAL,
    tono: 'amarillo', silueta: 'olla',
  },
  'kids-mesa': {
    alt: 'Niña modelando una flor de barro',
    encuadre: 'La mesa del taller infantil desde arriba: barro, herramientas, manos pequeñas. Vertical.',
    src: '/fotos/kids/nina-modelando', anchos: VERTICAL,
    tono: 'verde', silueta: 'taza', posicion: '50% 70%',
  },

  // --- Eventos -------------------------------------------------------------
  'eventos-hero': {
    alt: 'Cuatro amigas celebrando un cumpleaños en Casa Numa con sus piezas',
    encuadre: 'Mesa puesta para un evento privado: barro, flores, copas. Horizontal amplia.',
    src: '/fotos/eventos/cumpleanos-grupo', anchos: HORIZONTAL,
    tono: 'indigo', silueta: 'doble',
  },
  'eventos-detalle': {
    alt: 'Mesa de un festejo en el estudio: flores, banderines y piezas por pintar',
    encuadre: 'Varias manos trabajando barro al mismo tiempo sobre la mesa. Vertical.',
    src: '/fotos/eventos/festejo-mesa', anchos: VERTICAL,
    tono: 'naranja', silueta: 'jarron',
  },

  // --- Store ---------------------------------------------------------------
  'store-hero': {
    alt: 'Piezas NUMA: rostros de barro, tazas, platos y una charola con jarritas',
    encuadre: 'Repisa del estudio con piezas terminadas a la venta, fondo limpio. Horizontal amplia.',
    src: '/fotos/piezas/coleccion', anchos: [640, 977],
    tono: 'crema', silueta: 'botellon',
  },

  // --- Nosotras ------------------------------------------------------------
  'nosotras-hero': {
    alt: 'Mónica en la mesa de trabajo del estudio',
    encuadre: 'El estudio de Casa Numa en un día normal de trabajo. Horizontal amplia.',
    src: '/fotos/nosotras/monica-estudio', anchos: HORIZONTAL,
    tono: 'crema', silueta: 'olla',
  },
  'retrato-monica': {
    alt: 'Mónica sonriendo con un ramo de alcatraces',
    encuadre: 'Retrato de Mónica trabajando una pieza de gran formato. Vertical.',
    src: '/fotos/nosotras/monica-alcatraces', anchos: [640, 875],
    tono: 'terracota', silueta: 'anfora',
  },
  'retrato-gloria': {
    alt: 'Gloria, creatividad, ideas y experiencias',
    encuadre: 'Retrato de Gloria recibiendo a alguien en el estudio. Vertical.',
    tono: 'amarillo', silueta: 'jarron',
  },
  'nosotras-comunidad': {
    alt: 'Tres alumnas conversando mientras trabajan en la mesa del estudio',
    encuadre: 'Conversación alrededor de la mesa durante una clase, plano abierto. Horizontal.',
    src: '/fotos/estudio/mesa-conversacion', anchos: HORIZONTAL,
    tono: 'verde', silueta: 'doble', posicion: '40% 50%',
  },

  // --- Cuenta --------------------------------------------------------------
  'cuenta-acceso': {
    alt: 'Manos dando forma a una placa de barro con una herramienta de madera',
    encuadre: 'Detalle de textura de barro trabajado. Vertical.',
    src: '/fotos/estudio/manos-placa', anchos: VERTICAL,
    tono: 'terracota', silueta: 'cuenco',
  },
} satisfies Record<string, EntradaFoto>;

export type IdFoto = keyof typeof FOTOS;
