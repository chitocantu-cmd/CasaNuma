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
  fin: string;
  cupo: number;
  /** Ya descuenta reservas confirmadas y apartados vigentes. */
  disponibles: number;
}

export interface Taller {
  id: string;
  slug: string;
  titulo: string;
  resumen: string;
  descripcion: string[];
  foto: IdFoto;
  /** Precio por persona, MXN. Cada taller tiene el suyo: no hay precio global. */
  precio: number;
  duracionMin: number;
  incluye: string[];
  sesiones: Sesion[];
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

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  creadoEn: string;
}

export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'cancelada' | 'expirada';
export type EstadoPago = 'pendiente' | 'pagado' | 'reembolsado';

export interface Nino {
  nombre: string;
  edad: number;
}

export interface SesionReservada {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
}

export interface Reserva {
  id: string;
  codigo: string;
  tipo: TipoExperiencia;
  titulo: string;
  /** slug del taller o clave del mes de membresía. */
  referencia: string;
  sesiones: SesionReservada[];
  participantes: number;
  ninos?: Nino[];
  precioUnitario: number;
  total: number;
  estado: EstadoReserva;
  pago: EstadoPago;
  /** Vencimiento del apartado mientras se paga. */
  expiraEn: string | null;
  creadaEn: string;
  usuarioId: string;
  contacto: Contacto;
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
