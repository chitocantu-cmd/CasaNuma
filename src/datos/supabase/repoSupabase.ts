// ===========================================================================
// Backend real: Supabase + Edge Functions + Stripe
// ---------------------------------------------------------------------------
// Cumple el mismo contrato que la demo (../repositorio.ts) con las mismas
// reglas, pero ahora las hace valer el servidor:
//   · el catálogo y el cupo se leen de public_sessions (lugares calculados en
//     la base, nunca en el navegador);
//   · apartar, pagar y todo lo del panel pasa por Edge Functions
//     (create-reservation, create-checkout-session, admin-actions), que
//     llaman a funciones con bloqueo de filas; el navegador nunca escribe
//     directo en reservations, customers ni payments;
//   · Mi cuenta lee con mis_reservas() (sin notas internas);
//   · el panel lee con la sesión del equipo y el RLS (es_admin) decide.
//
// La reserva se confirma cuando Stripe avisa al webhook: aquí `pagar`
// devuelve la URL de Stripe Checkout, nunca una reserva confirmada.
// ===========================================================================

import type { PostgrestError } from '@supabase/supabase-js';
import { FOTOS, type IdFoto } from '../../contenido/fotos';
import { MEMBRESIA } from '../../contenido/oferta';
import { siteConfig } from '../../config/site';
import { ANON_KEY, FUNCIONES, supabase } from '../../lib/supabase/client';
import { claveMes, etiquetaMes, hoy, minutosEntre, sumarDias, yaPaso } from '../../lib/calendario';
import { correoValido, soloDigitos } from '../../lib/formato';
import { montoPagado, saldoDe } from '../../lib/anticipo';
import { avisosReservaConfirmada } from '../avisos';
import { PRODUCTOS_SEMILLA } from '../demo/semilla';
import { ErrorDatos, type CambiosReserva, type CodigoError, type Repositorio, type RepositorioAdmin } from '../repositorio';
import { CATEGORIA_DB, slugTaller, validarCambiosTaller, validarTallerNuevo } from '../catalogo';
import type {
  Asistente, Aviso, CambiosTaller, ClaseMembresia, ClienteAdmin, CobroAnticipo, Contacto, EstadoPago, EstadoReserva, MembresiaAdmin,
  MesMembresia, MetodoPago, Nino, Pago, Reserva, ResumenAdmin, Sesion, SesionAdmin, SolicitudManual,
  Taller, TallerCatalogo, TallerNuevo, TipoExperiencia, Usuario,
} from '../tipos';

// --- Filas de la base ---------------------------------------------------------

interface FilaTaller {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string[] | null;
  label: string | null;
  price: number | null;
  price_label: string | null;
  age_min: number | null;
  age_max: number | null;
  image_key: string | null;
  gallery: string[] | null;
  includes: string[] | null;
  is_featured: boolean;
  booking_type: 'online' | 'membership' | 'inquiry';
  booking_mode: 'paid' | 'quote';
  origen?: 'agenda' | 'panel';
}

interface FilaSesion {
  id: string;
  experience_type: TipoExperiencia;
  workshop_id: string | null;
  date: string;
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  price: number | null;
  /** public_sessions: lugares libres. sesiones_ocupacion trae `occupied`. */
  seats_available?: number | null;
  occupied?: number;
  status?: string;
}

interface FilaPago {
  id?: string;
  provider?: string;
  status: string;
  method: string | null;
  reference?: string | null;
  stripe_payment_intent_id?: string | null;
  amount?: number;
  paid_at: string | null;
  created_at?: string;
}

/** La forma de mis_reservas(); las del panel se normalizan a esta. */
interface FilaReserva {
  id: string;
  reservation_code: string;
  folio: string | null;
  experience_type: TipoExperiencia;
  status: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  /** Anticipo del 50 % (reservas en línea); null = se paga completa (panel). */
  deposit_percentage?: number | null;
  deposit_amount?: number | null;
  amount_paid?: number | null;
  final_payment_amount?: number | null;
  remaining_balance?: number | null;
  payment_status?: 'pending' | 'deposit_paid' | 'paid_in_full' | 'refunded' | null;
  expires_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  origin: 'web' | 'panel';
  workshop: { slug: string; title: string } | null;
  month: string | null;
  customer: { full_name: string; email: string; phone: string | null } | null;
  payment: FilaPago | null;
  sessions: { id: string; date: string; start_time: string; end_time: string | null }[];
  children: { name: string; age: number }[];
  internal_notes?: string | null;
}

// --- Utilidades -----------------------------------------------------------------

const hhmm = (t: string) => t.slice(0, 5);
const hhmmONulo = (t: string | null) => (t ? hhmm(t) : null);
const num = (v: unknown) => Number(v ?? 0);
const esUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const esFoto = (k: unknown): k is IdFoto => typeof k === 'string' && k in FOTOS;

/** Lo que dice la base en un error, ya en palabras de la persona. */
function errorBase(e: PostgrestError | null, respaldo = 'No pudimos completar la acción. Intenta de nuevo.'): ErrorDatos {
  const detalle = e?.details || undefined;
  switch (e?.code) {
    case 'CN001': return sinCupo(Number(e.details ?? 0));
    case 'CN002': return new ErrorDatos('SESION_INVALIDA', detalle ?? 'Ese horario ya no está disponible.');
    case 'CN003': return new ErrorDatos('SIN_RESERVA_EN_LINEA', 'Este taller se aparta por mensaje. Escríbenos para pedir información.');
    case 'CN004': return new ErrorDatos('DATOS_INVALIDOS', detalle ?? 'Revisa tus datos, hay algo que no cuadra.');
    case 'CN005': return new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');
    case 'CN006': return new ErrorDatos('SESION_INVALIDA', 'Ese horario ya pasó. Elige otro.');
    case 'CN007': return new ErrorDatos('APARTADO_VENCIDO', 'Tu apartado venció antes de completar el pago. Vuelve a elegir tus fechas.');
    case 'CN008': return new ErrorDatos('DATOS_INVALIDOS', detalle ?? 'Espera unos minutos antes de volver a intentar.');
    default: return new ErrorDatos('NO_CONECTADO', respaldo);
  }
}

function sinCupo(disponibles: number, sesiones?: string[]): ErrorDatos {
  if (!disponibles) return new ErrorDatos('SIN_CUPO', 'Este horario ya está agotado. Elige otro.', sesiones);
  return new ErrorDatos(
    'SIN_CUPO',
    `Solo ${disponibles === 1 ? 'queda 1 lugar disponible' : `quedan ${disponibles} lugares disponibles`}.`,
    sesiones,
  );
}

/** Los códigos que devuelven las Edge Functions (supabase/functions/_shared/clients.ts). */
const CODIGOS_FUNCION: Record<string, CodigoError> = {
  INSUFFICIENT_CAPACITY: 'SIN_CUPO',
  WORKSHOP_NOT_AVAILABLE: 'SESION_INVALIDA',
  WORKSHOP_REQUIRES_QUOTE: 'SIN_RESERVA_EN_LINEA',
  WORKSHOP_IN_PAST: 'SESION_INVALIDA',
  INVALID_INPUT: 'DATOS_INVALIDOS',
  RESERVATION_NOT_FOUND: 'NO_ENCONTRADO',
  RESERVATION_EXPIRED: 'APARTADO_VENCIDO',
  FORBIDDEN: 'SIN_ACCESO',
};

