import type {
  Aviso, CambiosTaller, ClienteAdmin, Integraciones, EstadoPago, EstadoReserva, MembresiaAdmin, MesMembresia, MetodoPago,
  Pago, PiezaPinta, Producto, Registro, Reserva, ResultadoPago, ResumenAdmin, Sesion, SesionAdmin, SolicitudManual,
  SolicitudReserva, Taller, TallerCatalogo, TallerNuevo, Usuario,
} from './tipos';


// ===========================================================================
// Contrato de datos del sitio
// ---------------------------------------------------------------------------
// Las páginas solo conocen esta interfaz. Hoy la cumple el modo demo
// (src/datos/demo); mañana la cumplirá Supabase sin tocar un solo componente.
// El mapeo método → tabla / Edge Function está en docs/INTEGRACION.md.
// ===========================================================================

export interface Repositorio {
  // --- Catálogo ------------------------------------------------------------
  talleres(): Promise<Taller[]>;
  taller(slug: string): Promise<Taller | null>;
  mesesMembresia(): Promise<MesMembresia[]>;
  sesionesKids(): Promise<Sesion[]>;
  /** Pinta tu pieza: horarios abiertos, con cupo. */
  sesionesPinta(): Promise<Sesion[]>;
  /** Pinta tu pieza: piezas para elegir, con precio y existencias vigentes. */
  piezasPinta(): Promise<PiezaPinta[]>;
  productos(): Promise<Producto[]>;
  producto(slug: string): Promise<Producto | null>;

  // --- Reservas ------------------------------------------------------------
  /** Cupo actual de unas sesiones: se vuelve a preguntar justo antes de pagar. */
  disponibilidad(sesionIds: string[]): Promise<Sesion[]>;
  /** Valida cupo y aparta los lugares mientras se paga. Requiere sesión. */
  apartar(solicitud: SolicitudReserva): Promise<Reserva>;
  /**
   * Cobra un apartado: el total o, en Pinta tu pieza, solo el anticipo
   * (ver montoEnLinea). Con Supabase devuelve la redirección a Stripe Checkout.
   * En la demo no hay cobro: `simulacion` decide si el pago se aprueba o se
   * rechaza (un rechazo lanza PAGO_RECHAZADO y el lugar sigue apartado).
   */
  pagar(reservaId: string, opciones?: { simulacion?: 'aprobado' | 'rechazado' }): Promise<ResultadoPago>;
  /** Libera un apartado que no se va a pagar. */
  liberar(reservaId: string): Promise<void>;
  misReservas(): Promise<Reserva[]>;

  // --- Cuenta --------------------------------------------------------------
  usuarioActual(): Promise<Usuario | null>;
  registrar(datos: Registro): Promise<Usuario>;
  entrar(email: string, password: string): Promise<Usuario>;
  salir(): Promise<void>;
  recuperarPassword(email: string): Promise<void>;
  /** Nueva contraseña de la cuenta con sesión (tras abrir el enlace de recuperación). */
  cambiarPassword(password: string): Promise<void>;
  actualizarPerfil(cambios: Pick<Usuario, 'nombre' | 'telefono'>): Promise<Usuario>;

  // --- Novedades (independiente de la cuenta) ------------------------------
  suscribirNovedades(email: string): Promise<void>;
}

// ===========================================================================
// Panel de Casa Numa
// ---------------------------------------------------------------------------
// Separado del contrato público: cada método exige una sesión con rol
// 'admin' y puede ver datos de todas las clientas. En Supabase se cumple con
// RLS (es_admin()) y Edge Functions con verificación de rol en el servidor.
// ===========================================================================

export interface CambiosReserva {
  estado?: EstadoReserva;
  pago?: EstadoPago;
  notasInternas?: string;
}

/** Lo que el equipo ajusta de una pieza de Pinta tu pieza. */
export interface CambiosPieza {
  /** null = precio pendiente (no se puede pagar). */
  precio?: number | null;
  /** null = sin conteo de existencias. */
  stock?: number | null;
  activa?: boolean;
}

