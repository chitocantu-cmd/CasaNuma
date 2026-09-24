// ===========================================================================
// Mensajes precargados de WhatsApp
// ---------------------------------------------------------------------------
// Diferenciados por motivo (documento, sección 9): eventos, piezas
// disponibles y encargos. Quien los recibe sabe de qué se trata sin preguntar.
// ===========================================================================

export interface DatosEvento {
  tipo: string;
  fecha: string;
  personas: string;
  comentarios: string;
}

export function mensajeEvento(d: Partial<DatosEvento> = {}): string {
  return [
    'Hola Casa Numa, quisiera cotizar un evento.',
    '',
    `Tipo de evento: ${d.tipo ?? ''}`,
    `Fecha tentativa: ${d.fecha ?? ''}`,
    `Número de personas: ${d.personas ?? ''}`,
    `Comentarios: ${d.comentarios ?? ''}`,
  ].join('\n');
}

/** Talleres sin precio publicado ("Info DM"): pedir información. */
export function mensajeInformacionTaller(titulo: string, cuando: string): string {
  return `Hola Casa Numa, quiero información sobre «${titulo}» (${cuando}): precio y lugares disponibles.`;
}

export function mensajePieza(nombre: string): string {
  return `Hola Casa Numa, me interesa comprar la pieza «${nombre}» de NUMA Store. ¿Sigue disponible?`;
}

export function mensajeEncargo(nombre?: string): string {
  return nombre
    ? `Hola Casa Numa, me gustaría cotizar una pieza por encargo: «${nombre}». Les cuento lo que tengo en mente:`
    : 'Hola Casa Numa, me gustaría cotizar una pieza por encargo. Les cuento lo que tengo en mente:';
}
