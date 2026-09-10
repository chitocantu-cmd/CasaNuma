// ---------------------------------------------------------------------------
// Tipos del dominio. Reflejan el esquema de supabase/migrations.
// Sin `any` en ningún lado.
// ---------------------------------------------------------------------------

export type Categoria = 'ceramica' | 'pintura' | 'libre' | 'especiales';

export type WorkshopStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type ReservationStatus =
  | 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';

export type PaymentStatus =
  | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'discarded';

export type BookingMode = 'paid' | 'quote';

export interface Faq {
  q: string;
  a: string;
}

/** Lo que devuelve la vista pública `public_workshops`. */
export interface Workshop {
  id: string;
  slug: string;
  title: string;
  category: Categoria;
  short_description: string | null;
  description: string[];
  date: string;        // 'YYYY-MM-DD'
  start_time: string;  // 'HH:MM:SS'
  end_time: string;
  timezone: string;
  /** numeric(10,2) — llega como número desde PostgREST. */
  price: number;
  currency: string;
  capacity: number;
  location: string | null;
  instructor: string | null;
  level: string | null;
  image_url: string | null;
  gallery: string[];
  includes: string[];
  crearas: string[];
  faqs: Faq[];
  tono: string | null;
  booking_mode: BookingMode;
  /** Ya viene con los holds activos descontados por la base de datos. */
  seats_available: number;
}

/** Taller completo, como lo ve el panel (incluye campos internos). */
export interface WorkshopAdmin extends Omit<Workshop, 'seats_available'> {
  status: WorkshopStatus;
  cloudinary_public_id: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Desglose de cupo: tres números distintos, no uno. */
export interface WorkshopAvailability {
  capacity: number;
  confirmed: number;
  holds: number;
  available: number;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  reservation_code: string;
  workshop_id: string;
  customer_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: ReservationStatus;
  expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  companions: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  reservation_id: string;
  provider: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider_status: string | null;
  needs_review: boolean;
  review_reason: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface AdminProfile {
  user_id: string;
  name: string | null;
  role: 'admin';
  created_at: string;
}

export interface MembershipLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  interests: string[];
  status: LeadStatus;
  admin_notes: string | null;
  created_at: string;
}

export interface ContactLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: LeadStatus;
  admin_notes: string | null;
  created_at: string;
}

export interface IntegrationJob {
  id: string;
  type: 'calendar_sync' | 'email_send';
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Formas de entrada/salida de las Edge Functions
// ---------------------------------------------------------------------------

export interface DatosCliente {
  full_name: string;
  email: string;
  phone: string;
  companions?: string;
  notes?: string;
}

/** Respuesta de `create-reservation`. */
export interface ReservaCreada {
  reservation_id: string;
  reservation_code: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  expires_at: string;
  customer_id: string;
  workshop: {
    id: string; slug: string; title: string; date: string;
    start_time: string; end_time: string; timezone: string;
    location: string | null; price: number;
  };
}

/** Respuesta de `create-checkout-session`. */
export interface SesionPago {
  checkout_url: string;
  session_id: string;
  reservation_code: string;
  total_amount: number;
  currency: string;
  expires_at: string;
}

/** Respuesta de `reservation-status`. */
export interface EstadoReserva {
  reservation_code: string;
  status: ReservationStatus;
  quantity: number;
  total_amount: number;
  currency: string;
  expires_at: string | null;
  payment_status: PaymentStatus | null;
  workshop: {
    slug: string; title: string; date: string;
    start_time: string; end_time: string;
    timezone: string; location: string | null;
  };
}

export const ETIQUETAS_CATEGORIA: Record<Categoria, string> = {
  ceramica: 'Cerámica',
  pintura: 'Pintura',
  libre: 'Taller libre',
  especiales: 'Especiales',
};

export const ETIQUETAS_RESERVA: Record<ReservationStatus, string> = {
  pending_payment: 'Pendiente de pago',
  confirmed: 'Confirmada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  refunded: 'Reembolsada',
};

export const ETIQUETAS_PAGO: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};
