// ===========================================================================
// Repositorio de demostración
// ---------------------------------------------------------------------------
// Simula el backend completo dentro del navegador (localStorage), con las
// mismas reglas que tendrá el real:
//   · el precio sale del catálogo, nunca de lo que manda la página;
//   · no se aparta una sesión llena ni una que ya pasó;
//   · membresía = exactamente 4 sesiones del mismo mes;
//   · NUMA Kids = a partir de 7 años;
//   · un apartado sin pagar se libera solo a los 15 minutos.
// Los pagos son FALSOS: nadie cobra nada.
// ===========================================================================

import { KIDS, MEMBRESIA } from '../../contenido/oferta';
import { claveMes, etiquetaMes, hoy, sumarDias, yaPaso } from '../../lib/calendario';
import { correoValido, soloDigitos } from '../../lib/formato';
import { ErrorDatos, type Repositorio } from '../repositorio';
import type {
  MesMembresia, Registro, Reserva, Sesion, SesionReservada, SolicitudReserva, Taller, Usuario,
} from '../tipos';
import {
  PRODUCTOS_SEMILLA, mesesMembresiaSemilla, ocupacionInicial, sesionesKidsSemilla,
  sesionesMembresiaDelMes, talleresSemilla,
} from './semilla';

const CLAVE = 'numa:demo:v1';
const MINUTOS_APARTADO = 15;
const MAX_PERSONAS_TALLER = 6;
const MAX_NINOS = 4;

interface UsuarioGuardado extends Usuario {
  hash: string;
}

interface Estado {
  usuarios: UsuarioGuardado[];
  sesionUsuarioId: string | null;
  reservas: Reserva[];
  suscriptores: string[];
}

// --- Almacenamiento ---------------------------------------------------------
// localStorage puede no existir (modo privado estricto): entonces la demo
// funciona en memoria y se pierde al recargar, pero no truena.

let memoria: Estado | null = null;

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
  memoria = { usuarios: [], sesionUsuarioId: null, reservas: [], suscriptores: [] };
  return memoria;
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

function codigo() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'NUMA-' + Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
}

function publico(u: UsuarioGuardado): Usuario {
  const { hash: _hash, ...resto } = u;
  void _hash;
  return resto;
}

// --- Cupo ---------------------------------------------------------------------

/** Apartados vencidos pasan a 'expirada' en cuanto alguien lee el estado. */
function vencerApartados(e: Estado): Estado {
  const ahora = Date.now();
  let cambio = false;
  const reservas = e.reservas.map((r) => {
    if (r.estado === 'pendiente_pago' && r.expiraEn && new Date(r.expiraEn).getTime() <= ahora) {
      cambio = true;
      return { ...r, estado: 'expirada' as const };
    }
    return r;
  });
  if (!cambio) return e;
  const nuevo = { ...e, reservas };
  guardar(nuevo);
  return nuevo;
}

function ocupadosPorReservas(e: Estado, sesionId: string): number {
  return e.reservas
    .filter((r) => r.estado === 'confirmada' || r.estado === 'pendiente_pago')
    .filter((r) => r.sesiones.some((s) => s.id === sesionId))
    .reduce((n, r) => n + r.participantes, 0);
}

function conDisponibles(e: Estado, s: Sesion): Sesion {
  const ocupados = ocupacionInicial(s.id, s.cupo) + ocupadosPorReservas(e, s.id);
  const disponibles = yaPaso(s.fecha, s.inicio) ? 0 : Math.max(0, s.cupo - ocupados);
  return { ...s, disponibles };
}

// --- Catálogo con cupo calculado ----------------------------------------------

function catalogoTalleres(e: Estado): Taller[] {
  return talleresSemilla().map((t) => ({ ...t, sesiones: t.sesiones.map((s) => conDisponibles(e, s)) }));
}

function catalogoMeses(e: Estado): MesMembresia[] {
  return mesesMembresiaSemilla().map((m) => ({
    ...m,
    sesiones: m.sesiones.map((s) => conDisponibles(e, s)),
  }));
}

function catalogoKids(e: Estado): Sesion[] {
  return sesionesKidsSemilla().map((s) => conDisponibles(e, s));
}

// --- Cuenta demo precargada -----------------------------------------------------
// Para que "Mi cuenta" se pueda recorrer sin reservar primero: una alumna con
// su membresía a la mitad (2 de 4 clases) y un taller en el historial.

export const CUENTA_DEMO = { email: 'ana@demo.casanuma.mx', password: 'numa2026' };