const MENSAJES_FUNCION: Partial<Record<string, string>> = {
  WORKSHOP_NOT_AVAILABLE: 'Ese horario ya no está disponible. Elige otro.',
  WORKSHOP_REQUIRES_QUOTE: 'Este taller se aparta por mensaje. Escríbenos para pedir información.',
  WORKSHOP_IN_PAST: 'Ese horario ya pasó. Elige otro.',
  RESERVATION_NOT_FOUND: 'No encontramos esa reserva.',
  RESERVATION_EXPIRED: 'Tu apartado venció antes de completar el pago. Vuelve a elegir tus fechas.',
  PAYMENT_UNAVAILABLE: 'No pudimos abrir el pago. Intenta de nuevo en un momento.',
  TOO_MANY_REQUESTS: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
  FORBIDDEN: 'Inicia sesión con una cuenta del equipo.',
};

/** Llama una Edge Function con la sesión (si hay) y traduce sus errores. */
async function funcion<T>(nombre: string, cuerpo: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${FUNCIONES}/${nombre}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${data.session?.access_token ?? ANON_KEY}`,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDatos('NO_CONECTADO', 'No pudimos conectar. Revisa tu conexión e intenta de nuevo.');
  }
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return j as T;

  const codigo = String(j.error ?? '');
  if (codigo === 'INSUFFICIENT_CAPACITY') {
    const sesiones = Array.isArray(j.sessions) ? (j.sessions as { session_id: string }[]).map((s) => s.session_id) : undefined;
    throw sinCupo(Number(j.available ?? 0), sesiones);
  }
  // `detail` viene de la base y ya está escrito para la persona.
  const mensaje = (typeof j.detail === 'string' && j.detail) || MENSAJES_FUNCION[codigo] || 'Algo salió mal. Intenta de nuevo.';
  throw new ErrorDatos(CODIGOS_FUNCION[codigo] ?? 'NO_CONECTADO', mensaje);
}

// --- Catálogo ---------------------------------------------------------------------

const COLUMNAS_TALLER =
  'id, slug, title, category, description, label, price, price_label, age_min, age_max, image_key, gallery, includes, is_featured, booking_type, booking_mode, origen';
const COLUMNAS_SESION = 'id, experience_type, workshop_id, date, start_time, end_time, capacity, price, seats_available';

function aSesion(s: FilaSesion): Sesion {
  const inicio = hhmm(s.start_time);
  const cupo = s.capacity;
  const libres = s.seats_available ?? (cupo === null ? null : Math.max(0, cupo - (s.occupied ?? 0)));
  return {
    id: s.id,
    fecha: s.date,
    inicio,
    fin: hhmmONulo(s.end_time),
    cupo,
    disponibles: cupo === null ? null : yaPaso(s.date, inicio) ? 0 : Math.max(0, libres ?? 0),
    agotada: false,
  };
}

const porHorario = (a: { fecha: string; inicio: string }, b: { fecha: string; inicio: string }) =>
  (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio);

/** Precio publicado por persona; null = "Info DM" o membresía. */
const precioDe = (w: FilaTaller) => (w.booking_mode === 'paid' && num(w.price) > 0 ? num(w.price) : null);

function flujoDe(w: FilaTaller): Taller['flujo'] {
  // Lo que crea el equipo en el panel se aparta siempre como taller.
  if (w.origen === 'panel') return 'taller';
  if (w.booking_type === 'membership') return 'membresia';
  if (w.category === 'kids' && w.booking_type === 'online' && precioDe(w) !== null) return 'kids';
  return 'taller';
}

function aTaller(w: FilaTaller, sesiones: Sesion[]): Taller {
  const descripcion = w.description ?? [];
  const galeria = (w.gallery ?? []).filter(esFoto);
  const foto = esFoto(w.image_key) ? w.image_key : galeria[0] ?? 'taller-clases';
  const precio = precioDe(w);
  const primera = sesiones[0];
  return {
    id: w.id,
    slug: w.slug,
    titulo: w.title,
    resumen: descripcion[0] ?? '',
    descripcion: descripcion.slice(1),
    foto,
    galeria: galeria.length ? galeria : [foto],
    categoria: w.category === 'kids' ? 'ninos' : w.category === 'adults' ? 'adultos' : 'temporada',
    etiqueta: w.label ?? (w.category === 'kids' ? 'Niños' : w.category === 'adults' ? 'Adultos' : 'Temporada'),
    edad: w.age_min !== null && w.age_max !== null ? { min: w.age_min, max: w.age_max } : null,
    precio,
    etiquetaPrecio: w.price_label,
    reservaEnLinea: w.booking_type === 'online' && precio !== null,
    flujo: flujoDe(w),
    duracionMin: primera?.fin ? minutosEntre(primera.inicio, primera.fin) : null,
    incluye: w.includes ?? [],
    sesiones,
    destacado: w.is_featured,
    demo: false,
  };
}

async function sesionesPublicas(filtro: { tipo?: TipoExperiencia; ids?: string[] } = {}): Promise<FilaSesion[]> {
  let q = supabase.from('public_sessions').select(COLUMNAS_SESION).order('date').order('start_time');
  if (filtro.tipo) q = q.eq('experience_type', filtro.tipo);
  if (filtro.ids) q = q.in('id', filtro.ids);
  const { data, error } = await q;
  if (error) throw errorBase(error, 'No pudimos cargar la agenda. Intenta de nuevo.');
  return (data ?? []) as FilaSesion[];
}

async function catalogo(): Promise<Taller[]> {
  const [talleres, sesiones] = await Promise.all([
    supabase.from('workshops').select(COLUMNAS_TALLER).eq('status', 'published'),
    sesionesPublicas(),
  ]);
  if (talleres.error) throw errorBase(talleres.error, 'No pudimos cargar los talleres. Intenta de nuevo.');

  const porTaller = new Map<string, Sesion[]>();
  for (const s of sesiones) {
    if (!s.workshop_id) continue;
    porTaller.set(s.workshop_id, [...(porTaller.get(s.workshop_id) ?? []), aSesion(s)]);
  }
  return ((talleres.data ?? []) as FilaTaller[])
    .filter((w) => porTaller.has(w.id))
    .map((w) => aTaller(w, porTaller.get(w.id)!))
    .sort((a, b) => porHorario(a.sesiones[0], b.sesiones[0]));
}

// --- Cuenta ------------------------------------------------------------------------

async function usuarioDeSesion(): Promise<Usuario | null> {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const { data: perfil } = await supabase.from('admin_profiles').select('user_id').eq('user_id', u.id).maybeSingle();
  const meta = (u.user_metadata ?? {}) as { nombre?: string; telefono?: string };
  return {
    id: u.id,
    nombre: meta.nombre ?? '',
    email: u.email ?? '',
    telefono: meta.telefono ?? '',
    creadoEn: u.created_at,
    rol: perfil ? 'admin' : 'customer',
  };
}

async function exigirSesion(): Promise<Usuario> {
  const u = await usuarioDeSesion();
  if (!u) throw new ErrorDatos('SIN_SESION', 'Inicia sesión o crea tu cuenta para continuar.');
  return u;
}

function errorAuth(mensaje: string): ErrorDatos {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login')) return new ErrorDatos('CREDENCIALES', 'El correo o la contraseña no coinciden.');
  if (m.includes('not confirmed')) {
    return new ErrorDatos('CONFIRMAR_CORREO', 'Confirma tu correo: abre el enlace que te enviamos al crear tu cuenta.');
  }
  if (m.includes('already registered') || m.includes('already exists')) {
    return new ErrorDatos('CORREO_REGISTRADO', 'Ya hay una cuenta con ese correo. Inicia sesión.');
  }
  if (m.includes('password')) return new ErrorDatos('DATOS_INVALIDOS', 'Tu contraseña necesita al menos 8 caracteres.');
  if (m.includes('rate limit') || m.includes('too many')) {
    return new ErrorDatos('DATOS_INVALIDOS', 'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
  }
  return new ErrorDatos('NO_CONECTADO', 'No pudimos completar la acción. Intenta de nuevo.');
}

/** Adonde regresa quien abre el enlace de un correo de Supabase Auth. */
const aqui = (ruta?: string) => `${window.location.origin}${ruta ?? window.location.pathname}`;

// --- Reservas ----------------------------------------------------------------------

const ESTADOS: Record<string, EstadoReserva> = {
  pending_payment: 'pendiente_pago',
  confirmed: 'confirmada',
  completed: 'completada',
  cancelled: 'cancelada',
  refunded: 'cancelada',
  no_show: 'no_asistio',
  expired: 'expirada',
};

const PAGOS: Record<string, EstadoPago> = {
  paid: 'pagado', paid_in_full: 'pagado', deposit_paid: 'anticipo_pagado', refunded: 'reembolsado', failed: 'fallido',
};

function metodoDe(p: FilaPago | null): MetodoPago | null {
  if (p?.method) return p.method as MetodoPago;
  return p?.provider === 'stripe' || p?.stripe_payment_intent_id ? 'tarjeta' : null;
}

/** El pago que cuenta: el cobrado (o reembolsado) y, si no hay, el más reciente. */
function pagoPrincipal(pagos: FilaPago[]): FilaPago | null {
  const orden = (p: FilaPago) => (p.status === 'paid' || p.status === 'refunded' ? 1 : 0);
  return [...pagos].sort((a, b) => orden(b) - orden(a) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? null;
}

function aReserva(f: FilaReserva, respaldo?: Contacto): Reserva {
  const tipo = f.experience_type;
  const sesiones = f.sessions
    .map((s) => ({ id: s.id, fecha: s.date, inicio: hhmm(s.start_time), fin: hhmmONulo(s.end_time) }))
    .sort(porHorario);
  const mes = f.month ? f.month.slice(0, 7) : claveMes(sesiones[0]?.fecha ?? hoy());
  const titulo =
    tipo === 'taller' ? f.workshop?.title ?? 'Taller'
    : tipo === 'kids' ? 'NUMA Kids'
    : tipo === 'pinta' ? 'Pinta tu pieza'
    : `Membresía ${etiquetaMes(mes).split(' ')[0]}`;

  let estado = ESTADOS[f.status] ?? 'cancelada';
  // Un apartado web vencido ya no ocupa lugar aunque el barrido no haya pasado.
  if (estado === 'pendiente_pago' && f.origin === 'web' && f.expires_at && new Date(f.expires_at).getTime() <= Date.now()) {
    estado = 'expirada';
  }
  const total = num(f.total_amount);
  // El cobro lo lleva la base (anticipo, pagado, saldo); aquí solo se copia.
  const cobro: CobroAnticipo | undefined = f.deposit_amount === null || f.deposit_amount === undefined ? undefined : {
    porcentaje: num(f.deposit_percentage),
    anticipo: num(f.deposit_amount),
    pagado: num(f.amount_paid),
    pagoFinal: f.final_payment_amount === null || f.final_payment_amount === undefined ? null : num(f.final_payment_amount),
    saldo: f.remaining_balance === null || f.remaining_balance === undefined ? total - num(f.amount_paid) : num(f.remaining_balance),
  };
  const pago: EstadoPago =
    f.payment?.status === 'paid' && f.payment_status === 'deposit_paid' ? 'anticipo_pagado'
    : PAGOS[f.payment?.status ?? ''] ?? (f.status === 'refunded' ? 'reembolsado' : 'pendiente');

  return {
    id: f.id,
    folio: f.folio,
    tipo,
    titulo,
    referencia: tipo === 'taller' ? f.workshop?.slug ?? '' : tipo === 'kids' ? 'kids' : mes,
    sesiones,
    participantes: f.quantity,
    ninos: f.children.length ? f.children.map((c) => ({ nombre: c.name, edad: c.age })) : undefined,
    precioUnitario: num(f.unit_price),
    subtotal: total,
    total,
    cobro,
    estado,
    pago,
    metodoPago: metodoDe(f.payment),
    referenciaPago: f.payment?.reference ?? f.payment?.stripe_payment_intent_id ?? null,
    pagadaEn: f.payment?.paid_at ?? (pago === 'pagado' ? f.confirmed_at : null),
    expiraEn: f.origin === 'web' ? f.expires_at : null,
    creadaEn: f.created_at,
    actualizadaEn: f.updated_at,
    usuarioId: f.user_id,
    contacto: f.customer
      ? { nombre: f.customer.full_name, email: f.customer.email, telefono: f.customer.phone ?? '' }
      : respaldo ?? { nombre: '', email: '', telefono: '' },
    notasInternas: f.internal_notes ?? '',
    origen: f.origin,
    demo: false,
  };
}

async function misFilas(): Promise<FilaReserva[]> {
  const { data, error } = await supabase.rpc('mis_reservas');
  if (error) throw errorBase(error, 'No pudimos cargar tus reservas. Intenta de nuevo.');
  return (data ?? []) as FilaReserva[];
}

const contactoDe = (u: Usuario): Contacto => ({ nombre: u.nombre, email: u.email, telefono: u.telefono });

const pintaSinConectar = () =>
  new ErrorDatos('NO_CONECTADO', 'Pinta tu pieza todavía no se puede reservar en línea. Escríbenos por WhatsApp y te apartamos tu lugar.');

// --- Implementación pública ------------------------------------------------------------

export const repoSupabase: Repositorio = {
  async talleres() {
    return catalogo();
  },

  async taller(slug) {
    return (await catalogo()).find((t) => t.slug === slug) ?? null;
  },

  async mesesMembresia(): Promise<MesMembresia[]> {
    const actual = claveMes(hoy());
    const porMes = new Map<string, Sesion[]>();
    for (const s of await sesionesPublicas({ tipo: 'membresia' })) {
      const clave = claveMes(s.date);
      if (clave < actual) continue;
      porMes.set(clave, [...(porMes.get(clave) ?? []), aSesion(s)]);
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, sesiones]) => ({ clave, etiqueta: etiquetaMes(clave), sesiones, demo: false }));
  },

  async sesionesKids() {
    return (await sesionesPublicas({ tipo: 'kids' })).map(aSesion);
  },

  // PENDIENTE: Pinta tu pieza todavía no está en la base (tabla paint_pieces,
  // sesiones 'paint_your_piece' y el cobro del anticipo en el servidor; ver
  // docs/INTEGRACION.md). Sin fechas ni piezas, la página ofrece WhatsApp y
  // no se puede apartar: nunca se cobra un anticipo calculado en el navegador.
  async sesionesPinta() {
    return [];
  },

  async piezasPinta() {
    return [];
  },

  // PENDIENTE: NUMA Store todavía no tiene tabla; son las fichas de ejemplo
  // (marcadas demo) hasta que Casa Numa suba las reales.
  async productos() {
    return PRODUCTOS_SEMILLA;
  },

  async producto(slug) {
    return PRODUCTOS_SEMILLA.find((p) => p.slug === slug) ?? null;
  },

  async disponibilidad(sesionIds) {
    const ids = sesionIds.filter(esUuid);
    if (!ids.length) return [];
    return (await sesionesPublicas({ ids })).map(aSesion);
  },

  async apartar(s) {
    if (s.tipo === 'pinta') throw pintaSinConectar();
    const usuario = await exigirSesion();
    if (!s.contacto.nombre.trim() || !correoValido(s.contacto.email) || soloDigitos(s.contacto.telefono).length < 10) {
      throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa nombre, correo y teléfono.');
    }

    // Si regresa a cambiar fechas o personas, su apartado anterior de esta
    // experiencia se suelta ANTES de medir el cupo: si no, su propio
    // apartado le quitaría el último lugar.
    const previas = (await misFilas()).map((f) => aReserva(f)).filter(
      (r) => r.estado === 'pendiente_pago' && r.origen === 'web' && r.tipo === s.tipo && r.referencia === s.referencia,
    );
    await Promise.all(previas.map((r) => supabase.rpc('liberar_mi_apartado', { p_reservation_id: r.id })));

    const creada = await funcion<{ reservation_id: string; reservation_code: string }>('create-reservation', {
      tipo: s.tipo,
      session_ids: [...new Set(s.sesionIds)],
      quantity: s.participantes,
      full_name: s.contacto.nombre.trim(),
      email: s.contacto.email.trim(),
      phone: s.contacto.telefono.trim(),
      children: (s.ninos ?? []).map((n: Nino) => ({ name: n.nombre.trim(), age: n.edad })),
      notes: s.notas || undefined,
    });

    // Para la pantalla a la que regresa Stripe (consulta por código + correo).
    try {
      sessionStorage.setItem(`numa:${creada.reservation_code}`, s.contacto.email.trim());
      sessionStorage.setItem(`numa:reserva:${creada.reservation_code}`, creada.reservation_id);
      sessionStorage.setItem('numa:ultima', creada.reservation_code);
    } catch {
      /* sin almacenamiento: /pago/exitoso pedirá el correo */
    }

    const fila = (await misFilas()).find((f) => f.id === creada.reservation_id);
    if (!fila) throw new ErrorDatos('NO_ENCONTRADO', 'Apartamos tus lugares, pero no pudimos mostrarlos. Revisa Mi cuenta.');
    return aReserva(fila, contactoDe(usuario));
  },

  // `opciones.simulacion` es solo de la demo: aquí cobra Stripe de verdad.
  async pagar(reservaId) {
    await exigirSesion();
    const r = await funcion<{ checkout_url: string }>('create-checkout-session', { reservation_id: reservaId });
    return { tipo: 'redireccion', url: r.checkout_url };
  },

  async liberar(reservaId) {
    await supabase.rpc('liberar_mi_apartado', { p_reservation_id: reservaId });
  },

  async misReservas() {
    const u = await exigirSesion();
    return (await misFilas()).map((f) => aReserva(f, contactoDe(u))).filter((r) => r.estado !== 'expirada');
  },

  async usuarioActual() {
    return usuarioDeSesion();
  },

  async registrar(d) {
    const email = d.email.trim().toLowerCase();
    if (!d.nombre.trim()) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe tu nombre.');
    if (!correoValido(email)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    if (soloDigitos(d.telefono).length < 10) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu teléfono necesita 10 dígitos.');
    if (d.password.length < 8) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu contraseña necesita al menos 8 caracteres.');

    const { data, error } = await supabase.auth.signUp({
      email,
      password: d.password,
      options: { data: { nombre: d.nombre.trim(), telefono: d.telefono.trim() }, emailRedirectTo: aqui() },
    });
    if (error) throw errorAuth(error.message);
    // Con confirmación de correo, Supabase no revela si el correo ya existía:
    // devuelve un usuario sin identidades.
    if (data.user && !data.user.identities?.length) {
      throw new ErrorDatos('CORREO_REGISTRADO', 'Ya hay una cuenta con ese correo. Inicia sesión.');
    }
    if (d.novedades) await supabase.rpc('suscribir_novedades', { p_email: email, p_origen: 'registro' });
    if (!data.session) {
      throw new ErrorDatos(
        'CONFIRMAR_CORREO',
        `Te enviamos un correo a ${email}. Abre el enlace para activar tu cuenta; te regresa aquí para continuar.`,
      );
    }
    return (await usuarioDeSesion())!;
  },

  async entrar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw errorAuth(error.message);
    return (await usuarioDeSesion())!;
  },

  async salir() {
    await supabase.auth.signOut();
  },

  async recuperarPassword(email) {
    if (!correoValido(email)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    // Se responde igual exista o no la cuenta: no se revela qué correos hay.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: aqui('/cuenta/nueva-contrasena'),
    });
    if (error && error.message.toLowerCase().includes('rate limit')) throw errorAuth(error.message);
  },

  async cambiarPassword(password) {
    await exigirSesion();
    if (password.length < 8) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu contraseña necesita al menos 8 caracteres.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw errorAuth(error.message);
  },

  async actualizarPerfil(cambios) {
    await exigirSesion();
    if (!cambios.nombre.trim()) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe tu nombre.');
    if (soloDigitos(cambios.telefono).length < 10) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu teléfono necesita 10 dígitos.');
    const { error } = await supabase.auth.updateUser({
      data: { nombre: cambios.nombre.trim(), telefono: cambios.telefono.trim() },
    });
    if (error) throw errorAuth(error.message);
    return (await usuarioDeSesion())!;
  },

  async suscribirNovedades(email) {
    const correo = email.trim().toLowerCase();
    if (!correoValido(correo)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    const { error } = await supabase.rpc('suscribir_novedades', { p_email: correo });
    if (error) throw errorBase(error, 'No pudimos guardar tu correo. Intenta de nuevo.');
  },
};

// --- Panel -------------------------------------------------------------------------------

const SELECT_RESERVA = `
  id, reservation_code, folio, experience_type, status, quantity, unit_price, total_amount, expires_at,
  deposit_percentage, deposit_amount, amount_paid, final_payment_amount, remaining_balance, payment_status,
  confirmed_at, created_at, updated_at, user_id, origin, internal_notes,
  customers ( full_name, email, phone ),
  workshops ( slug, title ),
  memberships ( month ),
  reservation_items ( workshop_sessions ( id, date, start_time, end_time ) ),
  reservation_children ( child_name, age, created_at ),
  payments ( id, provider, status, method, reference, stripe_payment_intent_id, amount, paid_at, created_at )
`;

interface FilaReservaAdmin extends Omit<FilaReserva, 'workshop' | 'month' | 'customer' | 'payment' | 'sessions' | 'children'> {
  customers: FilaReserva['customer'];
  workshops: FilaReserva['workshop'];
  memberships: { month: string } | { month: string }[] | null;
  reservation_items: { workshop_sessions: FilaReserva['sessions'][number] | null }[];
  reservation_children: { child_name: string; age: number; created_at: string }[];
  payments: FilaPago[];
}

function desdePanel(f: FilaReservaAdmin): Reserva {
  const membresia = Array.isArray(f.memberships) ? f.memberships[0] : f.memberships;
  return aReserva({
    ...f,
    customer: f.customers,
    workshop: f.workshops,
    month: membresia?.month ?? null,
    payment: pagoPrincipal(f.payments ?? []),
    sessions: (f.reservation_items ?? []).flatMap((i) => (i.workshop_sessions ? [i.workshop_sessions] : [])),
    children: [...(f.reservation_children ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ name: c.child_name, age: c.age })),
  });
}

async function reservasPanel(filtro: { id?: string; ids?: string[] } = {}): Promise<Reserva[]> {
  let q = supabase.from('reservations').select(SELECT_RESERVA).order('created_at', { ascending: false });
  if (filtro.id) q = q.eq('id', filtro.id);
  if (filtro.ids) q = q.in('id', filtro.ids);
  const { data, error } = await q;
  if (error) throw errorBase(error, 'No pudimos cargar las reservas. Intenta de nuevo.');
  return ((data ?? []) as unknown as FilaReservaAdmin[]).map(desdePanel);
}

/** Una reserva ocupa lugares mientras está viva (igual que lugares_ocupados_sesion). */
const ocupaLugar = (r: Reserva) => r.estado === 'confirmada' || r.estado === 'completada' || r.estado === 'pendiente_pago';

async function exigirAdmin(): Promise<Usuario> {
  const u = await usuarioDeSesion();
  if (!u || u.rol !== 'admin') throw new ErrorDatos('SIN_ACCESO', 'Inicia sesión con una cuenta del equipo.');
  return u;
}

/**
 * Sesiones con ocupación y asistentes. `desde`/`hasta` en 'YYYY-MM-DD'
 * (hasta, sin incluir). Las cerradas solo aparecen si alguien sigue apartado.
 */
async function sesionesPanel(desde: string, hasta?: string): Promise<SesionAdmin[]> {
  let q = supabase
    .from('sesiones_ocupacion')
    .select('id, experience_type, workshop_id, date, start_time, end_time, capacity, price, status, occupied')
    .gte('date', desde)
    .order('date')
    .order('start_time');
  if (hasta) q = q.lt('date', hasta);
  const [sesionesR, talleresR] = await Promise.all([
    q,
    supabase.from('workshops').select('id, slug, title, price_label, booking_type'),
  ]);
  if (sesionesR.error) throw errorBase(sesionesR.error, 'No pudimos cargar la agenda. Intenta de nuevo.');
  const sesiones = ((sesionesR.data ?? []) as FilaSesion[]).filter((s) => s.status === 'open' || (s.occupied ?? 0) > 0);
  const talleres = new Map(
    ((talleresR.data ?? []) as Pick<FilaTaller, 'id' | 'slug' | 'title' | 'price_label' | 'booking_type'>[]).map((w) => [w.id, w]),
  );

  // Quién va a cada sesión: reservas vivas con sus partidas.
  const asistentes = new Map<string, Asistente[]>();
  if (sesiones.length) {
    const { data: partidas, error } = await supabase
      .from('reservation_items')
      .select('session_id, reservation_id')
      .in('session_id', sesiones.map((s) => s.id));
    if (error) throw errorBase(error);
    const ids = [...new Set((partidas ?? []).map((p) => p.reservation_id as string))];
    const reservas = ids.length ? await reservasPanel({ ids }) : [];
    const porId = new Map(reservas.filter(ocupaLugar).map((r) => [r.id, r]));
    for (const p of partidas ?? []) {
      const r = porId.get(p.reservation_id as string);
      if (!r) continue;
      asistentes.set(p.session_id as string, [
        ...(asistentes.get(p.session_id as string) ?? []),
        {
          reservaId: r.id, folio: r.folio, nombre: r.contacto.nombre, telefono: r.contacto.telefono,
          personas: r.participantes, estado: r.estado, pago: r.pago, ninos: r.ninos,
        },
      ]);
    }
  }

  return sesiones.map((s) => {
    const w = s.workshop_id ? talleres.get(s.workshop_id) : undefined;
    const precio = s.experience_type === 'membresia' || s.price === null ? null : num(s.price);
    const tipo = s.experience_type;
    return {
      sesion: aSesion(s),
      tipo,
      titulo: tipo === 'taller' ? w?.title ?? 'Taller' : tipo === 'kids' ? 'NUMA Kids' : 'Membresía NUMA',
      slug: tipo === 'taller' ? w?.slug ?? null : null,
      precio,
      etiquetaPrecio:
        tipo === 'membresia' ? `$${MEMBRESIA.precio.toLocaleString('es-MX')} al mes`
        : precio === null ? w?.price_label ?? 'Info DM'
        : null,
      reservaEnLinea: tipo !== 'taller' || (precio !== null && (w?.booking_type ?? 'online') === 'online'),
      ocupados: s.occupied ?? 0,
      asistentes: asistentes.get(s.id) ?? [],
    };
  });
}

function membresiaDe(r: Reserva): MembresiaAdmin {
  const clases: ClaseMembresia[] = Array.from({ length: MEMBRESIA.clasesPorMes }, (_, i) => {
    const s = r.sesiones[i] ?? null;
    return { numero: i + 1, sesion: s, estado: !s ? 'disponible' : yaPaso(s.fecha, s.inicio) ? 'utilizada' : 'reservada' };
  });
  const utilizadas = clases.filter((c) => c.estado === 'utilizada').length;
  const reservadas = clases.filter((c) => c.estado === 'reservada').length;
  return { reserva: r, mes: r.referencia, clases, utilizadas, reservadas, restantes: MEMBRESIA.clasesPorMes - utilizadas };
}

/** Acción del panel: la Edge Function verifica en el servidor que sea del equipo. */
const accion = <T = unknown>(action: string, cuerpo: Record<string, unknown>) =>
  funcion<T>('admin-actions', { action, ...cuerpo });

interface FilaAviso {
  id: string;
  type: 'email_send' | 'whatsapp_send';
  entity_id: string;
  payload: { template?: string };
  status: 'pending' | 'processing' | 'done' | 'failed';
  last_error: string | null;
  created_at: string;
}

function estadoAviso(j: FilaAviso): Aviso['estado'] {
  if (j.last_error?.startsWith('OMITIDO')) return 'pendiente_integracion';
  if (j.last_error?.includes('ADMIN_NOTIFICATION_EMAIL')) return 'sin_destinatario';
  if (j.status === 'done') return 'enviado';
  if (j.status === 'failed') return 'fallido';
  return 'en_cola';
}

export const repoAdminSupabase: RepositorioAdmin = {
  async adminActual() {
    const u = await usuarioDeSesion();
    return u?.rol === 'admin' ? u : null;
  },

  async entrarAdmin(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw errorAuth(error.message);
    const u = await usuarioDeSesion();
    // Tener cuenta no basta: hay que estar en admin_profiles.
    if (u?.rol !== 'admin') {
      await supabase.auth.signOut();
      throw new ErrorDatos('SIN_ACCESO', 'Esta cuenta no tiene acceso al panel.');
    }
    return u;
  },

  async salirAdmin() {
    await supabase.auth.signOut();
  },

  async resumen(): Promise<ResumenAdmin> {
    await exigirAdmin();
    const hoyIso = hoy();
    const en7 = sumarDias(hoyIso, 7);
    const [reservas, proximas] = await Promise.all([reservasPanel(), sesionesPanel(hoyIso, sumarDias(hoyIso, 60))]);
    const vivas = reservas.filter(ocupaLugar);
    const deHoy = vivas.filter((r) => r.sesiones.some((s) => s.fecha === hoyIso));
    return {
      reservasHoy: deHoy.length,
      personasHoy: deHoy.reduce((n, r) => n + r.participantes, 0),
      proximos7: vivas.filter((r) => r.sesiones.some((s) => s.fecha >= hoyIso && s.fecha < en7)).length,
      ingresosConfirmados: reservas.reduce((n, r) => n + montoPagado(r), 0),
      pagosPendientes: vivas.filter((r) => r.pago === 'pendiente').length,
      // Lo que falta cobrar en el estudio de las reservas confirmadas con anticipo.
      saldoPorCobrar: vivas.filter((r) => r.cobro && r.estado !== 'pendiente_pago').reduce((n, r) => n + Math.max(0, saldoDe(r)), 0),
      revisionManual: reservas.filter((r) => r.cobro && r.cobro.saldo < 0 && r.estado !== 'cancelada').length,
      cupoBajo: proximas.filter(
        (x) => x.tipo !== 'membresia' && !yaPaso(x.sesion.fecha, x.sesion.inicio) && x.sesion.disponibles !== null && x.sesion.disponibles <= 3,
      ).length,
      ultimas: reservas.filter((r) => r.estado !== 'expirada').slice(0, 6),
      hoy: proximas.filter((x) => x.sesion.fecha === hoyIso && (x.tipo === 'taller' || x.asistentes.length > 0)),
    };
  },

  async reservas() {
    await exigirAdmin();
    return reservasPanel();
  },

  async reserva(id) {
    await exigirAdmin();
    if (!esUuid(id)) return null;
    return (await reservasPanel({ id }))[0] ?? null;
  },

  async actualizarReserva(id, cambios: CambiosReserva) {
    await exigirAdmin();
    const r = (await reservasPanel({ id }))[0];
    if (!r) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');

    // Una reserva en línea no se marca «pagado» a mano: el anticipo lo confirma
    // el pago en línea y el resto se cobra con «Marcar saldo como pagado».
    if (r.cobro && cambios.pago === 'pagado') {
      throw new ErrorDatos('DATOS_INVALIDOS', 'Registra lo cobrado en el estudio con «Marcar saldo como pagado».');
    }

    // Pago recibido en el estudio: confirma, pone folio y avisa (la base
    // vuelve a medir el cupo si el apartado ya había vencido).
    if (cambios.pago === 'pagado' && r.pago !== 'pagado') {
      await accion('register_payment', { reservation_id: id, amount: r.total });
    } else if (cambios.pago === 'reembolsado' && (r.pago === 'pagado' || r.pago === 'anticipo_pagado')) {
      await accion('mark_refunded', { reservation_id: id });
    }

    if (cambios.estado && cambios.estado !== r.estado) {
      if (cambios.estado === 'confirmada' && cambios.pago !== 'pagado' && r.pago !== 'pagado' && r.pago !== 'anticipo_pagado') {
        throw new ErrorDatos('DATOS_INVALIDOS', 'Registra el pago antes de confirmar la reserva.');
      }
      if (cambios.estado === 'cancelada') await accion('cancel_reservation', { reservation_id: id });
      else if (cambios.estado === 'completada') await accion('update_reservation', { reservation_id: id, status: 'completed' });
      else if (cambios.estado === 'no_asistio') await accion('update_reservation', { reservation_id: id, status: 'no_show' });
    }

    if (cambios.notasInternas !== undefined) {
      await accion('update_reservation', { reservation_id: id, internal_notes: cambios.notasInternas });
    }

    const nueva = (await reservasPanel({ id }))[0];
    if (!nueva) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');
    return nueva;
  },

  async crearReservaManual(s: SolicitudManual) {
    await exigirAdmin();
    const r = await accion<{ reservation: { reservation_id: string } }>('create_manual_reservation', {
      session_id: s.sesionId,
      quantity: s.participantes,
      full_name: s.contacto.nombre.trim(),
      email: s.contacto.email.trim(),
      phone: s.contacto.telefono.trim(),
      total: s.total,
      method: s.metodoPago,
      reference: s.referenciaPago.trim() || undefined,
      children: (s.ninos ?? []).map((n) => ({ name: n.nombre.trim(), age: n.edad })),
      internal_notes: s.notasInternas,
      paid: s.pagado,
      notify_client: s.avisarCliente,
    });
    const nueva = (await reservasPanel({ id: r.reservation.reservation_id }))[0];
    if (!nueva) throw new ErrorDatos('NO_ENCONTRADO', 'La reserva se registró, pero no pudimos mostrarla. Recarga la página.');
    return nueva;
  },

  // Saldo cobrado en el estudio: deposit_paid → paid_in_full. El pago del
  // anticipo se conserva; el saldo entra como su propio pago.
  async liquidarSaldo(id, metodo) {
    await exigirAdmin();
    const r = (await reservasPanel({ id }))[0];
    if (!r) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');
    if (!r.cobro) throw new ErrorDatos('DATOS_INVALIDOS', 'Esta reserva no se paga por anticipo.');
    if (r.cobro.saldo < 0) throw new ErrorDatos('DATOS_INVALIDOS', 'Pagó más del total: requiere revisión manual.');
    await accion('settle_balance', { reservation_id: id, method: metodo });
    const nueva = (await reservasPanel({ id }))[0];
    if (!nueva) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');
    return nueva;
  },

  // PENDIENTE: Pinta tu pieza en la base (docs/INTEGRACION.md). Hasta
  // entonces no hay piezas ni inventario que administrar.
  async cambiarPieza() {
    await exigirAdmin();
    throw pintaSinConectar();
  },

  async piezas() {
    await exigirAdmin();
    return [];
  },

  async editarPieza() {
    await exigirAdmin();
    throw pintaSinConectar();
  },

  async agenda(mes) {
    await exigirAdmin();
    const [a, m] = mes.split('-').map(Number);
    const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
    return (await sesionesPanel(`${mes}-01`, `${siguiente}-01`)).filter((x) => x.tipo === 'taller' || x.asistentes.length > 0);
  },

  async talleres() {
    await exigirAdmin();
    // Talleres del mes en curso en adelante (también los que ya pasaron este
    // mes) y las sesiones próximas de NUMA Kids y membresía.
    return (await sesionesPanel(`${claveMes(hoy())}-01`)).filter(
      (x) => x.tipo === 'taller' || !yaPaso(x.sesion.fecha, x.sesion.inicio),
    );
  },

  async ajustarCupo(sesionId, cupo) {
    await exigirAdmin();
    if (cupo !== null && (!Number.isInteger(cupo) || cupo < 0)) throw new ErrorDatos('DATOS_INVALIDOS', 'El cupo debe ser un número entero.');
    await accion('set_capacity', { session_id: sesionId, capacity: cupo });
  },

  async membresias() {
    await exigirAdmin();
    return (await reservasPanel())
      .filter((r) => r.tipo === 'membresia' && r.estado !== 'expirada')
      .sort((a, b) => b.referencia.localeCompare(a.referencia) || a.contacto.nombre.localeCompare(b.contacto.nombre))
      .map(membresiaDe);
  },

  async clientes() {
    await exigirAdmin();
    const [reservas, cuentasR] = await Promise.all([reservasPanel(), supabase.rpc('admin_cuentas')]);
    const mapa = new Map<string, ClienteAdmin>();
    for (const c of (cuentasR.data ?? []) as { email: string; nombre: string | null; telefono: string | null }[]) {
      const k = c.email.toLowerCase();
      mapa.set(k, { email: k, nombre: c.nombre ?? '', telefono: c.telefono ?? '', tieneCuenta: true, reservas: 0, pagado: 0, ultima: null, demo: false });
    }
    for (const r of reservas.filter((x) => x.estado !== 'expirada')) {
      const k = r.contacto.email.toLowerCase();
      if (!k) continue;
      const c = mapa.get(k) ?? {
        email: k, nombre: r.contacto.nombre, telefono: r.contacto.telefono, tieneCuenta: false, reservas: 0, pagado: 0, ultima: null, demo: false,
      };
      if (!c.nombre) c.nombre = r.contacto.nombre;
      if (!c.telefono) c.telefono = r.contacto.telefono;
      c.reservas += 1;
      c.pagado += montoPagado(r);
      if (!c.ultima || r.creadaEn > c.ultima) c.ultima = r.creadaEn;
      mapa.set(k, c);
    }
    return [...mapa.values()].sort((a, b) => (b.ultima ?? '').localeCompare(a.ultima ?? ''));
  },

  async pagos(): Promise<Pago[]> {
    await exigirAdmin();
    const { data, error } = await supabase
      .from('payments')
      .select('id, reservation_id, provider, status, method, reference, stripe_payment_intent_id, amount, created_at, reservations ( folio, deposit_amount, customers ( full_name ) )')
      // Un cobro abandonado (el apartado venció) no es un pago.
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    if (error) throw errorBase(error, 'No pudimos cargar los pagos. Intenta de nuevo.');
    type Fila = FilaPago & { reservation_id: string; reservations: { folio: string | null; deposit_amount: number | null; customers: { full_name: string } | null } | null };
    return ((data ?? []) as unknown as Fila[]).map((p) => ({
      id: p.id!,
      reservaId: p.reservation_id,
      folio: p.reservations?.folio ?? null,
      cliente: p.reservations?.customers?.full_name ?? '',
      proveedor: p.provider === 'stripe' ? 'stripe' : 'manual',
      referencia: p.reference ?? p.stripe_payment_intent_id ?? null,
      metodo: metodoDe(p),
      monto: num(p.amount),
      concepto: p.reference === 'Saldo en el estudio' ? 'saldo' : p.reservations?.deposit_amount != null ? 'anticipo' : 'total',
      estado: PAGOS[p.status] ?? 'pendiente',
      creadoEn: p.created_at!,
      demo: false,
    }));
  },

  async avisos(reservaId) {
    await exigirAdmin();
    let q = supabase
      .from('integration_jobs')
      .select('id, type, entity_id, payload, status, last_error, created_at')
      .eq('entity_type', 'reservation')
      .in('type', ['email_send', 'whatsapp_send'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (reservaId) {
      if (!esUuid(reservaId)) return [];
      q = q.eq('entity_id', reservaId);
    }
    const { data, error } = await q;
    if (error) throw errorBase(error, 'No pudimos cargar los avisos. Intenta de nuevo.');
    const trabajos = (data ?? []) as FilaAviso[];
    if (!trabajos.length) return [];

    // El contenido se arma con la misma plantilla que ve la demo; el estado
    // es el real de la cola.
    const reservas = new Map(
      (await reservasPanel({ ids: [...new Set(trabajos.map((j) => j.entity_id))] })).map((r) => [r.id, r]),
    );
    return trabajos.flatMap((j): Aviso[] => {
      const r = reservas.get(j.entity_id);
      if (!r) return [];
      const [equipo, cliente, whatsapp] = avisosReservaConfirmada(r, () => j.id);
      const plantilla = j.payload?.template;
      const base: Aviso =
        j.type === 'whatsapp_send' ? whatsapp
        : plantilla === 'admin_reserva' ? equipo
        : plantilla === 'cancelacion'
          ? {
              ...cliente,
              asunto: `Tu reserva fue cancelada — ${r.folio ?? r.titulo}`,
              lineas: [`Hola, ${r.contacto.nombre.split(' ')[0]}.`, '', `Tu reserva de ${r.titulo} fue cancelada.`],
              enlace: null,
            }
          : cliente;
      const estado = estadoAviso(j);
      return [{
        ...base,
        id: j.id,
        para: base.destinatario === 'cliente'
          ? r.contacto.email || null
          : base.canal === 'email' ? siteConfig.correoAvisosEquipo || (estado === 'enviado' ? 'Correo del equipo' : null) : null,
        estado,
        error: estado === 'fallido' || estado === 'en_cola' ? j.last_error ?? undefined : undefined,
        creadoEn: j.created_at,
      }];
    });
  },

  async integraciones() {
    await exigirAdmin();
    // El último trabajo de cada tipo dice si la integración ya funciona.
    const ultimo = async (tipo: string, filtro?: (q: ReturnType<typeof consulta>) => ReturnType<typeof consulta>) => {
      let q = consulta(tipo);
      if (filtro) q = filtro(q);
      const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data as { status: string; last_error: string | null } | null;
    };
    // Solo trabajos terminados: uno en cola todavía no dice si funciona.
    const consulta = (tipo: string) =>
      supabase.from('integration_jobs').select('status, last_error').eq('type', tipo).in('status', ['done', 'failed']);
    const leer = (j: { status: string; last_error: string | null } | null, faltaSi: RegExp) => {
      if (!j) return { estado: 'sin_datos' as const, detalle: 'Todavía no hay avisos que la usen.' };
      if (j.last_error && faltaSi.test(j.last_error)) return { estado: 'sin_configurar' as const, detalle: j.last_error };
      if (j.status === 'done') return { estado: 'activo' as const };
      return { estado: 'error' as const, detalle: j.last_error ?? undefined };
    };
    const [correo, whatsapp, calendario] = await Promise.all([
      ultimo('email_send', (q) => q.eq('entity_type', 'reservation')),
      ultimo('whatsapp_send'),
      ultimo('calendar_sync', (q) => q.eq('entity_type', 'session')),
    ]);
    return {
      correo: leer(correo, /RESEND_API_KEY|RESEND_FROM|Falta la variable/),
      whatsapp: leer(whatsapp, /^OMITIDO/),
      calendario: leer(calendario, /^OMITIDO|GOOGLE_/),
    };
  },

  async catalogo() {
    await exigirAdmin();
    // Del mes pasado en adelante; los talleres de ejemplo de v1 (otras
    // categorías) no son parte del catálogo.
    const desde = sumarDias(`${claveMes(hoy())}-01`, -31);
    const [talleresR, sesionesR] = await Promise.all([
      supabase
        .from('workshops')
        .select(`${COLUMNAS_TALLER}, status, date, editado_en`)
        .in('category', ['adults', 'kids', 'seasonal'])
        .gte('date', desde),
      supabase
        .from('sesiones_ocupacion')
        .select('id, workshop_id, date, start_time, end_time, capacity, status, occupied')
        .gte('date', desde)
        .order('start_time'),
    ]);
    if (talleresR.error) throw errorBase(talleresR.error, 'No pudimos cargar el catálogo. Intenta de nuevo.');
    if (sesionesR.error) throw errorBase(sesionesR.error, 'No pudimos cargar el catálogo. Intenta de nuevo.');
    type Fila = FilaTaller & { status: string; date: string; editado_en: string | null };
    const sesiones = (sesionesR.data ?? []) as FilaSesion[];
    return ((talleresR.data ?? []) as unknown as Fila[])
      .map((w): TallerCatalogo => ({
        id: w.id,
        slug: w.slug,
        titulo: w.title,
        resumen: w.description?.[0] ?? '',
        categoria: w.category === 'kids' ? 'ninos' : w.category === 'adults' ? 'adultos' : 'temporada',
        precio: precioDe(w),
        foto: esFoto(w.image_key) ? w.image_key : 'taller-clases',
        activo: w.status === 'published',
        origen: w.origen ?? 'agenda',
        editado: Boolean(w.editado_en),
        flujo: flujoDe(w),
        fecha: w.date,
        sesiones: sesiones
          .filter((s) => s.workshop_id === w.id && s.status !== 'cancelled')
          .map((s) => ({ id: s.id, inicio: hhmm(s.start_time), fin: hhmmONulo(s.end_time), cupo: s.capacity, ocupados: s.occupied ?? 0 })),
      }))
      .sort((a, b) => (a.fecha + (a.sesiones[0]?.inicio ?? '')).localeCompare(b.fecha + (b.sesiones[0]?.inicio ?? '')));
  },

  async crearTaller(n: TallerNuevo) {
    await exigirAdmin();
    validarTallerNuevo(n);
    const horarios = [...n.horarios].sort((x, y) => x.inicio.localeCompare(y.inicio));
    const base = slugTaller(n.titulo, n.fecha);
    const conPrecio = n.precio !== null;

    // El slug es único: si ya existe, se prueba con -2, -3…
    let id: string | null = null;
    for (let k = 1; k <= 6 && !id; k++) {
      const { data, error } = await supabase
        .from('workshops')
        .insert({
          slug: k === 1 ? base : `${base}-${k}`,
          title: n.titulo.trim(),
          category: CATEGORIA_DB[n.categoria],
          short_description: n.resumen.trim(),
          description: [n.resumen.trim()],
          date: n.fecha,
          start_time: horarios[0].inicio,
          end_time: horarios[0].fin,
          timezone: 'America/Monterrey',
          price: n.precio ?? 0,
          currency: 'MXN',
          capacity: n.cupo,
          price_label: conPrecio ? null : 'Info DM',
          image_key: n.foto,
          gallery: [n.foto],
          includes: [],
          is_featured: false,
          status: 'published',
          booking_mode: conPrecio ? 'paid' : 'quote',
          booking_type: conPrecio ? 'online' : 'inquiry',
          origen: 'panel',
        })
        .select('id')
        .single();
      if (!error) id = (data as { id: string }).id;
      else if (error.code !== '23505') throw errorBase(error, 'No pudimos crear el taller. Intenta de nuevo.');
    }
    if (!id) throw new ErrorDatos('DATOS_INVALIDOS', 'Ya hay varios talleres con ese nombre ese día. Cambia el nombre.');

    const { error } = await supabase.from('workshop_sessions').insert(
      horarios.map((h) => ({
        experience_type: 'taller',
        workshop_id: id,
        date: n.fecha,
        start_time: h.inicio,
        end_time: h.fin,
        capacity: n.cupo,
        price: n.precio,
      })),
    );
    if (error) throw errorBase(error, 'El taller se creó, pero no sus horarios. Revísalo en el catálogo.');
    const creado = (await repoAdminSupabase.catalogo()).find((t) => t.id === id);
    if (!creado) throw new ErrorDatos('NO_ENCONTRADO', 'El taller se creó; recarga la página para verlo.');
    return creado;
  },

  async editarTaller(tallerId: string, c: CambiosTaller) {
    await exigirAdmin();
    validarCambiosTaller(c);
    const actual = (await repoAdminSupabase.catalogo()).find((t) => t.id === tallerId);
    if (!actual) throw new ErrorDatos('NO_ENCONTRADO', 'Ese taller ya no existe.');
    const cambiaPrecio = c.precio !== undefined && c.precio !== actual.precio;
    if (cambiaPrecio && actual.flujo !== 'taller') {
      throw new ErrorDatos('DATOS_INVALIDOS', 'El precio de NUMA Kids y de la membresía se define en su propia página, no por fecha.');
    }

    const cambios: Record<string, unknown> = { editado_en: new Date().toISOString() };
    if (c.titulo !== undefined) cambios.title = c.titulo.trim();
    if (c.resumen !== undefined) {
      cambios.short_description = c.resumen.trim();
      const { data } = await supabase.from('workshops').select('description').eq('id', tallerId).single();
      cambios.description = [c.resumen.trim(), ...(((data as { description: string[] | null } | null)?.description ?? []).slice(1))];
    }
    if (c.categoria !== undefined) cambios.category = CATEGORIA_DB[c.categoria];
    if (c.foto !== undefined) {
      cambios.image_key = c.foto;
      cambios.gallery = [c.foto];
    }
    if (cambiaPrecio) {
      const precio = c.precio ?? null;
      cambios.price = precio ?? 0;
      cambios.booking_mode = precio !== null ? 'paid' : 'quote';
      cambios.price_label = precio !== null ? null : 'Info DM';
      cambios.booking_type = precio !== null ? 'online' : 'inquiry';
    }
    const { error } = await supabase.from('workshops').update(cambios).eq('id', tallerId);
    if (error) throw errorBase(error, 'No pudimos guardar los cambios. Intenta de nuevo.');
    if (cambiaPrecio) {
      const { error: e2 } = await supabase.from('workshop_sessions').update({ price: c.precio ?? null }).eq('workshop_id', tallerId);
      if (e2) throw errorBase(e2, 'El taller se guardó, pero no el precio de sus horarios.');
    }
    const nuevo = (await repoAdminSupabase.catalogo()).find((t) => t.id === tallerId);
    if (!nuevo) throw new ErrorDatos('NO_ENCONTRADO', 'Ese taller ya no existe.');
    return nuevo;
  },

  async activarTaller(tallerId: string, activo: boolean) {
    await exigirAdmin();
    const { error } = await supabase
      .from('workshops')
      .update({ status: activo ? 'published' : 'draft', editado_en: new Date().toISOString() })
      .eq('id', tallerId);
    if (error) throw errorBase(error, 'No pudimos cambiar el estado del taller. Intenta de nuevo.');
  },
};
