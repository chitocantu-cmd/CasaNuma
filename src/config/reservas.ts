// ===========================================================================
// Reglas de cobro de las reservas en línea (bookingConfig)
// ---------------------------------------------------------------------------
// Toda experiencia que se reserva en el sitio —talleres, NUMA Kids, membresía
// y Pinta tu pieza— se confirma pagando este porcentaje del total; el resto
// se liquida después en Casa Numa. Eventos y NUMA Store no se reservan en
// línea (WhatsApp) y no usan esta regla.
//
// Es el único lugar donde vive el número. La cuenta está en lib/anticipo.ts.
// ===========================================================================

export const CONFIG_RESERVAS = {
  /** depositPercentage */
  porcentajeAnticipo: 50,
} as const;
