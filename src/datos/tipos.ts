import type { EntradaFoto, IdFoto } from '../contenido/fotos';

// ===========================================================================
// Dominio del sitio público
// ---------------------------------------------------------------------------
// Tres experiencias se reservan y pagan en línea: talleres de fin de semana,
// membresía y NUMA Kids. Eventos y NUMA Store se atienden por WhatsApp y por
// eso no tienen reserva aquí.
// ===========================================================================

export type TipoExperiencia = 'taller' | 'membresia' | 'kids';

/** Un horario concreto con cupo. Fechas 'YYYY-MM-DD', horas 'HH:MM' (Monterrey). */
export interface Sesion {
  id: string;
  fecha: string;
  inicio: string;
  /** null = Casa Numa no ha dado la hora de término. */
  fin: string | null;
  /** null = cupo sin confirmar: se muestra "Cupo limitado" y no se cuenta. */
  cupo: number | null;
  /** Ya descuenta reservas confirmadas y apartados vigentes. null si no hay cupo. */
  disponibles: number | null;
  /** Cerrada a mano aunque no haya número de cupo. */
  agotada: boolean;
}

export type CategoriaTaller = 'adultos' | 'ninos' | 'temporada';

export interface Taller {
  id: string;
  slug: string;
  titulo: string;
  resumen: string;
  descripcion: string[];
  foto: IdFoto;
  /** Todas las fotos del taller, incluida `foto`. */
  galeria: IdFoto[];
  /** Filtros de la agenda. */
  categoria: CategoriaTaller;
  /** Texto corto de público o tipo: "Niños", "Adultos", "Clases", "Temporada". */
  etiqueta: string;
  edad: { min: number; max: number } | null;
  /** Precio por persona, MXN. null = sin precio publicado (se pide por mensaje). */
  precio: number | null;
  /** Lo que se muestra cuando no hay precio, tal como lo publica Casa Numa. */
  etiquetaPrecio: string | null;
  /** false = no se cobra en línea: el botón pide información. */
  reservaEnLinea: boolean;
  /**
   * Por dónde se aparta: 'taller' (checkout del taller), 'kids' (NUMA Kids,
   * con nombre y edad de cada niño) o 'membresia' (es una clase de la
   * membresía y se elige al contratarla).
   */
  flujo: 'taller' | 'kids' | 'membresia';
  duracionMin: number | null;
  incluye: string[];
  sesiones: Sesion[];
  destacado: boolean;
  /** true = dato de demostración, no confirmado por Casa Numa. */
  demo: boolean;
}

export interface MesMembresia {
  /** 'YYYY-MM' */
  clave: string;
  /** "octubre 2026" */
  etiqueta: string;
  sesiones: Sesion[];
  demo: boolean;
}

export type Modalidad = 'disponible' | 'encargo';
export type Disponibilidad = 'disponible' | 'agotado' | 'bajo-pedido';

export interface Producto {
  id: string;
  slug: string;
  nombre: string;
  categoria: 'Tazas' | 'Vajillas' | 'Objetos decorativos' | 'Creaciones especiales';
  modalidad: Modalidad;
  descripcion: string;
  dimensiones?: string;
  acabados?: string;
  /** null = se cotiza. */
  precio: number | null;
  disponibilidad: Disponibilidad;
  fotos: EntradaFoto[];
  demo: boolean;
}

/** customer = clienta con cuenta · admin = equipo de Casa Numa (panel). */
export type Rol = 'customer' | 'admin';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  creadoEn: string;
  rol: Rol;
}

/**
 * pendiente_pago: lugares apartados, el cobro no se ha confirmado.
 * confirmada: el proveedor de pagos (o el equipo, si pagó en el estudio) confirmó el cobro.
 * completada: la experiencia ya ocurrió.
 * no_asistio: tenía lugar pagado y no llegó (lo marca el equipo).
 * Una reserva reembolsada queda cancelada con el pago 'reembolsado'.
 */
export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'cancelada' | 'completada' | 'no_asistio' | 'expirada';
export type EstadoPago = 'pendiente' | 'pagado' | 'reembolsado' | 'fallido';
export type MetodoPago = 'tarjeta' | 'transferencia' | 'efectivo' | 'otro';

export interface Nino {
  nombre: string;
  edad: number;
}

export interface SesionReservada {
  id: string;
  fecha: string;
  inicio: string;
  fin: string | null;
}

