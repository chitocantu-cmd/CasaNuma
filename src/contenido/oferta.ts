// ===========================================================================
// Datos operativos confirmados (Casa_Numa_Contenido_Webpdf.pdf, secciones 3-4)
// ---------------------------------------------------------------------------
// Única fuente de precios, horarios e inclusiones de membresía y NUMA Kids.
// Si Casa Numa cambia uno, se cambia aquí y se actualiza en todo el sitio.
// ===========================================================================

import type { NombreIcono } from '../componentes/base/Iconos';

export interface HorarioClase {
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
  dia: string;
  inicio: string;
  fin: string;
}

export interface Inclusion {
  icono: NombreIcono;
  titulo: string;
  texto?: string;
}

export const MEMBRESIA = {
  precio: 3200,
  clasesPorMes: 4,
  horasPorClase: 3,
  horasPorMes: 12,
  horarios: [
    { diaSemana: 5, dia: 'Viernes', inicio: '10:00', fin: '13:00' },
    { diaSemana: 6, dia: 'Sábados', inicio: '11:00', fin: '14:00' },
    { diaSemana: 0, dia: 'Domingos', inicio: '11:00', fin: '14:00' },
  ] satisfies HorarioClase[],
  incluye: [
    {
      icono: 'calendario',
      titulo: '4 clases al mes',
      texto: 'Cuatro sesiones de tres horas cada una: 12 horas de cerámica al mes.',
    },
    {
      icono: 'arcilla',
      titulo: '3 kg de arcilla en total',
      texto: 'Aproximadamente 3 kg de arcilla en total para las cuatro clases, no por clase.',
    },
    {
      icono: 'herramientas',
      titulo: 'Materiales y herramientas',
      texto: 'Materiales y uso de las herramientas del estudio.',
    },
    {
      icono: 'pincel',
      titulo: 'Pinturas',
      texto: 'Pinturas para personalizar tus piezas.',
    },
    {
      icono: 'vidriado',
      titulo: 'Vidriado',
      texto: 'Vidriado de las piezas realizadas durante la membresía.',
    },
    {
      icono: 'horno',
      titulo: 'Horneado',
      texto: 'Horneado de las piezas realizadas durante la membresía.',
    },
    {
      icono: 'acompanamiento',
      titulo: 'Acompañamiento creativo',
      texto: 'Acompañamiento creativo y guía durante las sesiones.',
    },
  ] satisfies Inclusion[],
  /** Resumen para el bloque de inversión. */
  incluyeCorto: [
    'Cuatro clases de tres horas',
    'Arcilla',
    'Materiales',
    'Herramientas',
    'Pintura',
    'Vidriado',
    'Horneado',
    'Acompañamiento',
  ],
} as const;

export const KIDS = {
  precio: 680,
  // "Talleres octubre numa.docx" (Tardes de Cerámica · Niños, jueves 5:00 p.m.,
  // $680): 10 a 14 años. Reemplaza el "a partir de 7" del PDF.
  edadMinima: 10,
  edadMaxima: 14,
  diaSemana: 4,
  dia: 'Jueves',
  inicio: '17:00',
  fin: '18:30',
  duracionMin: 90,
  incluye: [
    { icono: 'arcilla', titulo: 'Arcilla' },
    { icono: 'pieza', titulo: 'Materiales' },
    { icono: 'herramientas', titulo: 'Uso de herramientas' },
    { icono: 'pincel', titulo: 'Pintura' },
    { icono: 'vidriado', titulo: 'Vidriado' },
    { icono: 'horno', titulo: 'Horneado' },
  ] satisfies Inclusion[],
} as const;

/** "10 a 14 años" */
export const EDADES_KIDS = `${KIDS.edadMinima} a ${KIDS.edadMaxima} años`;

/** Qué se paga en línea y qué se atiende por WhatsApp (documento, sección 1). */
export const CANALES = {
  enLinea: ['Talleres de fin de semana', 'Membresía NUMA', 'NUMA Kids'],
  whatsapp: ['Eventos especiales', 'Compras y encargos de NUMA Store'],
} as const;