export interface RepositorioAdmin {
  adminActual(): Promise<Usuario | null>;
  entrarAdmin(email: string, password: string): Promise<Usuario>;
  salirAdmin(): Promise<void>;

  resumen(): Promise<ResumenAdmin>;
  reservas(): Promise<Reserva[]>;
  reserva(id: string): Promise<Reserva | null>;
  actualizarReserva(id: string, cambios: CambiosReserva): Promise<Reserva>;
  crearReservaManual(solicitud: SolicitudManual): Promise<Reserva>;

  /**
   * Pinta tu pieza: cobra en el estudio lo que falta (anticipo_pagado →
   * pagado). Conserva el anticipo y registra el pago final aparte.
   */
  liquidarSaldo(id: string, metodo: MetodoPago): Promise<Reserva>;
  /**
   * Pinta tu pieza: cambio de pieza en el estudio. El saldo se recalcula como
   * precio final − total ya pagado; si queda negativo, pide revisión manual
   * (no hay reembolsos automáticos).
   */
  cambiarPieza(id: string, piezaId: string): Promise<Reserva>;
  /** Inventario de Pinta tu pieza (activas e inactivas, sin precios de ejemplo). */
  piezas(): Promise<PiezaPinta[]>;
  editarPieza(id: string, cambios: CambiosPieza): Promise<PiezaPinta>;

  /** Sesiones del mes con sus asistentes (talleres, NUMA Kids y membresía). */
  agenda(mes: string): Promise<SesionAdmin[]>;
  /** Talleres de la agenda y sesiones próximas de NUMA Kids y membresía, con ocupación y cupo. */
  talleres(): Promise<SesionAdmin[]>;
  /** Cupo de una sesión; null = sin confirmar. */
  ajustarCupo(sesionId: string, cupo: number | null): Promise<void>;

  /** Catálogo de talleres (activos e inactivos) para administrarlo. */
  catalogo(): Promise<TallerCatalogo[]>;
  crearTaller(nuevo: TallerNuevo): Promise<TallerCatalogo>;
  editarTaller(id: string, cambios: CambiosTaller): Promise<TallerCatalogo>;
  /** Inactivo = deja de verse en el sitio; las reservas hechas siguen vigentes. */
  activarTaller(id: string, activo: boolean): Promise<void>;
  membresias(): Promise<MembresiaAdmin[]>;
  clientes(): Promise<ClienteAdmin[]>;
  pagos(): Promise<Pago[]>;
  avisos(reservaId?: string): Promise<Aviso[]>;
  /** Correo, WhatsApp y Google Calendar: si ya funcionan o qué les falta. */
  integraciones(): Promise<Integraciones>;
}

export type CodigoError =
  | 'SIN_CUPO'
  | 'SIN_RESERVA_EN_LINEA'
  | 'SESION_INVALIDA'
  | 'LIMITE_SESIONES'
  | 'EDAD_MINIMA'
  | 'DATOS_INVALIDOS'
  | 'SIN_SESION'
  | 'CREDENCIALES'
  | 'CORREO_REGISTRADO'
  /** La cuenta existe pero falta abrir el enlace del correo de confirmación. */
  | 'CONFIRMAR_CORREO'
  | 'APARTADO_VENCIDO'
  /** Demo: el pago simulado se rechazó; la reserva sigue sin confirmar. */
  | 'PAGO_RECHAZADO'
  | 'NO_ENCONTRADO'
  | 'NO_CONECTADO'
  | 'SIN_ACCESO'
  /** Pinta tu pieza: sin pieza, agotada, inactiva o sin precio publicado. */
  | 'SIN_PIEZA';

/** Error con mensaje ya escrito para la persona: se puede mostrar tal cual. */
export class ErrorDatos extends Error {
  constructor(
    public codigo: CodigoError,
    mensaje: string,
    /** Sesiones que provocaron el error (p. ej. las que se llenaron). */
    public sesiones?: string[],
  ) {
    super(mensaje);
    this.name = 'ErrorDatos';
  }
}
