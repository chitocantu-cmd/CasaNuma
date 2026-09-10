// ---------------------------------------------------------------------------
// Cliente de las Edge Functions
// ---------------------------------------------------------------------------
// Toda escritura del sistema pasa por aquí. El navegador nunca hace INSERT ni
// UPDATE directo sobre reservations, customers ni payments.
// ---------------------------------------------------------------------------

import { supabase, FUNCIONES, ANON_KEY } from '../lib/supabase/client';

/** Error con la forma que devuelven nuestras funciones. */
export class ErrorApi extends Error {
  constructor(
    public codigo: string,
    mensaje: string,
    /** Presente en INSUFFICIENT_CAPACITY: cuántos lugares quedan. */
    public available?: number,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

// Mensajes en español, orientados a la persona. Nunca se muestra SQL, ni
// stack traces, ni errores crudos de Stripe.
const MENSAJES: Record<string, string> = {
  INSUFFICIENT_CAPACITY: 'Este taller acaba de llenarse.',
  WORKSHOP_NOT_AVAILABLE: 'Este taller ya no está disponible.',
  WORKSHOP_REQUIRES_QUOTE: 'Este taller se cotiza a la medida. Escríbenos y lo vemos contigo.',
  WORKSHOP_IN_PAST: 'Este taller ya ocurrió.',
  INVALID_INPUT: 'Revisa tus datos, hay algo que no cuadra.',
  RESERVATION_NOT_FOUND: 'No encontramos esa reservación.',
  RESERVATION_EXPIRED: 'Tu reserva expiró.',
  PAYMENT_UNAVAILABLE: 'No pudimos crear tu pago. Intenta de nuevo en un momento.',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Espera unos minutos.',
  FORBIDDEN: 'No tienes permiso para esta acción.',
  SIN_CONEXION: 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.',
};

interface Opciones {
  /** Manda el JWT de la sesión de admin en vez de la anon key. */
  conSesion?: boolean;
}

export async function llamar<T>(
  funcion: string,
  cuerpo: unknown,
  opciones: Opciones = {},
): Promise<T> {
  let authorization = `Bearer ${ANON_KEY}`;

  if (opciones.conSesion) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new ErrorApi('FORBIDDEN', MENSAJES.FORBIDDEN);
    authorization = `Bearer ${data.session.access_token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCIONES}/${funcion}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: authorization,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('SIN_CONEXION', MENSAJES.SIN_CONEXION);
  }

  const datos = await res.json().catch(() => ({}));

  if (!res.ok) {
    const codigo = String(datos.error ?? 'ERROR');
    throw new ErrorApi(
      codigo,
      MENSAJES[codigo] ?? datos.message ?? 'Algo salió mal. Intenta de nuevo.',
      typeof datos.available === 'number' ? datos.available : undefined,
    );
  }

  return datos as T;
}