async function asegurarCuentaDemo(e: Estado): Promise<Estado> {
  if (e.usuarios.some((u) => u.email === CUENTA_DEMO.email)) return e;

  const usuario: UsuarioGuardado = {
    id: 'usr_demo',
    nombre: 'Ana López',
    email: CUENTA_DEMO.email,
    telefono: '8100000000',
    creadoEn: new Date().toISOString(),
    hash: await hashPassword(CUENTA_DEMO.email, CUENTA_DEMO.password),
  };

  // Dos clases recientes y dos próximas.
  const hoyIso = hoy();
  const cercanas = [
    ...sesionesMembresiaDelMes(claveMes(sumarDias(hoyIso, -21))),
    ...sesionesMembresiaDelMes(claveMes(hoyIso)),
    ...sesionesMembresiaDelMes(claveMes(sumarDias(hoyIso, 21))),
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  const pasadas = cercanas.filter((s) => yaPaso(s.fecha, s.inicio)).slice(-2);
  const futuras = cercanas.filter((s) => !yaPaso(s.fecha, s.inicio) && s.fecha > sumarDias(hoyIso, 1)).slice(0, 2);
  const elegidas: SesionReservada[] = [...pasadas, ...futuras].map(({ id: sid, fecha, inicio, fin }) => ({
    id: sid, fecha, inicio, fin,
  }));
  const mes = claveMes(elegidas[0]?.fecha ?? hoyIso);
  const contacto = { nombre: usuario.nombre, email: usuario.email, telefono: usuario.telefono };

  const membresia: Reserva = {
    id: 'res_demo_mem', codigo: 'NUMA-DEMO01', tipo: 'membresia',
    titulo: `Membresía ${etiquetaMes(mes).split(' ')[0]}`, referencia: mes,
    sesiones: elegidas, participantes: 1, precioUnitario: MEMBRESIA.precio, total: MEMBRESIA.precio,
    estado: 'confirmada', pago: 'pagado', expiraEn: null,
    creadaEn: new Date(Date.now() - 20 * 864e5).toISOString(), usuarioId: usuario.id, contacto, demo: true,
  };

  const pasado = sumarDias(hoyIso, -38);
  const historial: Reserva = {
    id: 'res_demo_hist', codigo: 'NUMA-DEMO02', tipo: 'taller',
    titulo: 'Cerámica libre', referencia: 'ceramica-libre',
    sesiones: [{ id: `lib-${pasado}-1100`, fecha: pasado, inicio: '11:00', fin: '13:30' }],
    participantes: 2, precioUnitario: 600, total: 1200,
    estado: 'confirmada', pago: 'pagado', expiraEn: null,
    creadaEn: new Date(Date.now() - 45 * 864e5).toISOString(), usuarioId: usuario.id, contacto, demo: true,
  };

  const nuevo = { ...e, usuarios: [...e.usuarios, usuario], reservas: [...e.reservas, membresia, historial] };
  guardar(nuevo);
  return nuevo;
}

async function estado(): Promise<Estado> {
  return vencerApartados(await asegurarCuentaDemo(leer()));
}

function usuarioEnSesion(e: Estado): UsuarioGuardado {
  const u = e.usuarios.find((x) => x.id === e.sesionUsuarioId);
  if (!u) throw new ErrorDatos('SIN_SESION', 'Inicia sesión o crea tu cuenta para continuar.');
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
    if (sesiones.some((x) => !x)) {
      throw new ErrorDatos('SESION_INVALIDA', `Todas tus clases deben ser de ${mes.etiqueta}.`);
    }
    return {
      titulo: `Membresía ${mes.etiqueta.split(' ')[0]}`,
      precioUnitario: MEMBRESIA.precio,
      sesiones: sesiones as Sesion[],
    };
  }

  // kids
  const ninos = s.ninos ?? [];
  if (ninos.length !== s.participantes) throw new ErrorDatos('DATOS_INVALIDOS', 'Faltan datos de algún niño o niña.');
  if (ninos.length > MAX_NINOS) {
    throw new ErrorDatos('DATOS_INVALIDOS', `Puedes inscribir hasta ${MAX_NINOS} niños por reserva.`);
  }
  if (ninos.some((n) => !n.nombre.trim())) throw new ErrorDatos('DATOS_INVALIDOS', 'Escribe el nombre de cada niño o niña.');
  if (ninos.some((n) => !Number.isFinite(n.edad) || n.edad < KIDS.edadMinima)) {
    throw new ErrorDatos('EDAD_MINIMA', `NUMA Kids es para niñas y niños a partir de ${KIDS.edadMinima} años.`);
  }
  if (unicos.length !== 1) throw new ErrorDatos('SESION_INVALIDA', 'Elige un jueves.');
  const sesion = catalogoKids(e).find((x) => x.id === unicos[0]);
  if (!sesion) throw new ErrorDatos('SESION_INVALIDA', 'Esa fecha ya no está disponible.');
  return { titulo: 'NUMA Kids', precioUnitario: KIDS.precio, sesiones: [sesion] };
}

// --- Implementación -----------------------------------------------------------

