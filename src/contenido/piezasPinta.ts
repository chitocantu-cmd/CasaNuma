import type { NombreSilueta } from '../componentes/marca/trazos';
import type { EntradaFoto } from './fotos';

// ===========================================================================
// Pinta tu pieza · catálogo de piezas de bizcochito
// ---------------------------------------------------------------------------
// Fotos reales de Casa Numa: WeTransfer «CASA NUMA - BIZCOCHITO» (Producciones
// Pujol, 7 oct 2026), en /public/fotos/pinta. Cada registro tiene la forma de
// una fila de la futura tabla `paint_pieces`.
//
// Regla: lo que Casa Numa no ha dado va en null. Nunca se rellena.
//   · Los nombres describen lo que se ve en la foto (provisionales).
//   · precio: null → «Precio pendiente»: la pieza se muestra pero no se puede
//     pagar; el botón invita a consultar por WhatsApp.
//   · stock: null  → sin conteo de existencias: no se limita.
//   · tamaño, acabado y si requiere quema: null hasta que lo confirmen.
// El equipo captura precio y existencias desde el panel (Piezas).
// ===========================================================================

export type CategoriaPieza = 'Tazas y vasos' | 'Platos y bowls' | 'Floreros y macetas' | 'Figuras y decoración';

export const CATEGORIAS_PIEZA: CategoriaPieza[] = ['Tazas y vasos', 'Platos y bowls', 'Floreros y macetas', 'Figuras y decoración'];

export interface RegistroPieza {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaPieza;
  fotos: EntradaFoto[];
  precio: number | null;
  tamano: string | null;
  acabado: string | null;
  requiereQuema: boolean | null;
  stock: number | null;
  activa: boolean;
}

const ANCHOS = [640, 1280] as const;

/** Foto de producto: la pieza en bizcochito sobre la repisa amarilla, recorte 4:5. */
function foto(archivo: string, alt: string, silueta: NombreSilueta): EntradaFoto {
  return {
    alt,
    encuadre: 'Pieza de bizcochito sobre la repisa amarilla del estudio. Vertical 4:5.',
    src: `/fotos/pinta/${archivo}`,
    anchos: ANCHOS,
    tono: 'amarillo',
    silueta,
  };
}

const pieza = (
  id: string, nombre: string, categoria: CategoriaPieza, descripcion: string, fotos: EntradaFoto[],
): RegistroPieza => ({
  id, nombre, categoria, descripcion, fotos,
  precio: null, tamano: null, acabado: null, requiereQuema: null, stock: null, activa: true,
});

