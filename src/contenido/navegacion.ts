import type { NombreSilueta } from '../componentes/marca/trazos';
import { EDADES_KIDS, MEMBRESIA, PINTA } from './oferta';
import { pesosCortos } from '../lib/formato';
import { PORCENTAJE_ANTICIPO } from '../lib/anticipo';

export interface ItemNav {
  label: string;
  to: string;
}

export const NAV: ItemNav[] = [
  { label: 'Talleres', to: '/talleres' },
  { label: 'Pinta tu pieza', to: '/pinta-tu-pieza' },
  { label: 'Membresía', to: '/membresia' },
  { label: 'NUMA Kids', to: '/numa-kids' },
  { label: 'Eventos', to: '/eventos' },
  { label: 'NUMA Store', to: '/numa-store' },
  { label: 'Nosotras', to: '/nosotras' },
];

export interface OpcionReserva {
  titulo: string;
  detalle: string;
  to: string;
  silueta: NombreSilueta;
  /** Se paga en línea o se cotiza por WhatsApp. */
  canal: 'en línea' | 'WhatsApp';
}

/** Las acciones de conversión del sitio, en orden de prioridad. */
export const OPCIONES_RESERVA: OpcionReserva[] = [
  { titulo: 'Clases de fin de semana', detalle: 'Elige taller, fecha y horario', to: '/talleres', silueta: 'taza', canal: 'en línea' },
  {
    titulo: 'Pinta tu pieza',
    detalle: `Desde ${pesosCortos(PINTA.precioDesde)} · apartas con el ${PORCENTAJE_ANTICIPO} % de tu pieza`,
    to: '/pinta-tu-pieza/reservar',
    silueta: 'jarron',
    canal: 'en línea',
  },
  {
    titulo: 'Membresía NUMA',
    detalle: `${pesosCortos(MEMBRESIA.precio)} al mes · ${MEMBRESIA.clasesPorMes} clases`,
    to: '/membresia/reservar',
    silueta: 'guaje',
    canal: 'en línea',
  },
  {
    titulo: 'NUMA Kids',
    detalle: `Jueves 5:00 p.m. · ${EDADES_KIDS}`,
    to: '/numa-kids/reservar',
    silueta: 'tarro',
    canal: 'en línea',
  },
  { titulo: 'Eventos especiales', detalle: 'Cotización personalizada', to: '/eventos', silueta: 'doble', canal: 'WhatsApp' },
];

export const LEGALES: ItemNav[] = [
  { label: 'Aviso de privacidad', to: '/aviso-de-privacidad' },
  { label: 'Términos', to: '/terminos' },
  { label: 'Política de reservaciones', to: '/politica-de-reservaciones' },
];
