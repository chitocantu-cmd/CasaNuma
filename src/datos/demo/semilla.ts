// ===========================================================================
// DATOS DE DEMOSTRACIÓN — MOCK DATA
// ---------------------------------------------------------------------------
// Nada de este archivo está confirmado por Casa Numa salvo lo que viene de
// src/contenido/oferta.ts (precio, días y horarios de membresía y NUMA Kids).
//
// · Talleres: los tres ejemplos que Casa Numa comunicó (documento, sección 5),
//   con fechas, precios, duraciones, inclusiones y cupos INVENTADOS para que
//   el flujo de reserva se pueda probar. La agenda real la carga el panel.
// · Cupos de membresía y NUMA Kids: pendientes; aquí 8 y 10 de ejemplo.
// · Productos: fichas de ejemplo; Casa Numa subirá las reales.
//
// Las fechas se generan respecto a hoy para que la demo nunca "caduque".
// ===========================================================================

import { KIDS, MEMBRESIA } from '../../contenido/oferta';
import {
  claveMes, diaSemana, diasDelMes, etiquetaMes, hoy, proximoDia, sumarDias, sumarMeses,
} from '../../lib/calendario';
import type { MesMembresia, Producto, Sesion, Taller } from '../tipos';

const CUPO_TALLER = 12;
const CUPO_MEMBRESIA = 8;
const CUPO_KIDS = 10;

/** Hash estable: la misma sesión siempre arranca con la misma ocupación. */
function hash(texto: string): number {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h;
}

/** Ocupación inicial simulada: algunas llenas, algunas con últimos lugares. */
export function ocupacionInicial(id: string, cupo: number): number {
  const r = hash(id) % 100;
  if (r < 14) return cupo;
  if (r < 36) return cupo - 1 - (hash(id + 'u') % 2);
  return hash(id + 'o') % Math.max(1, cupo - 3);
}

function sesion(id: string, fecha: string, inicio: string, fin: string, cupo: number): Sesion {
  return { id, fecha, inicio, fin, cupo, disponibles: cupo };
}

// ---------------------------------------------------------------------------
// Talleres de fin de semana
// ---------------------------------------------------------------------------
// Documento: "Tazas de Halloween: sábado, 11:00 a.m. y 4:00 p.m. · Tazas de
// Catrina: domingo, 11:00 a.m. · Cerámica libre: sábado del siguiente fin de
// semana, 11:00 a.m. y 4:00 p.m." Se anclan al fin de semana del 24 de
// octubre de 2026 y se recorren semanas completas si esa fecha ya pasó.
// ---------------------------------------------------------------------------
function anclaTalleres(): string {
  const base = '2026-10-24';
  const minimo = sumarDias(hoy(), 2);
  let f = base;
  while (f < minimo) f = sumarDias(f, 7);
  return f;
}