export interface Reserva {
  id: string;
  /** NUMA-00001… Lo asigna el backend cuando el pago se confirma. */
  folio: string | null;
  tipo: TipoExperiencia;
  titulo: string;
  /** slug del taller o clave del mes de membresía. */
  referencia: string;
  sesiones: SesionReservada[];
  participantes: number;
  /** NUMA Kids: solo nombre y edad, nada más del menor. */
  ninos?: Nino[];
  precioUnitario: number;
  subtotal: number;
  total: number;
  estado: EstadoReserva;
  pago: EstadoPago;
  metodoPago: MetodoPago | null;
  /** Id del cobro en el proveedor (Stripe) o referencia de la transferencia. */
  referenciaPago: string | null;
  pagadaEn: string | null;
  /** Vencimiento del apartado mientras se paga (null en reservas del panel). */
  expiraEn: string | null;
  creadaEn: string;
  actualizadaEn: string;
  /** null si el equipo la registró sin cuenta de la clienta. */
  usuarioId: string | null;
  contacto: Contacto;
  /** Solo las ve el equipo. */
  notasInternas: string;
  origen: 'web' | 'panel';
  demo: boolean;
}

export interface Contacto {
  nombre: string;
  email: string;
  telefono: string;
}

/**
 * Lo que manda el navegador para reservar. Fíjate en lo que NO lleva: ningún
 * precio. El total lo calcula quien guarda la reserva, a partir del catálogo.
 */
export interface SolicitudReserva {
  tipo: TipoExperiencia;
  referencia: string;
  sesionIds: string[];
  participantes: number;
  ninos?: Nino[];
  contacto: Contacto;
  notas?: string;
}

export type ResultadoPago =
  | { tipo: 'confirmado'; reserva: Reserva }
  | { tipo: 'redireccion'; url: string };

export interface Registro {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  /** Consentimiento separado y opcional para recibir novedades. */
  novedades: boolean;
}

// ===========================================================================
// Panel administrativo
// ===========================================================================

export interface Pago {
  id: string;
  reservaId: string;
  folio: string | null;
  cliente: string;
  proveedor: 'demo' | 'stripe' | 'manual';
  referencia: string | null;
  metodo: MetodoPago | null;
  monto: number;
  estado: EstadoPago;
  creadoEn: string;
  demo: boolean;
}

/** Aviso que salió (o saldría) por correo o WhatsApp. */
export interface Aviso {
  id: string;
  canal: 'email' | 'whatsapp';
  destinatario: 'equipo' | 'cliente';
  /** null = falta configurar a quién (ADMIN_NOTIFICATION_EMAIL, API de WhatsApp). */
  para: string | null;
  asunto: string;
  lineas: string[];
  enlace: { texto: string; ruta: string } | null;
  reservaId: string;
  /**
   * en_cola y fallido solo existen con el backend real: el aviso espera al
   * worker o se agotaron sus reintentos (el motivo va en `error`).
   */
  estado: 'enviado' | 'sin_destinatario' | 'pendiente_integracion' | 'en_cola' | 'fallido';
  error?: string;
  creadoEn: string;
}

export interface Asistente {
  reservaId: string;
  folio: string | null;
  nombre: string;
  telefono: string;
  personas: number;
  estado: EstadoReserva;
  pago: EstadoPago;
  ninos?: Nino[];
}

/** Una sesión con quién va: la vista del calendario del equipo. */
export interface SesionAdmin {
  sesion: Sesion;
  tipo: TipoExperiencia;
  titulo: string;
  slug: string | null;
  /** Por persona; null = sin precio publicado ("Info DM"). */
  precio: number | null;
  etiquetaPrecio: string | null;
  reservaEnLinea: boolean;
  /** Lugares ocupados por reservas confirmadas y apartados vigentes. */
  ocupados: number;
  asistentes: Asistente[];
}

export interface ClaseMembresia {
  numero: number;
  sesion: SesionReservada | null;
  estado: 'utilizada' | 'reservada' | 'disponible';
}

export interface MembresiaAdmin {
  reserva: Reserva;
  mes: string;
  clases: ClaseMembresia[];
  utilizadas: number;
  reservadas: number;
  restantes: number;
}

export interface ClienteAdmin {
  email: string;
  nombre: string;
  telefono: string;
  tieneCuenta: boolean;
  reservas: number;
  pagado: number;
  ultima: string | null;
  demo: boolean;
}

export interface ResumenAdmin {
  reservasHoy: number;
  personasHoy: number;
  proximos7: number;
  ingresosConfirmados: number;
  pagosPendientes: number;
  cupoBajo: number;
  ultimas: Reserva[];
  hoy: SesionAdmin[];
}

/** Reserva registrada por el equipo (p. ej. un taller "Info DM" apartado por mensaje). */
export interface SolicitudManual {
  sesionId: string;
  participantes: number;
  contacto: Contacto;
  /** El equipo captura el importe: los talleres "Info DM" no tienen precio publicado. */
  total: number;
  metodoPago: MetodoPago;
  pagado: boolean;
  referenciaPago: string;
  notasInternas: string;
  ninos?: Nino[];
  avisarCliente: boolean;
}
