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
// · NUMA Store: piezas reales, pero sin precio ni medidas todavía.
//
// Las fechas se generan respecto a hoy para que la demo nunca "caduque".
// ===========================================================================

import { MEMBRESIA } from '../../contenido/oferta';
import { claveMes, diaSemana, diasDelMes, etiquetaMes, hoy } from '../../lib/calendario';
import type { EntradaFoto } from '../../contenido/fotos';
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
// NUMA Store
// ---------------------------------------------------------------------------
// Piezas reales de Casa Numa (sesión de producción, 25 sep 2026). Nombre y
// descripción salen de la foto; precio, medidas y acabados aún no los da
// Casa Numa, así que se cotizan por WhatsApp (precio null = «Cotizar»).
// Las dos fichas por encargo siguen siendo de ejemplo (demo: true).
// ---------------------------------------------------------------------------
const VERTICAL = [640, 1280] as const;
const pieza = (nombre: string, alt: string, tono: EntradaFoto['tono'], silueta: EntradaFoto['silueta']): EntradaFoto => ({
  alt, encuadre: 'Pieza sobre mesa de madera, fondo del estudio.', src: `/fotos/piezas/${nombre}`, anchos: VERTICAL,
  tono, silueta, posicion: '50% 55%',
});

export const PRODUCTOS_SEMILLA: Producto[] = [
  {
    id: 'p1', slug: 'taza-con-carita', nombre: 'Taza con carita', categoria: 'Tazas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Taza blanca hecha a mano, con una carita y flores en relieve.',
    fotos: [pieza('taza-carita', 'Taza blanca con una carita y flores en relieve', 'crema', 'taza')],
    demo: false,
  },
  {
    id: 'p2', slug: 'taza-van-gogh', nombre: 'Taza Van Gogh', categoria: 'Tazas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Taza azul con espirales en relieve inspiradas en La noche estrellada de Van Gogh.',
    fotos: [pieza('taza-van-gogh-azul', 'Taza azul con espirales en relieve', 'indigo', 'taza')],
    demo: false,
  },
  {
    id: 'p3', slug: 'charola-con-jarritas', nombre: 'Charola con jarritas', categoria: 'Vajillas',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Charola roja con asa y tres jarritas pintadas a mano: amarilla, de lunares y de rayas.',
    fotos: [pieza('charola-jarritas', 'Charola roja con asa y tres jarritas', 'naranja', 'jarron')],
    demo: false,
  },
  {
    id: 'p4', slug: 'rostro-ojos-turquesa', nombre: 'Rostro de ojos turquesa', categoria: 'Objetos decorativos',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Pieza con rostro de ojos turquesa, cabello en relieve y hojas a los lados.',
    fotos: [pieza('rostro-ojos-turquesa', 'Pieza con rostro de ojos turquesa y cabello en relieve', 'amarillo', 'tarro')],
    demo: false,
  },
  {
    id: 'p5', slug: 'porta-anillos', nombre: 'Porta anillos', categoria: 'Objetos decorativos',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Porta anillos de cerámica blanca moteada, con tres postes para tus anillos.',
    fotos: [pieza('porta-anillos', 'Porta anillos de cerámica blanca moteada', 'crema', 'cuenco')],
    demo: false,
  },
  {
    id: 'p6', slug: 'vasija-con-rostro', nombre: 'Vasija con rostro', categoria: 'Creaciones especiales',
    modalidad: 'disponible', disponibilidad: 'disponible', precio: null,
    descripcion: 'Vasija de barro terracota con un rostro y tocado en relieve.',
    fotos: [pieza('vasija-rostro', 'Vasija de barro terracota con un rostro y tocado en relieve', 'terracota', 'olla')],
    demo: false,
  },
  {
    id: 'p7', slug: 'juego-de-platos', nombre: 'Juego de platos', categoria: 'Vajillas',
    modalidad: 'encargo', disponibilidad: 'bajo-pedido', precio: null,
    descripcion: 'Platos hechos a la medida de tu mesa: número de piezas, color y acabado a elegir.',
    acabados: 'A elegir',
    fotos: [{
      alt: 'Platos de cerámica con lunares rojos y ondas amarillas en relieve', encuadre: 'Platos NUMA sobre mesa de madera.',
      src: '/fotos/piezas/platos-relieve', anchos: [640, 1280, 1920], tono: 'naranja', silueta: 'cuenco',
    }],
    demo: true,
  },
  {
    id: 'p8', slug: 'anfora-gran-formato', nombre: 'Ánfora de gran formato', categoria: 'Creaciones especiales',
    modalidad: 'encargo', disponibilidad: 'bajo-pedido', precio: null,
    descripcion: 'Pieza escultórica de gran formato, diseñada contigo para un espacio concreto.',
    acabados: 'A definir en la cotización',
    fotos: [{ alt: 'Ánfora de gran formato', encuadre: 'Pieza de gran formato en su espacio final. Vertical.', tono: 'terracota', silueta: 'anfora' }],
    demo: true,
  },
];
