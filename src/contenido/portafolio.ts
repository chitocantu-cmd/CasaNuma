import type { EntradaFoto } from './fotos';

// ===========================================================================
// Portafolio NUMA · galería editorial de piezas propias
// ---------------------------------------------------------------------------
// Inspiración, no tienda: aquí no hay precios ni botón de compra (documento,
// sección 2). Cada entrada espera su fotografía real; las categorías salen
// del documento: tazas, vajillas, jarrones, piezas decorativas y obras de
// Niki/Mónica.
// ===========================================================================

export interface PiezaPortafolio {
  id: string;
  titulo: string;
  categoria: string;
  autora?: string;
  foto: EntradaFoto;
}

export const PORTAFOLIO: PiezaPortafolio[] = [
  {
    id: 'jarrones',
    titulo: 'Jarrones',
    categoria: 'Piezas decorativas',
    foto: {
      alt: 'Jarrones hechos a mano en Casa Numa',
      encuadre: 'Jarrones NUMA de distintas alturas sobre repisa, luz lateral. Vertical 4:5.',
      referencia: 'jarrones', tono: 'terracota', silueta: 'botellon',
    },
  },
  {
    id: 'tazas',
    titulo: 'Tazas',
    categoria: 'Uso diario',
    foto: {
      alt: 'Tazas hechas en Casa Numa',
      encuadre: 'Tazas NUMA en fila sobre la mesa de trabajo, fondo liso. Cuadrada.',
      tono: 'amarillo', silueta: 'taza',
    },
  },
  {
    id: 'cuenco',
    titulo: 'Cuencos pintados',
    categoria: 'Piezas decorativas',
    foto: {
      alt: 'Cuenco pintado a mano',
      encuadre: 'Cuenco decorado a mano, plano cerrado con las manos que lo sostienen. Cuadrada.',
      referencia: 'cuenco-corazon', tono: 'crema', silueta: 'cuenco',
    },
  },
  {
    id: 'vajilla',
    titulo: 'Vajillas',
    categoria: 'Mesa',
    foto: {
      alt: 'Vajilla NUMA puesta en la mesa',
      encuadre: 'Vajilla NUMA completa puesta en una mesa, vista cenital. Horizontal 16:10.',
      tono: 'naranja', silueta: 'cuenco',
    },
  },
  {
    id: 'gran-formato',
    titulo: 'Gran formato',
    categoria: 'Obra',
    autora: 'Mónica',
    foto: {
      alt: 'Pieza de gran formato de Mónica',
      encuadre: 'Pieza o mural de gran formato de Mónica, con escala humana a cuadro. Vertical 3:4.',
      tono: 'indigo', silueta: 'anfora',
    },
  },
  {
    id: 'experimentales',
    titulo: 'Piezas experimentales',
    categoria: 'Estudio',
    foto: {
      alt: 'Pruebas de esmalte y piezas experimentales',
      encuadre: 'Pruebas de esmalte y piezas experimentales sobre la repisa del estudio. Cuadrada.',
      tono: 'verde', silueta: 'guaje',
    },
  },
  {
    id: 'raices',
    titulo: 'Raíces',
    categoria: 'Obra',
    autora: 'Mónica',
    foto: {
      alt: 'Pieza de Mónica inspirada en el arte maya',
      encuadre: 'Obra de Mónica inspirada en el arte maya y las piezas arqueológicas. Horizontal 4:3.',
      tono: 'terracota', silueta: 'olla',
    },
  },
];
