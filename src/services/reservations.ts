import { llamar } from './api';
import type { SesionPago, EstadoReserva } from '../tipos';

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
