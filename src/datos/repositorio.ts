import type {
  Aviso, ClienteAdmin, EstadoPago, EstadoReserva, MembresiaAdmin, MesMembresia, Pago, Producto,
  Registro, Reserva, ResultadoPago, ResumenAdmin, Sesion, SesionAdmin, SolicitudManual,
  SolicitudReserva, Taller, Usuario,
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
  productos(): Promise<Producto[]>;
  producto(slug: string): Promise<Producto | null>;

  // --- Reservas ------------------------------------------------------------
  /** Cupo actual de unas sesiones: se vuelve a preguntar justo antes de pagar. */
  disponibilidad(sesionIds: string[]): Promise<Sesion[]>;
  /** Valida cupo y aparta los lugares mientras se paga. Requiere sesión. */
  apartar(solicitud: SolicitudReserva): Promise<Reserva>;
  /** Cobra un apartado. En producción puede devolver una redirección a Stripe. */
  pagar(reservaId: string): Promise<ResultadoPago>;
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

export interface RepositorioAdmin {
  adminActual(): Promise<Usuario | null>;
  entrarAdmin(email: string, password: string): Promise<Usuario>;
  salirAdmin(): Promise<void>;

  resumen(): Promise<ResumenAdmin>;
  reservas(): Promise<Reserva[]>;
  reserva(id: string): Promise<Reserva | null>;
  actualizarReserva(id: string, cambios: CambiosReserva): Promise<Reserva>;
  crearReservaManual(solicitud: SolicitudManual): Promise<Reserva>;

  /** Sesiones del mes con sus asistentes (talleres, NUMA Kids y membresía). */
  agenda(mes: string): Promise<SesionAdmin[]>;
  /** Talleres de la agenda y sesiones próximas de NUMA Kids y membresía, con ocupación y cupo. */
  talleres(): Promise<SesionAdmin[]>;
  /** Cupo de una sesión; null = sin confirmar. */
  ajustarCupo(sesionId: string, cupo: number | null): Promise<void>;
  membresias(): Promise<MembresiaAdmin[]>;
  clientes(): Promise<ClienteAdmin[]>;
  pagos(): Promise<Pago[]>;
  avisos(reservaId?: string): Promise<Aviso[]>;
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
  | 'NO_ENCONTRADO'
  | 'NO_CONECTADO'
  | 'SIN_ACCESO';

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