export function talleresSemilla(): Taller[] {
  const sabado = anclaTalleres();
  const domingo = sumarDias(sabado, 1);
  const sabadoSiguiente = sumarDias(sabado, 7);

  return [
    {
      id: 'demo-halloween',
      slug: 'tazas-de-halloween',
      titulo: 'Tazas de Halloween',
      resumen: 'Decora tu propia taza con motivos de Halloween y llévatela terminada.',
      descripcion: [
        'Una tarde para pintar tu taza con calabazas, fantasmas o lo que se te ocurra.',
        'No necesitas experiencia: te guiamos desde el primer trazo.',
      ],
      foto: 'taller-halloween',
      precio: 650,
      duracionMin: 120,
      incluye: ['Taza de cerámica', 'Pinturas y pinceles', 'Vidriado y horneado'],
      sesiones: [
        sesion(`hal-${sabado}-1100`, sabado, '11:00', '13:00', CUPO_TALLER),
        sesion(`hal-${sabado}-1600`, sabado, '16:00', '18:00', CUPO_TALLER),
      ],
      demo: true,
    },
    {
      id: 'demo-catrina',
      slug: 'tazas-de-catrina',
      titulo: 'Tazas de Catrina',
      resumen: 'Pinta una taza inspirada en la Catrina para celebrar Día de Muertos.',
      descripcion: [
        'Flores, calaveras y color: una taza con la fiesta más nuestra.',
        'Trabajas a tu ritmo, con el acompañamiento del equipo NUMA.',
      ],
      foto: 'taller-catrina',
      precio: 690,
      duracionMin: 120,
      incluye: ['Taza de cerámica', 'Pinturas y pinceles', 'Vidriado y horneado'],
      sesiones: [sesion(`cat-${domingo}-1100`, domingo, '11:00', '13:00', CUPO_TALLER)],
      demo: true,
    },
    {
      id: 'demo-libre',
      slug: 'ceramica-libre',
      titulo: 'Cerámica libre',
      resumen: 'Elige tu proyecto y dale forma con tus manos, sin guion fijo.',
      descripcion: [
        'Modela la pieza que tengas en mente con las técnicas de construcción a mano.',
        'Ideal si ya viniste antes o si quieres experimentar con libertad.',
      ],
      foto: 'taller-libre',
      precio: 600,
      duracionMin: 150,
      incluye: ['Arcilla', 'Herramientas del estudio', 'Vidriado y horneado'],
      sesiones: [
        sesion(`lib-${sabadoSiguiente}-1100`, sabadoSiguiente, '11:00', '13:30', CUPO_TALLER),
        sesion(`lib-${sabadoSiguiente}-1600`, sabadoSiguiente, '16:00', '18:30', CUPO_TALLER),
      ],
      demo: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Membresía: viernes, sábados y domingos de cada mes
// ---------------------------------------------------------------------------
export function sesionesMembresiaDelMes(clave: string): Sesion[] {
  return diasDelMes(clave).flatMap((fecha) => {
    const h = MEMBRESIA.horarios.find((x) => x.diaSemana === diaSemana(fecha));
    return h ? [sesion(`mem-${fecha}`, fecha, h.inicio, h.fin, CUPO_MEMBRESIA)] : [];
  });
}

/** El mes actual y los dos siguientes; el filtro de "reservable" va aparte. */
export function mesesMembresiaSemilla(): MesMembresia[] {
  const actual = claveMes(hoy());
  return [0, 1, 2].map((n) => {
    const clave = sumarMeses(actual, n);
    return { clave, etiqueta: etiquetaMes(clave), sesiones: sesionesMembresiaDelMes(clave), demo: true };
  });
}

// ---------------------------------------------------------------------------
// NUMA Kids: jueves a las 5:00 p.m., las próximas diez semanas
// ---------------------------------------------------------------------------
export function sesionesKidsSemilla(): Sesion[] {
  const primero = proximoDia(hoy(), KIDS.diaSemana);
  return Array.from({ length: 10 }, (_, i) => {
    const fecha = sumarDias(primero, i * 7);
    return sesion(`kids-${fecha}`, fecha, KIDS.inicio, KIDS.fin, CUPO_KIDS);
  });
}

// ---------------------------------------------------------------------------
// NUMA Store · fichas de ejemplo
// ---------------------------------------------------------------------------
export const PRODUCTOS_SEMILLA: Producto[] = [
  {
    id: 'p1', slug: 'taza-esmaltada', nombre: 'Taza esmaltada', categoria: 'Tazas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: 450,
    descripcion: 'Taza de gres modelada a mano, con asa cómoda y esmalte brillante por dentro.',
    dimensiones: 'Aprox. 9 cm de alto · 300 ml', acabados: 'Esmalte crema con borde terracota',
    fotos: [{ alt: 'Taza esmaltada', encuadre: 'Taza sobre fondo crema, luz lateral. Cuadrada.', tono: 'terracota', silueta: 'taza' }],
    demo: true,
  },
  {
    id: 'p2', slug: 'tarro-alto', nombre: 'Tarro alto', categoria: 'Tazas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: 520,
    descripcion: 'Tarro alto para café o té, con textura de barro visible en la base.',
    dimensiones: 'Aprox. 12 cm de alto · 400 ml', acabados: 'Esmalte mate',
    fotos: [{ alt: 'Tarro alto', encuadre: 'Tarro alto de perfil, fondo liso. Cuadrada.', tono: 'amarillo', silueta: 'tarro' }],
    demo: true,
  },
  {
    id: 'p3', slug: 'cuenco-hondo', nombre: 'Cuenco hondo', categoria: 'Vajillas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: 380,
    descripcion: 'Cuenco para sopa, cereal o para tenerlo en la mesa con fruta.',
    dimensiones: 'Aprox. 15 cm de diámetro', acabados: 'Esmalte crema',
    fotos: [{ alt: 'Cuenco hondo', encuadre: 'Cuenco visto desde arriba sobre mantel de lino. Cuadrada.', tono: 'crema', silueta: 'cuenco' }],
    demo: true,
  },
  {
    id: 'p4', slug: 'jarron-doble', nombre: 'Jarrón doble', categoria: 'Objetos decorativos',
    modalidad: 'disponible', disponibilidad: 'agotado', precio: 1200,
    descripcion: 'Jarrón de dos cuerpos, pensado para una sola rama o para lucir vacío.',
    dimensiones: 'Aprox. 24 cm de alto', acabados: 'Esmalte índigo',
    fotos: [{ alt: 'Jarrón doble', encuadre: 'Jarrón doble con una rama, fondo crema. Vertical.', tono: 'indigo', silueta: 'doble' }],
    demo: true,
  },
  {
    id: 'p5', slug: 'florero-guaje', nombre: 'Florero guaje', categoria: 'Objetos decorativos',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: 950,
    descripcion: 'Florero de silueta orgánica inspirado en el guaje.',
    dimensiones: 'Aprox. 20 cm de alto', acabados: 'Engobe verde y barro natural',
    fotos: [{ alt: 'Florero guaje', encuadre: 'Florero guaje sobre repisa de madera. Vertical.', tono: 'verde', silueta: 'guaje' }],
    demo: true,
  },
  {
    id: 'p6', slug: 'juego-de-platos', nombre: 'Juego de platos', categoria: 'Vajillas',
    modalidad: 'encargo', disponibilidad: 'bajo-pedido', precio: null,
    descripcion: 'Platos hechos a la medida de tu mesa: número de piezas, color y acabado a elegir.',
    acabados: 'A elegir',
    fotos: [{ alt: 'Juego de platos', encuadre: 'Mesa puesta con platos NUMA, vista cenital. Horizontal.', tono: 'naranja', silueta: 'cuenco' }],
    demo: true,
  },
  {
    id: 'p7', slug: 'anfora-gran-formato', nombre: 'Ánfora de gran formato', categoria: 'Creaciones especiales',
    modalidad: 'encargo', disponibilidad: 'bajo-pedido', precio: null,
    descripcion: 'Pieza escultórica de gran formato, diseñada contigo para un espacio concreto.',
    acabados: 'A definir en la cotización',
    fotos: [{ alt: 'Ánfora de gran formato', encuadre: 'Pieza de gran formato en su espacio final. Vertical.', tono: 'terracota', silueta: 'anfora' }],
    demo: true,
  },
  {
    id: 'p8', slug: 'olla-con-asas', nombre: 'Olla con asas', categoria: 'Objetos decorativos',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: 1100,
    descripcion: 'Olla decorativa con dos asas, para centro de mesa o para guardar lo que quieras.',
    dimensiones: 'Aprox. 18 cm de alto', acabados: 'Esmalte amarillo',
    fotos: [{ alt: 'Olla con asas', encuadre: 'Olla con asas sobre mesa de trabajo. Cuadrada.', tono: 'amarillo', silueta: 'olla' }],
    demo: true,
  },
];
