import type {
  MesMembresia, Producto, Registro, Reserva, ResultadoPago, Sesion,
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
  actualizarPerfil(cambios: Pick<Usuario, 'nombre' | 'telefono'>): Promise<Usuario>;

  // --- Novedades (independiente de la cuenta) ------------------------------
  suscribirNovedades(email: string): Promise<void>;
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
  | 'APARTADO_VENCIDO'
  | 'NO_ENCONTRADO'
  | 'NO_CONECTADO';

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
