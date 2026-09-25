import type { EntradaFoto } from './fotos';

// ===========================================================================
// Portafolio NUMA · galería editorial de piezas propias
// ---------------------------------------------------------------------------
// Inspiración, no tienda: aquí no hay precios ni botón de compra (documento,
// sección 2). Piezas hechas en Casa Numa, de la sesión de producción
// (WeTransfer «Fotos WEB - NUMA», 25 sep 2026). El orden sigue la retícula de
// EditorialGallery: vertical grande, cuadrada, vertical, horizontal 16:10,
// vertical 3:4, cuadrada, horizontal 4:3.
// ===========================================================================

export interface PiezaPortafolio {
  id: string;
  titulo: string;
  categoria: string;
  autora?: string;
  foto: EntradaFoto;
}

const VERTICAL = [640, 1280] as const;

export const PORTAFOLIO: PiezaPortafolio[] = [
  {
    id: 'vasija-rostro',
    titulo: 'Vasija con rostro',
    categoria: 'Piezas escultóricas',
    foto: {
      alt: 'Vasija de barro terracota con un rostro y tocado en relieve',
      encuadre: 'Pieza escultórica sobre mesa de madera. Vertical 4:5.',
      src: '/fotos/piezas/vasija-rostro', anchos: VERTICAL,
      tono: 'terracota', silueta: 'olla', posicion: '50% 55%',
    },
  },
  {
    id: 'taza-carita',
    titulo: 'Taza con carita',
    categoria: 'Tazas',
    foto: {
      alt: 'Taza blanca con una carita y flores en relieve',
      encuadre: 'Taza sobre mesa de madera. Cuadrada.',
      src: '/fotos/piezas/taza-carita', anchos: VERTICAL,
      tono: 'crema', silueta: 'taza', posicion: '50% 55%',
    },
  },
  {
    id: 'rostro-ojos-turquesa',
    titulo: 'Rostro de ojos turquesa',
    categoria: 'Piezas decorativas',
    foto: {
      alt: 'Pieza con rostro de ojos turquesa, cabello en relieve y hojas a los lados',
      encuadre: 'Pieza decorativa sobre mesa de madera. Vertical 4:5.',
      src: '/fotos/piezas/rostro-ojos-turquesa', anchos: VERTICAL,
      tono: 'amarillo', silueta: 'tarro', posicion: '50% 55%',
    },
  },
  {
    id: 'platos-relieve',
    titulo: 'Platos con relieve',
    categoria: 'Vajillas',
    foto: {
      alt: 'Platos de cerámica apilados con lunares rojos y ondas amarillas en relieve',
      encuadre: 'Vajilla sobre mesa de madera. Horizontal 16:10.',
      src: '/fotos/piezas/platos-relieve', anchos: [640, 1280, 1920],
      tono: 'naranja', silueta: 'cuenco',
    },
  },
  {
    id: 'charola-jarritas',
    titulo: 'Charola con jarritas',
    categoria: 'Mesa',
    foto: {
      alt: 'Charola roja con asa y tres jarritas: amarilla, de lunares y de rayas',
      encuadre: 'Juego de mesa sobre madera. Vertical 3:4.',
      src: '/fotos/piezas/charola-jarritas', anchos: VERTICAL,
      tono: 'naranja', silueta: 'jarron', posicion: '50% 60%',
    },
  },
  {
    id: 'porta-anillos',
    titulo: 'Porta anillos',
    categoria: 'Objetos',
    foto: {
      alt: 'Porta anillos de cerámica blanca moteada',
      encuadre: 'Objeto pequeño sobre mesa de madera. Cuadrada.',
      src: '/fotos/piezas/porta-anillos', anchos: VERTICAL,
      tono: 'crema', silueta: 'cuenco', posicion: '50% 60%',
    },
  },
  {
    id: 'taza-van-gogh',
    titulo: 'Taza Van Gogh',
    categoria: 'Tazas',
    foto: {
      alt: 'Taza azul con espirales en relieve inspiradas en La noche estrellada',
      encuadre: 'Taza sobre mesa de madera. Horizontal 4:3.',
      src: '/fotos/piezas/taza-van-gogh-azul', anchos: VERTICAL,
      tono: 'indigo', silueta: 'taza', posicion: '50% 55%',
    },
  },
];
