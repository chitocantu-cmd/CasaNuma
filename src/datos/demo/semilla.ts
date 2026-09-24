// ===========================================================================
// DATOS DE DEMOSTRACIÓN — MOCK DATA
// ---------------------------------------------------------------------------
// Los talleres ya NO salen de aquí: la agenda real vive en src/datos/agenda.ts.
//
// Lo que sigue siendo de ejemplo:
// · Fechas concretas y cupos de membresía y NUMA Kids (8 y 10 de ejemplo):
//   los días, horarios y precios sí vienen de src/contenido/oferta.ts.
// · Productos de NUMA Store: fichas de ejemplo; Casa Numa subirá las reales.
//
// Las fechas se generan respecto a hoy para que la demo nunca "caduque".
// ===========================================================================

import { KIDS, MEMBRESIA } from '../../contenido/oferta';
import {
  claveMes, diaSemana, diasDelMes, etiquetaMes, hoy, proximoDia, sumarDias, sumarMeses,
} from '../../lib/calendario';
import type { MesMembresia, Producto, Sesion } from '../tipos';
import { AGENDA } from '../agenda';

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
  return { id, fecha, inicio, fin, cupo, disponibles: cupo, agotada: false };
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
  // Si la agenda real ya tiene un taller de niños ese jueves a la misma hora
  // (p. ej. "Tardes de Cerámica (Niños)" del 1 de octubre), manda la agenda:
  // no se ofrece además una sesión de NUMA Kids de ejemplo en el mismo horario.
  const ocupados = new Set(
    AGENDA.filter((t) => t.is_active && t.category === 'kids' && t.sessions.some((x) => x.start_time === KIDS.inicio))
      .map((t) => t.date),
  );
  const primero = proximoDia(hoy(), KIDS.diaSemana);
  return Array.from({ length: 10 }, (_, i) => sumarDias(primero, i * 7))
    .filter((fecha) => !ocupados.has(fecha))
    .map((fecha) => sesion(`kids-${fecha}`, fecha, KIDS.inicio, KIDS.fin, CUPO_KIDS));
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