export const PIEZAS_PINTA: RegistroPieza[] = [
  // --- Tazas y vasos -------------------------------------------------------
  pieza('taza-recta', 'Taza recta', 'Tazas y vasos', 'Taza de paredes rectas con asa.', [
    foto('taza-recta', 'Taza recta de bizcochito con asa', 'taza'),
  ]),
  pieza('taza-dona', 'Taza dona', 'Tazas y vasos', 'Taza redonda con forma de dona y chispas en relieve.', [
    foto('taza-dona', 'Taza con forma de dona y chispas en relieve', 'taza'),
  ]),
  pieza('taza-cafe', 'Taza para café', 'Tazas y vasos', 'Taza de boca amplia; una versión esconde un perrito y un corazón en el fondo.', [
    foto('taza-cafe', 'Dos tazas para café; una con un perrito y un corazón en el fondo', 'taza'),
  ]),
  pieza('vasos', 'Vaso cilíndrico', 'Tazas y vasos', 'Vaso de paredes rectas, en versión alta y chica.', [
    foto('vasos', 'Vaso cilíndrico alto junto a uno chico', 'tarro'),
  ]),
  pieza('cactus', 'Vaso cactus', 'Tazas y vasos', 'Vaso con forma de cactus, con brazos y puntitos en relieve.', [
    foto('cactus', 'Vaso con forma de cactus', 'tarro'),
  ]),
  pieza('jarra', 'Jarra', 'Tazas y vasos', 'Jarra alta y esbelta con pico y asa.', [
    foto('jarra', 'Jarra alta de bizcochito con asa', 'jarron'),
    foto('jarra-2', 'Jarra alta de bizcochito, vista de lado', 'jarron'),
  ]),

  // --- Platos y bowls ------------------------------------------------------
  pieza('plato', 'Plato', 'Platos y bowls', 'Plato de borde suave, para pintar de orilla a orilla.', [
    foto('plato', 'Plato de bizcochito de pie sobre la repisa', 'cuenco'),
  ]),
  pieza('platitos', 'Plato para taza y platito', 'Platos y bowls', 'Plato para taza y un platito hondo.', [
    foto('platitos', 'Plato para taza en un atril junto a un platito hondo', 'cuenco'),
  ]),
  pieza('bowl', 'Bowl', 'Platos y bowls', 'Bowl redondo y hondo.', [
    foto('bowl', 'Bowl redondo de bizcochito', 'cuenco'),
    foto('bowl-2', 'Bowl redondo sobre un atril', 'cuenco'),
  ]),
  pieza('bowl-picos', 'Bowl con picos', 'Platos y bowls', 'Bowl con dos picos a los lados, en varios tamaños.', [
    foto('bowl-picos', 'Bowl con dos picos a los lados', 'cuenco'),
  ]),
  pieza('bowl-limon', 'Bowl limón', 'Platos y bowls', 'Bowl pequeño con forma de limón.', [
    foto('bowl-limon', 'Bowl con forma de limón sobre un atril', 'cuenco'),
    foto('bowl-limon-2', 'Bowl con forma de limón', 'cuenco'),
  ]),
  pieza('refractario', 'Refractario rectangular', 'Platos y bowls', 'Refractario rectangular de bordes bajos.', [
    foto('refractario', 'Refractario rectangular de bizcochito', 'cuenco'),
  ]),
  pieza('charola-asa', 'Charola con asa', 'Platos y bowls', 'Charola de borde ondulado, con asa y cuadrícula en relieve.', [
    foto('charola-asa', 'Charola de borde ondulado con asa y cuadrícula en relieve', 'cuenco'),
  ]),

  // --- Floreros y macetas --------------------------------------------------
  pieza('florero-dulce', 'Florero dulce', 'Floreros y macetas', 'Florero con forma de dulce envuelto.', [
    foto('florero-dulce', 'Florero con forma de dulce envuelto, con flores', 'jarron'),
    foto('florero-dulce-2', 'Florero con forma de dulce envuelto', 'jarron'),
  ]),
  pieza('bolsa', 'Bolsa', 'Floreros y macetas', 'Bolsa de cerámica con dos asas.', [
    foto('bolsa', 'Bolsa de cerámica con dos asas', 'tarro'),
    foto('bolsa-2', 'Bolsa de cerámica con dos asas, vista de frente', 'tarro'),
  ]),
  pieza('corazon-facetado', 'Corazón facetado', 'Floreros y macetas', 'Corazón de caras geométricas, hueco por dentro.', [
    foto('corazon-facetado', 'Corazón de caras geométricas', 'olla'),
  ]),
  pieza('corazon-anatomico', 'Corazón anatómico', 'Floreros y macetas', 'Corazón anatómico con aberturas arriba.', [
    foto('corazon-anatomico', 'Corazón anatómico de bizcochito', 'olla'),
  ]),
  pieza('maceta-geometrica', 'Maceta geométrica', 'Floreros y macetas', 'Maceta baja de caras geométricas.', [
    foto('maceta-geometrica', 'Maceta baja de caras geométricas', 'cuenco'),
  ]),
  pieza('cuenco-erizo', 'Cuenco erizo', 'Floreros y macetas', 'Cuenco bajo con picos en relieve; en la foto, con el interior esmaltado.', [
    foto('cuenco-erizo', 'Cuenco con picos en relieve y el interior esmaltado en azul claro', 'cuenco'),
  ]),

  // --- Figuras y decoración ------------------------------------------------
  pieza('sagrado-corazon', 'Sagrado corazón', 'Figuras y decoración', 'Corazón con llamas y rosas en relieve.', [
    foto('sagrado-corazon', 'Sagrado corazón con llamas y rosas en relieve', 'olla'),
  ]),
  pieza('corazon', 'Corazón', 'Figuras y decoración', 'Corazón en relieve, con atril.', [
    foto('corazon', 'Corazón en relieve sobre un atril', 'olla'),
  ]),
  pieza('virgen', 'Virgen de Guadalupe', 'Figuras y decoración', 'Figura de la Virgen de Guadalupe.', [
    foto('virgen', 'Figura de la Virgen de Guadalupe en bizcochito', 'botellon'),
    foto('virgen-2', 'Figura de la Virgen de Guadalupe, vista de lado', 'botellon'),
  ]),
  pieza('calavera', 'Calavera', 'Figuras y decoración', 'Calavera hueca, abierta por arriba.', [
    foto('calavera', 'Calavera de bizcochito, abierta por arriba', 'olla'),
  ]),
  pieza('bota', 'Bota vaquera', 'Figuras y decoración', 'Bota vaquera con costuras en relieve.', [
    foto('bota', 'Bota vaquera con costuras en relieve', 'botellon'),
  ]),
  pieza('gato', 'Gato de la suerte', 'Figuras y decoración', 'Gato de la suerte con la patita levantada.', [
    foto('gato', 'Gato de la suerte con la patita levantada', 'tarro'),
  ]),
  pieza('perro-globo', 'Perrito de globo', 'Figuras y decoración', 'Perrito con forma de globo.', [
    foto('perro-globo', 'Perrito con forma de globo', 'doble'),
  ]),
  pieza('pug', 'Perrito pug', 'Figuras y decoración', 'Perrito pug echado.', [
    foto('pug', 'Perrito pug echado', 'doble'),
  ]),
  pieza('dona', 'Dona', 'Figuras y decoración', 'Dona con chispas en relieve.', [
    foto('dona', 'Dona con chispas en relieve', 'olla'),
  ]),
  pieza('cupcake', 'Cupcake', 'Figuras y decoración', 'Cupcake con tapa.', [
    foto('cupcake', 'Cupcake de bizcochito', 'tarro'),
  ]),
  pieza('flor', 'Flor con tapa', 'Figuras y decoración', 'Cajita en forma de flor, con tapa.', [
    foto('flor', 'Cajita en forma de flor, abierta', 'olla'),
    foto('flor-2', 'Cajita en forma de flor, cerrada', 'olla'),
  ]),
  pieza('caja-redonda', 'Caja redonda con tapa', 'Figuras y decoración', 'Caja redonda y baja, con tapa.', [
    foto('caja-redonda', 'Caja redonda con la tapa recargada', 'cuenco'),
    foto('caja-redonda-2', 'Caja redonda con tapa, de cerca', 'cuenco'),
  ]),
  pieza('calabaza', 'Calabaza con tapa', 'Figuras y decoración', 'Calabaza con tapa.', [
    foto('calabaza', 'Calabaza de bizcochito con tapa', 'olla'),
  ]),
  pieza('calabaza-halloween', 'Calabaza de Halloween', 'Figuras y decoración', 'Calabaza con cara de Halloween calada y tapa.', [
    foto('calabaza-halloween', 'Calabaza con cara de Halloween calada', 'olla'),
  ]),
];

