// ===========================================================================
// DATOS DE DEMOSTRACIÓN — MOCK DATA
// ---------------------------------------------------------------------------
// Los talleres ya NO salen de aquí: la agenda real vive en src/datos/agenda.ts.
//
// Las fechas de NUMA Kids y de las clases de membresía salen de la agenda
// real (Tardes de Cerámica · Niños y Clases de Cerámica). Un mes que Casa
// Numa no ha publicado no se ofrece: no se inventan fechas.
//
// Lo que sigue siendo de ejemplo:
// · El historial de las reservas DEMO en meses sin agenda publicada usa el
//   patrón del PDF (viernes, sábados y domingos) solo para que el panel no
//   arranque vacío.
// · Productos de NUMA Store: fichas de ejemplo; Casa Numa subirá las reales.
//
// Las fechas se generan respecto a hoy para que la demo nunca "caduque".
// ===========================================================================

import { MEMBRESIA } from '../../contenido/oferta';
import { claveMes, diaSemana, diasDelMes, etiquetaMes, hoy } from '../../lib/calendario';
import type { MesMembresia, Producto, Sesion } from '../tipos';
import { AGENDA, flujoAgenda, idSesionAgenda } from '../agenda';

function sesion(id: string, fecha: string, inicio: string, fin: string | null, cupo: number | null): Sesion {
  return { id, fecha, inicio, fin, cupo, disponibles: cupo, agotada: false };
}

/** Sesiones de la agenda de un camino ('kids' o 'membresia'), por fecha. */
function sesionesDeAgenda(flujo: 'kids' | 'membresia'): Sesion[] {
  return AGENDA.filter((r) => r.is_active && flujoAgenda(r) === flujo)
    .flatMap((r) => r.sessions.map((x) => sesion(idSesionAgenda(r, x.start_time), r.date, x.start_time, x.end_time, x.capacity)))
    .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
}

// ---------------------------------------------------------------------------
// Membresía: las Clases de Cerámica publicadas en la agenda
// ---------------------------------------------------------------------------
/**
 * Clases de membresía de un mes. Si el mes está en la agenda, son esas. Si
 * no (solo pasa con el historial de reservas DEMO), el patrón del PDF.
 */
export function sesionesMembresiaDelMes(clave: string): Sesion[] {
  const publicadas = sesionesDeAgenda('membresia').filter((s) => claveMes(s.fecha) === clave);
  if (publicadas.length) return publicadas;
  return diasDelMes(clave).flatMap((fecha) => {
    const h = MEMBRESIA.horarios.find((x) => x.diaSemana === diaSemana(fecha));
    return h ? [sesion(`mem-${fecha}`, fecha, h.inicio, h.fin, null)] : [];
  });
}

/** Meses con clases publicadas, de este mes en adelante. */
export function mesesMembresiaSemilla(): MesMembresia[] {
  const actual = claveMes(hoy());
  const meses = [...new Set(sesionesDeAgenda('membresia').map((s) => claveMes(s.fecha)))].filter((m) => m >= actual);
  return meses.map((clave) => ({ clave, etiqueta: etiquetaMes(clave), sesiones: sesionesMembresiaDelMes(clave), demo: false }));
}

// ---------------------------------------------------------------------------
// NUMA Kids: las Tardes de Cerámica (Niños) publicadas en la agenda
// ---------------------------------------------------------------------------
export function sesionesKidsSemilla(): Sesion[] {
  return sesionesDeAgenda('kids');
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
