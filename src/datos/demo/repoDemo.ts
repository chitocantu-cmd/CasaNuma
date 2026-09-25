// ===========================================================================
// Backend de demostración
// ---------------------------------------------------------------------------
// Simula dentro del navegador (localStorage) lo que hará el backend real, con
// sus mismas reglas:
//   · el precio sale del catálogo, nunca de lo que manda la página;
//   · el cupo se vuelve a comprobar en el mismo paso que aparta los lugares
//     (en Supabase: transacción con bloqueo de fila en crear_reserva);
//   · un apartado sin pagar se libera solo a los 15 minutos;
//   · la reserva se CONFIRMA solo cuando el pago se confirma, y es entonces
//     cuando recibe su folio consecutivo (NUMA-00001…) y salen los avisos;
//   · el panel exige una sesión con rol 'admin'; una clienta solo ve lo suyo.
//
// Los pagos son FALSOS y los datos viven solo en este navegador: el panel
// muestra lo que se reservó aquí mismo. Es una demostración del flujo.
// ===========================================================================

import { EDADES_KIDS, KIDS, MEMBRESIA } from '../../contenido/oferta';
import { claveMes, etiquetaMes, hoy, minutosEntre, sumarDias, yaPaso } from '../../lib/calendario';
import { sinLugar } from '../../lib/cupo';
import { correoValido, soloDigitos } from '../../lib/formato';
import { AGENDA, flujoAgenda, idSesionAgenda, type RegistroTaller } from '../agenda';
import { avisoClienteManual, avisosReservaConfirmada } from '../avisos';
import { ErrorDatos, type CambiosReserva, type Repositorio, type RepositorioAdmin } from '../repositorio';
import type {
  Asistente, Aviso, ClaseMembresia, ClienteAdmin, Contacto, MembresiaAdmin, MesMembresia, Nino, Pago,
  Registro, Reserva, ResumenAdmin, Sesion, SesionAdmin, SesionReservada, SolicitudManual, SolicitudReserva,
  Taller, TipoExperiencia, Usuario,
} from '../tipos';
import { PRODUCTOS_SEMILLA, mesesMembresiaSemilla, sesionesKidsSemilla, sesionesMembresiaDelMes } from './semilla';

// v3: reservas con folio, pagos, avisos y roles. v4: NUMA Kids y membresía
// toman sus fechas de la agenda (las reservas DEMO de v3 apuntaban a fechas
// generadas que ya no existen). Lo guardado por versiones anteriores se descarta.
const CLAVE = 'numa:demo:v4';
const MINUTOS_APARTADO = 15;
/** PENDIENTE: tope por reserva mientras no haya cupo confirmado. */
const MAX_PERSONAS_TALLER = 6;
const MAX_NINOS = 4;

export const CUENTA_DEMO = { email: 'ana@demo.casanuma.mx', password: 'numa2026' };
export const ADMIN_DEMO = { email: 'equipo@demo.casanuma.mx', password: 'numa-admin' };

interface UsuarioGuardado extends Usuario {
  hash: string;
  demo: boolean;
}

interface Estado {
  version: 4;
  usuarios: UsuarioGuardado[];
  /** Sesión del sitio público (clienta). */
  sesionUsuarioId: string | null;
  /** Sesión del panel. Aparte, para poder demostrar ambos lados en el mismo navegador. */
  sesionAdminId: string | null;
  reservas: Reserva[];
  pagos: Pago[];
  avisos: Aviso[];
  suscriptores: string[];
  /** Cupos capturados desde el panel. Ausente = el de la agenda. */
  cupos: Record<string, number | null>;
  /** Último folio emitido. En Supabase: una secuencia. */
  ultimoFolio: number;
}

// --- Almacenamiento ---------------------------------------------------------
// localStorage puede no existir (modo privado estricto): entonces la demo
// funciona en memoria y se pierde al recargar, pero no truena.

let memoria: Estado | null = null;

function vacio(): Estado {
  return {
    version: 4, usuarios: [], sesionUsuarioId: null, sesionAdminId: null, reservas: [], pagos: [], avisos: [],
    suscriptores: [], cupos: {}, ultimoFolio: 0,
  };
}

function leer(): Estado {
  if (memoria) return memoria;
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (crudo) {
      memoria = JSON.parse(crudo) as Estado;
      return memoria;
    }
  } catch {
    /* sin almacenamiento: seguimos en memoria */
  }
  memoria = vacio();
  return memoria;
}

// Otra pestaña (p. ej. la web en una y el panel en otra) cambió los datos:
// se vuelven a leer en la siguiente consulta.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === CLAVE) memoria = null;
  });
}

function guardar(e: Estado) {
  memoria = e;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* sin almacenamiento */
  }
}

const espera = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();