/**
 * Precios de ejemplo para recorrer la demo (los de la actualización de Casa
 * Numa: «TAZA $300, JARRÓN $600, PIEZA DECORATIVA $900 — solo ejemplos de
 * desarrollo»). Se aplican únicamente con datos de demostración visibles y
 * la pieza queda marcada «Precio de ejemplo».
 */
export const PRECIOS_EJEMPLO: Record<string, number> = {
  'taza-recta': 300,
  'florero-dulce': 600,
  'sagrado-corazon': 900,
};

/** Galería inspiracional: fotos reales, en orden editorial (no es el catálogo). */
export const GALERIA_PINTA: EntradaFoto[] = [
  foto('florero-dulce', 'Florero dulce de bizcochito con flores', 'jarron'),
  {
    alt: 'Tres bowls con picos de distintos tamaños sobre la repisa amarilla',
    encuadre: 'Bowls con picos en fila. Horizontal 3:2.',
    src: '/fotos/pinta/bowls-trio', anchos: [640, 1280, 1920], tono: 'amarillo', silueta: 'cuenco',
  },
  foto('perro-globo', 'Perrito de globo en bizcochito', 'doble'),
  foto('sagrado-corazon', 'Sagrado corazón con llamas y rosas', 'olla'),
  foto('bota', 'Bota vaquera con costuras en relieve', 'botellon'),
  foto('virgen', 'Virgen de Guadalupe en bizcochito', 'botellon'),
  foto('calabaza-halloween', 'Calabaza de Halloween con tapa', 'olla'),
];