export const repoDemo: Repositorio = {
  async talleres() {
    await espera(260);
    const e = await estado();
    return catalogoTalleres(e);
  },

  async taller(slug) {
    await espera(200);
    const e = await estado();
    return catalogoTalleres(e).find((t) => t.slug === slug) ?? null;
  },

  async mesesMembresia() {
    await espera(260);
    const e = await estado();
    return catalogoMeses(e);
  },

  async sesionesKids() {
    await espera(240);
    const e = await estado();
    return catalogoKids(e);
  },

  async productos() {
    await espera(200);
    return PRODUCTOS_SEMILLA;
  },

  async producto(slug) {
    await espera(150);
    return PRODUCTOS_SEMILLA.find((p) => p.slug === slug) ?? null;
  },

  async apartar(solicitud) {
    await espera(500);
    const e = await estado();
    const usuario = usuarioEnSesion(e);
    const { nombre, email, telefono } = solicitud.contacto;
    if (!nombre.trim() || !correoValido(email) || soloDigitos(telefono).length < 10) {
      throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu nombre, correo y teléfono.');
    }

    // Una persona no aparta dos veces lo mismo: si regresa a cambiar sus
    // fechas, su apartado anterior de esta experiencia se libera ANTES de
    // medir el cupo (si no, su propio apartado le quitaría el último lugar).
    const sinPrevias: Estado = {
      ...e,
      reservas: e.reservas.map((x) =>
        x.usuarioId === usuario.id && x.estado === 'pendiente_pago' && x.tipo === solicitud.tipo && x.referencia === solicitud.referencia
          ? { ...x, estado: 'expirada' as const }
          : x,
      ),
    };

    const r = resolver(sinPrevias, solicitud);

    // Verificación de cupo en el mismo paso que el apartado: no hay una
    // ventana entre "sí hay lugar" y "ya lo tomé" (en el backend real, esto
    // es una transacción en crear_reserva()).
    const llenas = r.sesiones.filter((s) => s.disponibles < solicitud.participantes);
    if (llenas.length) {
      const una = llenas[0];
      throw new ErrorDatos(
        'SIN_CUPO',
        una.disponibles === 0
          ? 'Una de las fechas que elegiste acaba de llenarse. Elige otra.'
          : `Solo ${una.disponibles === 1 ? 'queda 1 lugar' : `quedan ${una.disponibles} lugares`} en ese horario.`,
        llenas.map((s) => s.id),
      );
    }

    const reserva: Reserva = {
      id: id('res'),
      codigo: codigo(),
      tipo: solicitud.tipo,
      titulo: r.titulo,
      referencia: solicitud.referencia,
      sesiones: r.sesiones
        .map(({ id: sid, fecha, inicio, fin }) => ({ id: sid, fecha, inicio, fin }))
        .sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio)),
      participantes: solicitud.participantes,
      ninos: solicitud.ninos,
      precioUnitario: r.precioUnitario,
      total: r.precioUnitario * solicitud.participantes,
      estado: 'pendiente_pago',
      pago: 'pendiente',
      expiraEn: new Date(Date.now() + MINUTOS_APARTADO * 60_000).toISOString(),
      creadaEn: new Date().toISOString(),
      usuarioId: usuario.id,
      contacto: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() },
      demo: true,
    };

    guardar({ ...sinPrevias, reservas: [...sinPrevias.reservas, reserva] });
    return reserva;
  },

  async pagar(reservaId) {
    await espera(1100);
    const e = await estado();
    const usuario = usuarioEnSesion(e);
    const r = e.reservas.find((x) => x.id === reservaId && x.usuarioId === usuario.id);
    if (!r) throw new ErrorDatos('NO_ENCONTRADO', 'No encontramos tu reserva.');
    if (r.estado === 'confirmada') return { tipo: 'confirmado', reserva: r };
    if (r.estado !== 'pendiente_pago') {
      throw new ErrorDatos('APARTADO_VENCIDO', 'Tu apartado venció antes de completar el pago. Vuelve a elegir tus fechas.');
    }
    const pagada: Reserva = { ...r, estado: 'confirmada', pago: 'pagado', expiraEn: null };
    guardar({ ...e, reservas: e.reservas.map((x) => (x.id === r.id ? pagada : x)) });
    return { tipo: 'confirmado', reserva: pagada };
  },

  async liberar(reservaId) {
    const e = leer();
    guardar({
      ...e,
      reservas: e.reservas.map((x) =>
        x.id === reservaId && x.estado === 'pendiente_pago' ? { ...x, estado: 'expirada' as const } : x,
      ),
    });
  },

  async misReservas() {
    await espera(250);
    const e = await estado();
    const u = usuarioEnSesion(e);
    return e.reservas
      .filter((r) => r.usuarioId === u.id && r.estado !== 'expirada')
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
      id: id('usr'),
      nombre: d.nombre.trim(),
      email,
      telefono: d.telefono.trim(),
      creadoEn: new Date().toISOString(),
      hash: await hashPassword(email, d.password),
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
    const e = leer();
    guardar({ ...e, sesionUsuarioId: null });
  },

  async recuperarPassword(email) {
    await espera(500);
    if (!correoValido(email)) throw new ErrorDatos('DATOS_INVALIDOS', 'Revisa tu correo, parece incompleto.');
    // En la demo no se manda correo. Se responde igual exista o no la cuenta,
    // para no revelar qué correos están registrados.
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