async function hashPassword(email: string, password: string): Promise<string> {
  const texto = `numa:${email.toLowerCase()}:${password}`;
  // crypto.subtle solo existe en contextos seguros; un .html abierto desde el
  // disco puede no serlo. Para una demo basta un hash simple de respaldo.
  if (!globalThis.crypto?.subtle) {
    let h = 5381;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    return `djb2-${h.toString(16)}`;
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function id(prefijo: string) {
  return `${prefijo}_${Math.random().toString(36).slice(2, 10)}`;
}

function siguienteFolio(e: Estado): string {
  e.ultimoFolio += 1;
  return `NUMA-${String(e.ultimoFolio).padStart(5, '0')}`;
}

function publico(u: UsuarioGuardado): Usuario {
  const { hash: _h, demo: _d, ...resto } = u;
  void _h;
  void _d;
  return resto;
}

// --- Cupo ---------------------------------------------------------------------

/** Una reserva ocupa lugares mientras está viva. */
function ocupaLugar(r: Reserva): boolean {
  if (r.estado === 'confirmada' || r.estado === 'completada') return true;
  if (r.estado !== 'pendiente_pago') return false;
  return r.expiraEn === null || new Date(r.expiraEn).getTime() > Date.now();
}

/** Apartados vencidos pasan a 'expirada' en cuanto alguien lee el estado. */
function vencerApartados(e: Estado): Estado {
  let cambio = false;
  const reservas = e.reservas.map((r) => {
    if (r.estado === 'pendiente_pago' && r.expiraEn && new Date(r.expiraEn).getTime() <= Date.now()) {
      cambio = true;
      return { ...r, estado: 'expirada' as const, actualizadaEn: ahora() };
    }
    return r;
  });
  if (!cambio) return e;
  const nuevo = { ...e, reservas };
  guardar(nuevo);
  return nuevo;
}

function ocupados(e: Estado, sesionId: string): number {
  return e.reservas
    .filter(ocupaLugar)
    .filter((r) => r.sesiones.some((s) => s.id === sesionId))
    .reduce((n, r) => n + r.participantes, 0);
}

/** Cupo vigente (el del panel manda sobre el de la agenda) y lugares libres. */
function conDisponibles(e: Estado, s: Sesion): Sesion {
  const cupo = s.id in e.cupos ? e.cupos[s.id] : s.cupo;
  if (cupo === null) return { ...s, cupo: null, disponibles: null };
  const disponibles = yaPaso(s.fecha, s.inicio) ? 0 : Math.max(0, cupo - ocupados(e, s.id));
  return { ...s, cupo, disponibles };
}

// --- Catálogo -------------------------------------------------------------------

/** Fila de la agenda (forma de la tabla `workshops`) → taller de la interfaz. */
function aTaller(r: RegistroTaller): Taller {
  const primera = r.sessions[0];
  return {
    id: r.id,
    slug: r.slug,
    titulo: r.title,
    resumen: r.description[0] ?? '',
    descripcion: r.description.slice(1),
    foto: r.image,
    galeria: r.gallery,
    categoria: r.category === 'kids' ? 'ninos' : r.category === 'adults' ? 'adultos' : 'temporada',
    etiqueta: r.label ?? (r.category === 'kids' ? 'Niños' : r.category === 'adults' ? 'Adultos' : 'Temporada'),
    edad: r.age_min !== null && r.age_max !== null ? { min: r.age_min, max: r.age_max } : null,
    precio: r.price,
    etiquetaPrecio: r.price_label,
    // Sin precio publicado no hay cobro en línea, diga lo que diga el registro.
    reservaEnLinea: r.booking_type === 'online' && r.price !== null,
    flujo: flujoAgenda(r),
    duracionMin: primera?.end_time ? minutosEntre(primera.start_time, primera.end_time) : null,
    incluye: r.includes,
    sesiones: r.sessions.map((x) => ({
      id: idSesionAgenda(r, x.start_time),
      fecha: r.date,
      inicio: x.start_time,
      fin: x.end_time,
      cupo: x.capacity,
      disponibles: x.available_spots,
      agotada: x.is_sold_out,
    })),
    destacado: r.is_featured,
    demo: false,
  };
}

const talleresBase = () => AGENDA.filter((r) => r.is_active).map(aTaller);

function catalogoTalleres(e: Estado): Taller[] {
  return talleresBase()
    .map((t) => ({ ...t, sesiones: t.sesiones.map((s) => conDisponibles(e, s)) }))
    .sort((a, b) =>
      (a.sesiones[0].fecha + a.sesiones[0].inicio).localeCompare(b.sesiones[0].fecha + b.sesiones[0].inicio),
    );
}

function catalogoMeses(e: Estado): MesMembresia[] {
  return mesesMembresiaSemilla().map((m) => ({ ...m, sesiones: m.sesiones.map((s) => conDisponibles(e, s)) }));
}

function catalogoKids(e: Estado): Sesion[] {
  return sesionesKidsSemilla().map((s) => conDisponibles(e, s));
}

/** Todas las sesiones reservables, con a qué experiencia pertenecen. */
type SesionCatalogo = Omit<SesionAdmin, 'ocupados' | 'asistentes'>;

function todasLasSesiones(e: Estado): SesionCatalogo[] {
  const meses = [...new Set([...catalogoMeses(e).map((m) => m.clave), ...e.reservas.map((r) => claveMes(r.sesiones[0]?.fecha ?? hoy()))])];
  const membresia = meses.flatMap((m) => sesionesMembresiaDelMes(m)).map((s) => conDisponibles(e, s));
  return [
    ...catalogoTalleres(e).filter((t) => t.flujo === 'taller').flatMap((t) =>
      t.sesiones.map((s) => ({
        sesion: s, tipo: 'taller' as const, titulo: t.titulo, slug: t.slug,
        precio: t.precio, etiquetaPrecio: t.etiquetaPrecio, reservaEnLinea: t.reservaEnLinea,
      })),
    ),
    ...catalogoKids(e).map((s) => ({
      sesion: s, tipo: 'kids' as const, titulo: 'NUMA Kids', slug: null,
      precio: KIDS.precio, etiquetaPrecio: null, reservaEnLinea: true,
    })),
    ...membresia.map((s) => ({
      sesion: s, tipo: 'membresia' as const, titulo: 'Membresía NUMA', slug: null,
      precio: null, etiquetaPrecio: `$${MEMBRESIA.precio.toLocaleString('es-MX')} al mes`, reservaEnLinea: true,
    })),
  ];
}

// --- Reservas de ejemplo ----------------------------------------------------------
// Marcadas demo: true. Para que el panel no arranque vacío y se vea cómo
// trabaja. Solo sobre experiencias con precio publicado ($800, $680, $3,200):
// no se inventan importes de talleres "Info DM".

interface Semilla {
  tipo: TipoExperiencia;
  titulo: string;
  referencia: string;
  sesiones: SesionReservada[];
  participantes: number;
  precioUnitario: number;
  contacto: Contacto;
  hace: number; // horas
  pagado: boolean;
  metodo: 'tarjeta' | 'transferencia';
  origen: 'web' | 'panel';
  usuarioId?: string;
  ninos?: Nino[];
  notas?: string;
}

const sr = (s: Sesion): SesionReservada => ({ id: s.id, fecha: s.fecha, inicio: s.inicio, fin: s.fin });
const tel = (n: number) => `81 0000 ${String(n).padStart(4, '0')}`;

function semillas(usuarioAna: UsuarioGuardado): Semilla[] {
  const talleres = talleresBase();
  const sesion = (slugParcial: string, hora: string) => {
    const t = talleres.find((x) => x.slug.startsWith(slugParcial));
    const s = t?.sesiones.find((x) => x.inicio === hora);
    return t && s ? { t, s } : null;
  };
  const lista: Semilla[] = [];

  // Membresía de Ana: dos clases recientes y dos próximas.
  const hoyIso = hoy();
  const cercanas = [
    ...sesionesMembresiaDelMes(claveMes(sumarDias(hoyIso, -21))),
    ...sesionesMembresiaDelMes(claveMes(hoyIso)),
    ...sesionesMembresiaDelMes(claveMes(sumarDias(hoyIso, 21))),
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  const pasadas = cercanas.filter((s) => yaPaso(s.fecha, s.inicio)).slice(-2);
  const futuras = cercanas.filter((s) => !yaPaso(s.fecha, s.inicio) && s.fecha > sumarDias(hoyIso, 1)).slice(0, 2);
  const mesAna = claveMes([...pasadas, ...futuras][0]?.fecha ?? hoyIso);
  lista.push({
    tipo: 'membresia', titulo: `Membresía ${etiquetaMes(mesAna).split(' ')[0]}`, referencia: mesAna,
    sesiones: [...pasadas, ...futuras].map(sr), participantes: 1, precioUnitario: MEMBRESIA.precio,
    contacto: { nombre: usuarioAna.nombre, email: usuarioAna.email, telefono: usuarioAna.telefono },
    hace: 20 * 24, pagado: true, metodo: 'tarjeta', origen: 'web', usuarioId: usuarioAna.id,
  });

  const taller = (slug: string, hora: string, nombre: string, n: number, personas: number, hace: number, pagado = true, origen: 'web' | 'panel' = 'web', notas?: string) => {
    const x = sesion(slug, hora);
    if (!x || x.t.precio === null) return;
    lista.push({
      tipo: 'taller', titulo: x.t.titulo, referencia: x.t.slug, sesiones: [sr(x.s)], participantes: personas,
      precioUnitario: x.t.precio, hace, pagado, metodo: pagado ? 'tarjeta' : 'transferencia', origen, notas,
      contacto: { nombre, email: `${nombre.split(' ')[0].toLowerCase()}@demo.casanuma.mx`, telefono: tel(n) },
    });
  };
  taller('tazas-de-halloween-03', '11:00', 'Mariana Treviño', 11, 2, 72);
  taller('tazas-de-halloween-03', '11:00', 'Daniela Garza', 12, 1, 50);
  taller('tazas-de-halloween-03', '16:00', 'Luis Villarreal', 13, 3, 26, true, 'web', 'Viene con su hija de 12 años.');
  taller('tazas-de-halloween-03', '16:00', 'Paola Cantú', 14, 2, 5, false, 'panel', 'Apartó por Instagram; paga por transferencia.');
  taller('tazas-de-halloween-y-pan', '11:00', 'Regina Salinas', 15, 2, 40);

  const kids = sesionesKidsSemilla()[0];
  if (kids) {
    lista.push({
      tipo: 'kids', titulo: 'NUMA Kids', referencia: 'kids', sesiones: [sr(kids)], participantes: 1,
      precioUnitario: KIDS.precio, hace: 30, pagado: true, metodo: 'tarjeta', origen: 'web',
      ninos: [{ nombre: 'Emilio', edad: 11 }],
      contacto: { nombre: 'Andrea Martínez', email: 'andrea@demo.casanuma.mx', telefono: tel(16) },
    });
  }

  const mesSiguiente = mesesMembresiaSemilla().find((m) => m.sesiones.filter((s) => !yaPaso(s.fecha, s.inicio)).length >= 4);
  if (mesSiguiente) {
    const clases = mesSiguiente.sesiones.filter((s) => !yaPaso(s.fecha, s.inicio)).slice(0, 4);
    if (clases.length === 4) {
      lista.push({
        tipo: 'membresia', titulo: `Membresía ${mesSiguiente.etiqueta.split(' ')[0]}`, referencia: mesSiguiente.clave,
        sesiones: clases.map(sr), participantes: 1, precioUnitario: MEMBRESIA.precio, hace: 96, pagado: true,
        metodo: 'tarjeta', origen: 'web',
        contacto: { nombre: 'Valeria Ríos', email: 'valeria@demo.casanuma.mx', telefono: tel(17) },
      });
    }
  }
  return lista.sort((a, b) => b.hace - a.hace);
}

async function sembrar(e: Estado): Promise<Estado> {
  if (e.usuarios.length) return e;
  const equipo: UsuarioGuardado = {
    id: 'usr_equipo', nombre: 'Equipo Casa Numa', email: ADMIN_DEMO.email, telefono: '', rol: 'admin',
    creadoEn: ahora(), hash: await hashPassword(ADMIN_DEMO.email, ADMIN_DEMO.password), demo: true,
  };
  const ana: UsuarioGuardado = {
    id: 'usr_demo', nombre: 'Ana López', email: CUENTA_DEMO.email, telefono: '81 0000 0010', rol: 'customer',
    creadoEn: new Date(Date.now() - 30 * 864e5).toISOString(),
    hash: await hashPassword(CUENTA_DEMO.email, CUENTA_DEMO.password), demo: true,
  };
  const nuevo: Estado = { ...vacio(), usuarios: [equipo, ana] };

  for (const s of semillas(ana)) {
    const creada = new Date(Date.now() - s.hace * 3600_000).toISOString();
    const total = s.precioUnitario * s.participantes;
    const r: Reserva = {
      id: id('res'),
      // Las del panel llevan folio desde que se registran; las de la web,
      // cuando se confirma el pago.
      folio: s.pagado || s.origen === 'panel' ? siguienteFolio(nuevo) : null,
      tipo: s.tipo, titulo: s.titulo, referencia: s.referencia, sesiones: s.sesiones,
      participantes: s.participantes, ninos: s.ninos, precioUnitario: s.precioUnitario, subtotal: total, total,
      estado: s.pagado ? 'confirmada' : 'pendiente_pago', pago: s.pagado ? 'pagado' : 'pendiente',
      metodoPago: s.metodo, referenciaPago: s.pagado ? `demo_pi_${Math.random().toString(36).slice(2, 10)}` : null,
      pagadaEn: s.pagado ? creada : null, expiraEn: null, creadaEn: creada, actualizadaEn: creada,
      usuarioId: s.usuarioId ?? null, contacto: s.contacto, notasInternas: s.notas ?? '', origen: s.origen, demo: true,
    };
    nuevo.reservas.push(r);
    nuevo.pagos.push({
      id: id('pag'), reservaId: r.id, folio: r.folio, cliente: r.contacto.nombre,
      proveedor: s.origen === 'panel' ? 'manual' : 'demo', referencia: r.referenciaPago, metodo: r.metodoPago,
      monto: r.total, estado: r.pago, creadoEn: creada, demo: true,
    });
  }
  guardar(nuevo);
  return nuevo;
}

async function estado(): Promise<Estado> {
  return vencerApartados(await sembrar(leer()));
}

function usuarioEnSesion(e: Estado): UsuarioGuardado {
  const u = e.usuarios.find((x) => x.id === e.sesionUsuarioId);
  if (!u) throw new ErrorDatos('SIN_SESION', 'Inicia sesión o crea tu cuenta para continuar.');
  return u;
}

function exigirAdmin(e: Estado): UsuarioGuardado {
  const u = e.usuarios.find((x) => x.id === e.sesionAdminId);
  if (!u || u.rol !== 'admin') throw new ErrorDatos('SIN_ACCESO', 'Inicia sesión con una cuenta del equipo.');
  return u;
}

// --- Validación de reservas ---------------------------------------------------

interface Resuelto {
  titulo: string;
  precioUnitario: number;
  sesiones: Sesion[];
}

function resolver(e: Estado, s: SolicitudReserva): Resuelto {
  if (s.participantes < 1) throw new ErrorDatos('DATOS_INVALIDOS', 'Elige cuántas personas asistirán.');
  const unicos = [...new Set(s.sesionIds)];

  if (s.tipo === 'taller') {
    const t = catalogoTalleres(e).find((x) => x.slug === s.referencia);
    if (!t) throw new ErrorDatos('NO_ENCONTRADO', 'Este taller ya no está disponible.');
    if (!t.reservaEnLinea || t.precio === null) {
      throw new ErrorDatos('SIN_RESERVA_EN_LINEA', 'Este taller se aparta por mensaje. Escríbenos para pedir información.');
    }
    if (t.flujo !== 'taller') {
      throw new ErrorDatos('SIN_RESERVA_EN_LINEA', t.flujo === 'kids'
        ? 'Este taller se aparta desde NUMA Kids, con el nombre y la edad de cada niño.'
        : 'Esta clase se aparta al contratar la membresía.');
    }
    if (unicos.length !== 1) throw new ErrorDatos('SESION_INVALIDA', 'Elige una fecha y un horario.');
    if (s.participantes > MAX_PERSONAS_TALLER) {
      throw new ErrorDatos('DATOS_INVALIDOS', `Para grupos de más de ${MAX_PERSONAS_TALLER} personas, escríbenos y lo organizamos.`);
    }
    const sesion = t.sesiones.find((x) => x.id === unicos[0]);
    if (!sesion) throw new ErrorDatos('SESION_INVALIDA', 'Ese horario ya no existe.');
    return { titulo: t.titulo, precioUnitario: t.precio, sesiones: [sesion] };
  }

  if (s.tipo === 'membresia') {
    const mes = catalogoMeses(e).find((m) => m.clave === s.referencia);
    if (!mes) throw new ErrorDatos('NO_ENCONTRADO', 'Ese mes no está abierto para membresía.');
    if (unicos.length !== MEMBRESIA.clasesPorMes) {
      throw new ErrorDatos('LIMITE_SESIONES', `Tu membresía incluye exactamente ${MEMBRESIA.clasesPorMes} clases. Elige ${MEMBRESIA.clasesPorMes} fechas.`);
    }
    if (s.participantes !== 1) throw new ErrorDatos('DATOS_INVALIDOS', 'La membresía es individual.');
    const sesiones = unicos.map((sid) => mes.sesiones.find((x) => x.id === sid));
    if (sesiones.some((x) => !x)) throw new ErrorDatos('SESION_INVALIDA', `Todas tus clases deben ser de ${mes.etiqueta}.`);
    return { titulo: `Membresía ${mes.etiqueta.split(' ')[0]}`, precioUnitario: MEMBRESIA.precio, sesiones: sesiones as Sesion[] };
  }

  // kids
  const ninos = s.ninos ?? [];
  if (ninos.length !== s.participantes) throw new ErrorDatos('DATOS_INVALIDOS', 'Faltan datos de algún niño o niña.');
  if (ninos.length > MAX_NINOS) throw new ErrorDatos('DATOS_INVALIDOS', `Puedes inscribir hasta ${MAX_NINOS} niños por reserva.`);
  if (ninos.some((n) => !n.nombre.trim())) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe el nombre de cada niño o niña.');
  if (ninos.some((n) => !Number.isFinite(n.edad) || n.edad < KIDS.edadMinima || n.edad > KIDS.edadMaxima)) {
    throw new ErrorDatos('EDAD_MINIMA', `NUMA Kids es para niñas y niños de ${EDADES_KIDS}.`);
  }
  if (unicos.length !== 1) throw new ErrorDatos('SESION_INVALIDA', 'Elige un jueves.');
  const sesion = catalogoKids(e).find((x) => x.id === unicos[0]);
  if (!sesion) throw new ErrorDatos('SESION_INVALIDA', 'Esa fecha ya no está disponible.');
  return { titulo: 'NUMA Kids', precioUnitario: KIDS.precio, sesiones: [sesion] };
}

/**
 * Comprobación de cupo en el mismo paso que aparta: no hay ventana entre
 * "sí hay lugar" y "ya lo tomé". En Supabase es una transacción con
 * SELECT … FOR UPDATE sobre las sesiones (ver crear_reserva_sesiones).
 */
function verificarCupo(sesiones: Sesion[], personas: number) {
  const falta = sesiones.find((s) => sinLugar(s) || (s.disponibles !== null && s.disponibles < personas));
  if (!falta) return;
  if (sinLugar(falta) || falta.disponibles === null || falta.disponibles === 0) {
    throw new ErrorDatos('SIN_CUPO', 'Este horario ya está agotado. Elige otro.', [falta.id]);
  }
  throw new ErrorDatos(
    'SIN_CUPO',
    `Solo ${falta.disponibles === 1 ? 'queda 1 lugar disponible' : `quedan ${falta.disponibles} lugares disponibles`}.`,
    [falta.id],
  );
}

function validarContacto(c: Contacto) {
  if (!c.nombre.trim() || !correoValido(c.email) || soloDigitos(c.telefono).length < 10) {
    throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa nombre, correo y teléfono.');
  }
}

const sesionReservada = ({ id: sid, fecha, inicio, fin }: Sesion): SesionReservada => ({ id: sid, fecha, inicio, fin });
const porFecha = (a: SesionReservada, b: SesionReservada) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio);

/** Confirma el cobro: folio, pago registrado y avisos. */
function confirmar(e: Estado, r: Reserva, pago: { proveedor: Pago['proveedor']; metodo: Reserva['metodoPago']; referencia: string | null }, avisar: 'todos' | 'cliente' | 'nadie'): Reserva {
  const t = ahora();
  const confirmada: Reserva = {
    ...r,
    folio: r.folio ?? siguienteFolio(e),
    estado: 'confirmada',
    pago: 'pagado',
    metodoPago: pago.metodo,
    referenciaPago: pago.referencia,
    pagadaEn: t,
    expiraEn: null,
    actualizadaEn: t,
  };
  e.reservas = e.reservas.map((x) => (x.id === r.id ? confirmada : x));
  const existente = e.pagos.find((p) => p.reservaId === r.id);
  const registro: Pago = {
    id: existente?.id ?? id('pag'), reservaId: r.id, folio: confirmada.folio, cliente: r.contacto.nombre,
    proveedor: pago.proveedor, referencia: pago.referencia, metodo: pago.metodo, monto: r.total, estado: 'pagado',
    creadoEn: t, demo: false,
  };
  e.pagos = existente ? e.pagos.map((p) => (p.id === existente.id ? registro : p)) : [...e.pagos, registro];
  if (avisar !== 'nadie') {
    const avisos = avisar === 'todos' ? avisosReservaConfirmada(confirmada, () => id('av')) : avisoClienteManual(confirmada, () => id('av'));
    e.avisos = [...e.avisos, ...avisos];
  }
  return confirmada;
}

// --- Implementación pública ------------------------------------------------------

export const repoDemo: Repositorio = {
  async talleres() {
    await espera(260);
    return catalogoTalleres(await estado());
  },

  async taller(slug) {
    await espera(200);
    return catalogoTalleres(await estado()).find((t) => t.slug === slug) ?? null;
  },

  async mesesMembresia() {
    await espera(260);
    return catalogoMeses(await estado());
  },

  async sesionesKids() {
    await espera(240);
    return catalogoKids(await estado());
  },

  async productos() {
    await espera(200);
    return PRODUCTOS_SEMILLA;
  },

  async producto(slug) {
    await espera(150);
    return PRODUCTOS_SEMILLA.find((p) => p.slug === slug) ?? null;
  },

  async disponibilidad(sesionIds) {
    await espera(220);
    const todas = todasLasSesiones(await estado());
    return sesionIds.map((sid) => todas.find((x) => x.sesion.id === sid)?.sesion).filter(Boolean) as Sesion[];
  },

  async apartar(solicitud) {
    await espera(500);
    const e = { ...(await estado()) };
    const usuario = usuarioEnSesion(e);
    validarContacto(solicitud.contacto);

    // Si la persona regresa a cambiar sus fechas, su apartado anterior de esta
    // experiencia se libera ANTES de medir el cupo (si no, su propio apartado
    // le quitaría el último lugar).
    e.reservas = e.reservas.map((x) =>
      x.usuarioId === usuario.id && x.estado === 'pendiente_pago' && x.origen === 'web' && x.tipo === solicitud.tipo && x.referencia === solicitud.referencia
        ? { ...x, estado: 'expirada' as const, actualizadaEn: ahora() }
        : x,
    );

    const r = resolver(e, solicitud);
    verificarCupo(r.sesiones, solicitud.participantes);

    const t = ahora();
    const total = r.precioUnitario * solicitud.participantes;
    const reserva: Reserva = {
      id: id('res'),
      folio: null,
      tipo: solicitud.tipo,
      titulo: r.titulo,
      referencia: solicitud.referencia,
      sesiones: r.sesiones.map(sesionReservada).sort(porFecha),
      participantes: solicitud.participantes,
      ninos: solicitud.ninos,
      precioUnitario: r.precioUnitario,
      subtotal: total,
      total,
      estado: 'pendiente_pago',
      pago: 'pendiente',
      metodoPago: null,
      referenciaPago: null,
      pagadaEn: null,
      expiraEn: new Date(Date.now() + MINUTOS_APARTADO * 60_000).toISOString(),
      creadaEn: t,
      actualizadaEn: t,
      usuarioId: usuario.id,
      contacto: {
        nombre: solicitud.contacto.nombre.trim(),
        email: solicitud.contacto.email.trim(),
        telefono: solicitud.contacto.telefono.trim(),
      },
      notasInternas: solicitud.notas ?? '',
      origen: 'web',
      demo: false,
    };
    e.reservas = [...e.reservas, reserva];
    guardar({ ...e });
    return reserva;
  },

  async pagar(reservaId) {
    await espera(1100);
    const e = { ...(await estado()) };
    const usuario = usuarioEnSesion(e);
    const r = e.reservas.find((x) => x.id === reservaId && x.usuarioId === usuario.id);
    if (!r) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos tu reserva.');
    if (r.estado === 'confirmada') return { tipo: 'confirmado', reserva: r };
    if (r.estado !== 'pendiente_pago') {
      throw new ErrorDatos('APARTADO_VENCIDO', 'Tu apartado venció antes de completar el pago. Vuelve a elegir tus fechas.');
    }
    // En producción esto no pasa aquí: Stripe cobra, el webhook verifica la
    // firma y SOLO entonces confirmar_pago() asigna el folio.
    const confirmada = confirmar(e, r, { proveedor: 'demo', metodo: 'tarjeta', referencia: `demo_pi_${Math.random().toString(36).slice(2, 12)}` }, 'todos');
    guardar({ ...e });
    return { tipo: 'confirmado', reserva: confirmada };
  },

  async liberar(reservaId) {
    const e = leer();
    guardar({
      ...e,
      reservas: e.reservas.map((x) =>
        x.id === reservaId && x.estado === 'pendiente_pago' && x.origen === 'web' ? { ...x, estado: 'expirada' as const, actualizadaEn: ahora() } : x,
      ),
    });
  },

  async misReservas() {
    await espera(250);
    const e = await estado();
    const u = usuarioEnSesion(e);
    // Una clienta ve sus reservas: las de su cuenta y las que el equipo
    // registró con su mismo correo.
    return e.reservas
      .filter((r) => (r.usuarioId === u.id || (!r.usuarioId && r.contacto.email.toLowerCase() === u.email)) && r.estado !== 'expirada')
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
  },

  async usuarioActual() {
    const e = await estado();
    const u = e.usuarios.find((x) => x.id === e.sesionUsuarioId);
    return u ? publico(u) : null;
  },

  async registrar(d: Registro) {
    await espera(450);
    const e = await estado();
    const email = d.email.trim().toLowerCase();
    if (!d.nombre.trim()) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe tu nombre.');
    if (!correoValido(email)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    if (soloDigitos(d.telefono).length < 10) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu teléfono necesita 10 dígitos.');
    if (d.password.length < 8) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu contraseña necesita al menos 8 caracteres.');
    if (e.usuarios.some((u) => u.email === email)) {
      throw new ErrorDatos('CORREO_REGISTRADO', 'Ya hay una cuenta con ese correo. Inicia sesión.');
    }
    const u: UsuarioGuardado = {
      id: id('usr'), nombre: d.nombre.trim(), email, telefono: d.telefono.trim(), creadoEn: ahora(),
      rol: 'customer', hash: await hashPassword(email, d.password), demo: false,
    };
    const suscriptores = d.novedades && !e.suscriptores.includes(email) ? [...e.suscriptores, email] : e.suscriptores;
    guardar({ ...e, usuarios: [...e.usuarios, u], sesionUsuarioId: u.id, suscriptores });
    return publico(u);
  },

  async entrar(email, password) {
    await espera(450);
    const e = await estado();
    const correo = email.trim().toLowerCase();
    const u = e.usuarios.find((x) => x.email === correo);
    if (!u || u.hash !== (await hashPassword(correo, password))) {
      throw new ErrorDatos('CREDENCIALES', 'El correo o la contraseña no coinciden.');
    }
    guardar({ ...e, sesionUsuarioId: u.id });
    return publico(u);
  },

  async salir() {
    guardar({ ...leer(), sesionUsuarioId: null });
  },

  async recuperarPassword(email) {
    await espera(500);
    if (!correoValido(email)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    // En la demo no se manda correo. Se responde igual exista o no la cuenta,
    // para no revelar qué correos están registrados.
  },

  async cambiarPassword(password) {
    await espera(350);
    const e = await estado();
    const u = usuarioEnSesion(e);
    if (password.length < 8) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu contraseña necesita al menos 8 caracteres.');
    const nuevo = { ...u, hash: await hashPassword(u.email, password) };
    guardar({ ...e, usuarios: e.usuarios.map((x) => (x.id === u.id ? nuevo : x)) });
  },

  async actualizarPerfil(cambios) {
    await espera(350);
    const e = await estado();
    const u = usuarioEnSesion(e);
    if (!cambios.nombre.trim()) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe tu nombre.');
    if (soloDigitos(cambios.telefono).length < 10) throw new ErrorDatos('DATOS_INVALIDOS', 'Tu teléfono necesita 10 dígitos.');
    const nuevo = { ...u, nombre: cambios.nombre.trim(), telefono: cambios.telefono.trim() };
    guardar({ ...e, usuarios: e.usuarios.map((x) => (x.id === u.id ? nuevo : x)) });
    return publico(nuevo);
  },

  async suscribirNovedades(email) {
    await espera(400);
    const correo = email.trim().toLowerCase();
    if (!correoValido(correo)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    const e = leer();
    if (!e.suscriptores.includes(correo)) guardar({ ...e, suscriptores: [...e.suscriptores, correo] });
  },
};

// --- Panel --------------------------------------------------------------------

function asistentesDe(e: Estado, sesionId: string): Asistente[] {
  return e.reservas
    .filter((r) => ocupaLugar(r) && r.sesiones.some((s) => s.id === sesionId))
    .map((r) => ({
      reservaId: r.id, folio: r.folio, nombre: r.contacto.nombre, telefono: r.contacto.telefono,
      personas: r.participantes, estado: r.estado, pago: r.pago, ninos: r.ninos,
    }));
}

function aSesionAdmin(e: Estado, x: SesionCatalogo): SesionAdmin {
  const asistentes = asistentesDe(e, x.sesion.id);
  return { ...x, ocupados: asistentes.reduce((n, a) => n + a.personas, 0), asistentes };
}

function membresiaDe(r: Reserva): MembresiaAdmin {
  const clases: ClaseMembresia[] = Array.from({ length: MEMBRESIA.clasesPorMes }, (_, i) => {
    const s = r.sesiones[i] ?? null;
    return {
      numero: i + 1,
      sesion: s,
      estado: !s ? 'disponible' : yaPaso(s.fecha, s.inicio) ? 'utilizada' : 'reservada',
    };
  });
  const utilizadas = clases.filter((c) => c.estado === 'utilizada').length;
  const reservadas = clases.filter((c) => c.estado === 'reservada').length;
  return { reserva: r, mes: r.referencia, clases, utilizadas, reservadas, restantes: MEMBRESIA.clasesPorMes - utilizadas };
}

export const repoAdminDemo: RepositorioAdmin = {
  async adminActual() {
    const e = await estado();
    const u = e.usuarios.find((x) => x.id === e.sesionAdminId);
    return u && u.rol === 'admin' ? publico(u) : null;
  },

  async entrarAdmin(email, password) {
    await espera(450);
    const e = await estado();
    const correo = email.trim().toLowerCase();
    const u = e.usuarios.find((x) => x.email === correo);
    if (!u || u.hash !== (await hashPassword(correo, password))) {
      throw new ErrorDatos('CREDENCIALES', 'El correo o la contraseña no coinciden.');
    }
    // Tener cuenta no basta: hay que tener rol de equipo.
    if (u.rol !== 'admin') throw new ErrorDatos('SIN_ACCESO', 'Esta cuenta no tiene acceso al panel.');
    guardar({ ...e, sesionAdminId: u.id });
    return publico(u);
  },

  async salirAdmin() {
    guardar({ ...leer(), sesionAdminId: null });
  },

  async resumen(): Promise<ResumenAdmin> {
    await espera(250);
    const e = await estado();
    exigirAdmin(e);
    const hoyIso = hoy();
    const en7 = sumarDias(hoyIso, 7);
    const vivas = e.reservas.filter(ocupaLugar);
    const deHoy = vivas.filter((r) => r.sesiones.some((s) => s.fecha === hoyIso));
    const sesiones = todasLasSesiones(e);
    return {
      reservasHoy: deHoy.length,
      personasHoy: deHoy.reduce((n, r) => n + r.participantes, 0),
      proximos7: vivas.filter((r) => r.sesiones.some((s) => s.fecha >= hoyIso && s.fecha < en7)).length,
      ingresosConfirmados: e.reservas.filter((r) => r.pago === 'pagado').reduce((n, r) => n + r.total, 0),
      pagosPendientes: vivas.filter((r) => r.pago === 'pendiente').length,
      cupoBajo: sesiones.filter((x) => x.tipo !== 'membresia' && !yaPaso(x.sesion.fecha, x.sesion.inicio) && x.sesion.disponibles !== null && x.sesion.disponibles <= 3).length,
      ultimas: [...e.reservas].filter((r) => r.estado !== 'expirada').sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)).slice(0, 6),
      hoy: sesiones.filter((x) => x.sesion.fecha === hoyIso).map((x) => aSesionAdmin(e, x)).filter((x) => x.tipo === 'taller' || x.asistentes.length),
    };
  },

  async reservas() {
    await espera(200);
    const e = await estado();
    exigirAdmin(e);
    return [...e.reservas].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
  },

  async reserva(reservaId) {
    await espera(150);
    const e = await estado();
    exigirAdmin(e);
    return e.reservas.find((r) => r.id === reservaId) ?? null;
  },

  async actualizarReserva(reservaId, cambios: CambiosReserva) {
    await espera(300);
    const e = { ...(await estado()) };
    exigirAdmin(e);
    const r = e.reservas.find((x) => x.id === reservaId);
    if (!r) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos esa reserva.');

    let nueva: Reserva = { ...r, actualizadaEn: ahora() };
    if (cambios.notasInternas !== undefined) nueva.notasInternas = cambios.notasInternas;

    // Registrar un pago recibido en el estudio (transferencia, efectivo):
    // confirma la reserva y le da folio si no lo tenía.
    if (cambios.pago === 'pagado' && r.pago !== 'pagado') {
      e.reservas = e.reservas.map((x) => (x.id === r.id ? nueva : x));
      nueva = confirmar(e, nueva, { proveedor: 'manual', metodo: r.metodoPago ?? 'transferencia', referencia: r.referenciaPago }, 'nadie');
    } else if (cambios.pago) {
      nueva.pago = cambios.pago;
      e.pagos = e.pagos.map((p) => (p.reservaId === r.id ? { ...p, estado: cambios.pago! } : p));
    }

    if (cambios.estado && cambios.estado !== nueva.estado) {
      if (cambios.estado === 'confirmada' && nueva.pago !== 'pagado') {
        throw new ErrorDatos('DATOS_INVALIDOS', 'Registra el pago antes de confirmar la reserva.');
      }
      nueva = { ...nueva, estado: cambios.estado };
    }

    e.reservas = e.reservas.map((x) => (x.id === r.id ? nueva : x));
    guardar({ ...e });
    return nueva;
  },

  async crearReservaManual(s: SolicitudManual) {
    await espera(400);
    const e = { ...(await estado()) };
    exigirAdmin(e);
    validarContacto(s.contacto);
    if (s.participantes < 1) throw new ErrorDatos('DATOS_INVALIDOS', 'Indica cuántas personas.');
    if (!(s.total >= 0)) throw new ErrorDatos('DATOS_INVALIDOS', 'Captura el importe.');
    const x = todasLasSesiones(e).find((y) => y.sesion.id === s.sesionId);
    if (!x) throw new ErrorDatos('SESION_INVALIDA', 'Elige una sesión de la agenda.');
    if (x.tipo === 'kids' && (!s.ninos?.length || s.ninos.some((n) => !n.nombre.trim() || n.edad < KIDS.edadMinima || n.edad > KIDS.edadMaxima))) {
      throw new ErrorDatos('EDAD_MINIMA', `Captura el nombre y la edad (${EDADES_KIDS}) de cada niño.`);
    }
    // El equipo tampoco puede sobrevender.
    verificarCupo([x.sesion], s.participantes);

    const t = ahora();
    const base: Reserva = {
      id: id('res'),
      folio: siguienteFolio(e),
      tipo: x.tipo,
      titulo: x.titulo,
      referencia: x.slug ?? (x.tipo === 'kids' ? 'kids' : claveMes(x.sesion.fecha)),
      sesiones: [sesionReservada(x.sesion)],
      participantes: s.participantes,
      ninos: x.tipo === 'kids' ? s.ninos : undefined,
      precioUnitario: Math.round((s.total / s.participantes) * 100) / 100,
      subtotal: s.total,
      total: s.total,
      estado: 'pendiente_pago',
      pago: 'pendiente',
      metodoPago: s.metodoPago,
      referenciaPago: s.referenciaPago.trim() || null,
      pagadaEn: null,
      expiraEn: null,
      creadaEn: t,
      actualizadaEn: t,
      usuarioId: e.usuarios.find((u) => u.email === s.contacto.email.trim().toLowerCase())?.id ?? null,
      contacto: { nombre: s.contacto.nombre.trim(), email: s.contacto.email.trim(), telefono: s.contacto.telefono.trim() },
      notasInternas: s.notasInternas,
      origen: 'panel',
      demo: false,
    };
    e.reservas = [...e.reservas, base];
    e.pagos = [...e.pagos, {
      id: id('pag'), reservaId: base.id, folio: base.folio, cliente: base.contacto.nombre, proveedor: 'manual',
      referencia: base.referenciaPago, metodo: s.metodoPago, monto: s.total, estado: 'pendiente', creadoEn: t, demo: false,
    }];
    const final = s.pagado
      ? confirmar(e, base, { proveedor: 'manual', metodo: s.metodoPago, referencia: base.referenciaPago }, s.avisarCliente ? 'cliente' : 'nadie')
      : base;
    guardar({ ...e });
    return final;
  },

  async agenda(mes) {
    await espera(250);
    const e = await estado();
    exigirAdmin(e);
    return todasLasSesiones(e)
      .filter((x) => x.sesion.fecha.startsWith(mes))
      .map((x) => aSesionAdmin(e, x))
      .filter((x) => x.tipo === 'taller' || x.asistentes.length > 0)
      .sort((a, b) => (a.sesion.fecha + a.sesion.inicio).localeCompare(b.sesion.fecha + b.sesion.inicio));
  },

  async talleres() {
    await espera(200);
    const e = await estado();
    exigirAdmin(e);
    // Talleres de la agenda (también los pasados del mes) y las sesiones
    // próximas de NUMA Kids y membresía, que también tienen cupo propio.
    return todasLasSesiones(e)
      .filter((x) => x.tipo === 'taller' || !yaPaso(x.sesion.fecha, x.sesion.inicio))
      .map((x) => aSesionAdmin(e, x))
      .sort((a, b) => (a.sesion.fecha + a.sesion.inicio).localeCompare(b.sesion.fecha + b.sesion.inicio));
  },

  async ajustarCupo(sesionId, cupo) {
    await espera(250);
    const e = await estado();
    exigirAdmin(e);
    if (cupo !== null && (!Number.isInteger(cupo) || cupo < 0)) throw new ErrorDatos('DATOS_INVALIDOS', 'El cupo debe ser un número entero.');
    const ocupadosAhora = ocupados(e, sesionId);
    if (cupo !== null && cupo < ocupadosAhora) {
      throw new ErrorDatos('DATOS_INVALIDOS', `Ya hay ${ocupadosAhora} lugares reservados en esa sesión: el cupo no puede ser menor.`);
    }
    guardar({ ...e, cupos: { ...e.cupos, [sesionId]: cupo } });
  },

  async membresias() {
    await espera(200);
    const e = await estado();
    exigirAdmin(e);
    return e.reservas
      .filter((r) => r.tipo === 'membresia' && r.estado !== 'expirada')
      .sort((a, b) => b.referencia.localeCompare(a.referencia) || a.contacto.nombre.localeCompare(b.contacto.nombre))
      .map(membresiaDe);
  },

  async clientes() {
    await espera(200);
    const e = await estado();
    exigirAdmin(e);
    const mapa = new Map<string, ClienteAdmin>();
    for (const u of e.usuarios.filter((x) => x.rol === 'customer')) {
      mapa.set(u.email, { email: u.email, nombre: u.nombre, telefono: u.telefono, tieneCuenta: true, reservas: 0, pagado: 0, ultima: null, demo: u.demo });
    }
    for (const r of e.reservas.filter((x) => x.estado !== 'expirada')) {
      const k = r.contacto.email.toLowerCase();
      const c = mapa.get(k) ?? { email: k, nombre: r.contacto.nombre, telefono: r.contacto.telefono, tieneCuenta: false, reservas: 0, pagado: 0, ultima: null, demo: r.demo };
      c.reservas += 1;
      if (r.pago === 'pagado') c.pagado += r.total;
      if (!c.ultima || r.creadaEn > c.ultima) c.ultima = r.creadaEn;
      mapa.set(k, c);
    }
    return [...mapa.values()].sort((a, b) => (b.ultima ?? '').localeCompare(a.ultima ?? ''));
  },

  async pagos() {
    await espera(200);
    const e = await estado();
    exigirAdmin(e);
    return [...e.pagos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  },

  async avisos(reservaId) {
    await espera(150);
    const e = await estado();
    exigirAdmin(e);
    return e.avisos.filter((a) => !reservaId || a.reservaId === reservaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  },
};
