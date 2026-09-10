import { supabase } from '../lib/supabase/client';
import { llamar } from './api';
import type {
  DatosCliente, ReservaCreada, SesionPago, EstadoReserva,
  Reservation, Payment, Customer, Workshop,
} from '../tipos';

/**
 * Crea la reserva temporal (hold).
 *
 * Fíjate en lo que NO se manda: ningún precio. El monto lo calcula la base de
 * datos leyendo el taller, dentro de la misma transacción que valida el cupo.
 * Aunque alguien manipule DevTools, no hay campo por donde meter un precio.
 */
export function crearReserva(
  slug: string,
  quantity: number,
  cliente: DatosCliente,
): Promise<ReservaCreada> {
  return llamar<ReservaCreada>('create-reservation', {
    slug,
    quantity,
    full_name: cliente.full_name,
    email: cliente.email,
    phone: cliente.phone,
    companions: cliente.companions,
    notes: cliente.notes,
  });
}

/** Crea la sesión de Stripe. Solo recibe el id: el precio sale de la base. */
export function crearSesionPago(reservationId: string): Promise<SesionPago> {
  return llamar<SesionPago>('create-checkout-session', {
    reservation_id: reservationId,
  });
}

/** Consulta el estado real. Requiere código + correo. */
export function consultarReserva(
  reservationCode: string,
  email: string,
): Promise<EstadoReserva> {
  return llamar<EstadoReserva>('reservation-status', {
    reservation_code: reservationCode,
    email,
  });
}

// --- Panel de administración ------------------------------------------------

export interface ReservaAdmin extends Reservation {
  customers: Pick<Customer, 'full_name' | 'email' | 'phone'> | null;
  workshops: Pick<Workshop, 'title' | 'date' | 'start_time' | 'slug'> | null;
  payments: Pick<Payment, 'status' | 'stripe_payment_intent_id' | 'needs_review'>[];
}

export async function listarReservas(estado?: string): Promise<ReservaAdmin[]> {
  let q = supabase
    .from('reservations')
    .select(`
      *,
      customers ( full_name, email, phone ),
      workshops ( title, date, start_time, slug ),
      payments ( status, stripe_payment_intent_id, needs_review )
    `)
    .order('created_at', { ascending: false })
    .limit(300);

  if (estado) q = q.eq('status', estado);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReservaAdmin[];
}

export interface PagoAdmin extends Payment {
  reservations: {
    reservation_code: string;
    customers: Pick<Customer, 'full_name' | 'email'> | null;
    workshops: Pick<Workshop, 'title'> | null;
  } | null;
}

export async function listarPagos(estado?: string): Promise<PagoAdmin[]> {
  let q = supabase
    .from('payments')
    .select(`
      *,
      reservations (
        reservation_code,
        customers ( full_name, email ),
        workshops ( title )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(300);

  if (estado) q = q.eq('status', estado);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PagoAdmin[];
}

export function cancelarReserva(reservationId: string, reason: string) {
  return llamar<{ ok: true; result: string }>(
    'admin-actions',
    { action: 'cancel_reservation', reservation_id: reservationId, reason },
    { conSesion: true },
  );
}

export function sincronizarCalendario(workshopId: string) {
  return llamar<{ ok: true }>(
    'admin-actions',
    { action: 'sync_calendar', workshop_id: workshopId },
    { conSesion: true },
  );
}

export function reintentarJob(jobId: string) {
  return llamar<{ ok: true }>(
    'admin-actions',
    { action: 'retry_job', job_id: jobId },
    { conSesion: true },
  );
}
