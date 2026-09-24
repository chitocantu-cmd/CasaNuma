// ===========================================================================
// Carga la agenda real a Supabase
// ---------------------------------------------------------------------------
//   node dev/cargar-agenda.mjs              muestra lo que haría (no escribe)
//   node dev/cargar-agenda.mjs --aplicar    lo escribe en la base
//
// Fuentes (las mismas que usa el sitio, nada se escribe a mano aquí):
//   · src/datos/agenda.ts      talleres con fecha, horarios y precio
//
// La agenda es la única fuente de fechas: talleres, NUMA Kids (Tardes de
// Cerámica · Niños) y clases de membresía (Clases de Cerámica). Un horario
// que Casa Numa no publicó no se ofrece.
//
// Qué hace:
//   1. Crea o actualiza cada taller de la agenda en `workshops` (por slug).
//   2. Agrega a `workshop_sessions` los horarios que falten.
//   3. Llena precio u hora de cierre de horarios que los tenían vacíos.
//   4. Cierra (status 'closed') los horarios abiertos que ya no están
//      publicados, salvo que tengan reservas vivas.
//   5. Oculta los talleres de ejemplo (status 'draft'). No borra nada.
//
// Lo que Casa Numa no ha publicado queda en NULL. Nunca se rellena, y el
// cupo no se toca nunca (lo captura el equipo en el panel).
//
// Se puede correr las veces que sea: la segunda vez no cambia nada.
//
// Requiere la migración 20260924100200_catalogo_agenda.sql.
// ===========================================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const APLICAR = process.argv.includes('--aplicar');
const ZONA = 'America/Monterrey';

const { AGENDA, flujoAgenda } = await import('../src/datos/agenda.ts');

// --- Llave y REST ------------------------------------------------------------
function secreto(nombre) {
  const texto = readFileSync(join(AQUI, 'secretos.env'), 'utf8');
  const v = texto.match(new RegExp(`^${nombre}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!v || v.endsWith('...')) {
    console.error(`\n  Falta ${nombre} en dev/secretos.env\n`);
    process.exit(1);
  }
  return v;
}
const KEY = secreto('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(ruta, init = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...init, headers: { ...H, ...init.headers } });
  const t = await r.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; } catch { /* texto plano */ }
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${ruta.split('?')[0]} → HTTP ${r.status}: ${t.slice(0, 300)}`);
  return data;
}

// --- Fechas (en la zona de Casa Numa, no en la de esta computadora) ----------
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
const hhmm = (t) => (t ?? '').slice(0, 5);

// --- Lo que ya hay -------------------------------------------------------------
// process.exitCode en vez de process.exit(): en Windows, salir de golpe con
// fetch abierto hace que Node imprima un "Assertion failed" que asusta.
const tieneMigracion = await rest('workshops?select=image_key&limit=1').then(() => true, () => false);
if (!tieneMigracion) {
  console.error('\n  Falta la migración 20260924100200_catalogo_agenda.sql.');
  console.error('  Pégala en Supabase → SQL Editor → Run, y vuelve a correr esto.\n');
  process.exitCode = 1;
} else {
  await cargar();
}

async function cargar() {
  const talleresBase = await rest('workshops?select=id,slug,status');
  const sesionesBase = await rest('workshop_sessions?select=id,experience_type,workshop_id,date,start_time,end_time,price,status');
  const partidas = await rest('reservation_items?select=session_id,reservations(status,expires_at)');
  const reservasBase = await rest('reservations?select=workshop_id');

  const slugPorId = Object.fromEntries(talleresBase.map((w) => [w.id, w.slug]));
  const idPorSlug = Object.fromEntries(talleresBase.map((w) => [w.slug, w.id]));
  const clave = (tipo, slug, fecha, inicio) => `${tipo}|${slug ?? ''}|${fecha}|${hhmm(inicio)}`;
  const existentes = new Map(
    sesionesBase.map((s) => [clave(s.experience_type, slugPorId[s.workshop_id], s.date, s.start_time), s]),
  );
  // Una sesión con reservas vivas no se cierra nunca desde aquí.
  const ahora = Date.now();
  const conReservasVivas = new Set(
    partidas
      .filter(({ reservations: r }) => r && (['confirmed', 'completed'].includes(r.status)
        || (r.status === 'pending_payment' && Date.parse(r.expires_at) > ahora)))
      .map((p) => p.session_id),
  );

  // --- 1. Talleres de la agenda (catálogo) --------------------------------------
  const filasTaller = AGENDA.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    short_description: a.description[0] ?? null,
    description: a.description,
    date: a.date,
    start_time: a.sessions[0].start_time,
    end_time: a.sessions[0].end_time,
    timezone: ZONA,
    price: a.price ?? 0,
    currency: 'MXN',
    capacity: null,
    label: a.label,
    price_label: a.price_label,
    age_min: a.age_min,
    age_max: a.age_max,
    image_key: a.image,
    // Llaves de src/contenido/fotos.ts (hasta que las fotos vivan en Cloudinary).
    gallery: a.gallery,
    includes: a.includes,
    is_featured: a.is_featured,
    status: a.is_active ? 'published' : 'draft',
    booking_mode: a.booking_type !== 'inquiry' && a.price ? 'paid' : 'quote',
  }));

  // --- 2. Horarios publicados ------------------------------------------------------
  // Talleres: sesión 'taller' ligada a su fila. Tardes de Cerámica (Niños) y
  // Clases de Cerámica son sesiones de NUMA Kids y de membresía: van sin
  // taller ligado (así lo pide la tabla) y se reconocen por fecha y hora.
  const deseadas = [];
  for (const a of AGENDA.filter((x) => x.is_active)) {
    const flujo = flujoAgenda(a);
    const tipo = flujo === 'kids' ? 'kids' : flujo === 'membresia' ? 'membresia' : 'taller';
    for (const s of a.sessions) {
      deseadas.push({
        slug: tipo === 'taller' ? a.slug : null,
        fila: {
          experience_type: tipo, date: a.date, start_time: s.start_time, end_time: s.end_time,
          timezone: ZONA, capacity: s.capacity, price: tipo === 'membresia' ? null : a.price,
          currency: 'MXN', status: 'open',
        },
      });
    }
  }
  const clavesDeseadas = new Set(deseadas.map((d) => clave(d.fila.experience_type, d.slug, d.fila.date, d.fila.start_time)));

  const nuevas = deseadas.filter((d) => !existentes.has(clave(d.fila.experience_type, d.slug, d.fila.date, d.fila.start_time)));

  // Datos que estaban vacíos y la agenda ya publica (precio, hora de cierre).
  // Nunca se toca un valor que ya exista: lo pudo haber puesto el equipo.
  const rellenar = [];
  for (const d of deseadas) {
    const e = existentes.get(clave(d.fila.experience_type, d.slug, d.fila.date, d.fila.start_time));
    if (!e) continue;
    const cambios = {};
    if (e.price === null && d.fila.price !== null) cambios.price = d.fila.price;
    if (e.end_time === null && d.fila.end_time !== null) cambios.end_time = d.fila.end_time;
    if (Object.keys(cambios).length) rellenar.push({ id: e.id, cambios, d });
  }

  // Horarios abiertos que ya no están publicados.
  const sobrantes = sesionesBase.filter(
    (s) => s.status === 'open' && !clavesDeseadas.has(clave(s.experience_type, slugPorId[s.workshop_id], s.date, s.start_time)),
  );
  const cerrar = sobrantes.filter((s) => !conReservasVivas.has(s.id));
  const intocables = sobrantes.filter((s) => conReservasVivas.has(s.id));

  // --- 3. Talleres fuera de la agenda (ejemplos) --------------------------------
  const slugsAgenda = new Set(AGENDA.map((a) => a.slug));
  const conReservas = new Set(reservasBase.map((r) => r.workshop_id));
  const ejemplos = talleresBase.filter((w) => !slugsAgenda.has(w.slug) && w.status !== 'draft');
  const ocultar = ejemplos.filter((w) => !conReservas.has(w.id));
  const noSeTocan = ejemplos.filter((w) => conReservas.has(w.id));

  // --- Resumen ---------------------------------------------------------------------
  const describe = (tipo, slug, fecha, inicio) =>
    `${fecha} ${hhmm(inicio)}  ${tipo === 'taller' ? slug : tipo === 'kids' ? 'NUMA Kids' : 'Membresía'}`;
  const cuenta = (lista, tipo) => lista.filter((x) => (x.fila ?? x).experience_type === tipo).length;

  console.log(`\n  Carga de agenda · hoy ${hoy} (${ZONA})`);
  console.log('  ' + '-'.repeat(64));
  console.log(`  Talleres de la agenda        ${filasTaller.length}  (${filasTaller.filter((f) => idPorSlug[f.slug]).length} ya existían: se actualizan)`);
  console.log(`  Horarios publicados          ${deseadas.length}  (talleres ${cuenta(deseadas, 'taller')} · NUMA Kids ${cuenta(deseadas, 'kids')} · membresía ${cuenta(deseadas, 'membresia')})`);
  console.log(`  Horarios nuevos              ${nuevas.length}`);
  for (const d of nuevas) console.log(`    + ${describe(d.fila.experience_type, d.slug, d.fila.date, d.fila.start_time)}${d.fila.price ? `  $${d.fila.price}` : ''}`);
  console.log(`  Datos vacíos que se llenan   ${rellenar.length}`);
  for (const r of rellenar) console.log(`    ~ ${describe(r.d.fila.experience_type, r.d.slug, r.d.fila.date, r.d.fila.start_time)}  ${JSON.stringify(r.cambios)}`);
  console.log(`  Horarios que se cierran      ${cerrar.length}  (ya no están publicados; no se borran)`);
  for (const s of cerrar) console.log(`    - ${describe(s.experience_type, slugPorId[s.workshop_id], s.date, s.start_time)}`);
  if (intocables.length) {
    console.log(`  OJO: ${intocables.length} horarios ya no publicados tienen reservas y NO se cierran:`);
    for (const s of intocables) console.log(`    ! ${describe(s.experience_type, slugPorId[s.workshop_id], s.date, s.start_time)}`);
  }
  console.log(`  Cupo                         no se toca (sin confirmar → "Cupo limitado")`);
  console.log(`  Talleres de ejemplo          ${ocultar.length} se ocultan${ocultar.length ? ': ' + ocultar.map((w) => w.slug).join(', ') : ''}`);
  if (noSeTocan.length) {
    console.log(`  OJO: ${noSeTocan.length} talleres fuera de la agenda tienen reservas y NO se tocan: ${noSeTocan.map((w) => w.slug).join(', ')}`);
  }

  if (!APLICAR) {
    console.log('\n  Solo simulación: no se escribió nada.');
    console.log('  Para escribirlo:  node dev/cargar-agenda.mjs --aplicar\n');
    return;
  }

  console.log('\n  Escribiendo…');

  const talleres = await rest('workshops?on_conflict=slug', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(filasTaller),
  });
  for (const w of talleres) idPorSlug[w.slug] = w.id;
  console.log(`    talleres                   ${talleres.length} OK`);

  if (nuevas.length) {
    const filas = nuevas.map(({ slug, fila }) => ({ ...fila, workshop_id: slug ? idPorSlug[slug] : null }));
    const creadas = await rest('workshop_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(filas),
    });
    console.log(`    horarios nuevos            ${creadas.length} OK`);
  }

  for (const r of rellenar) {
    await rest(`workshop_sessions?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify(r.cambios) });
  }
  if (rellenar.length) console.log(`    datos llenados             ${rellenar.length} OK`);

  if (cerrar.length) {
    await rest(`workshop_sessions?id=in.(${cerrar.map((s) => s.id).join(',')})`, {
      method: 'PATCH', body: JSON.stringify({ status: 'closed' }),
    });
    console.log(`    horarios cerrados          ${cerrar.length} OK`);
  }

  if (ocultar.length) {
    const ids = ocultar.map((w) => w.id).join(',');
    await rest(`workshop_sessions?workshop_id=in.(${ids})`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
    await rest(`workshops?id=in.(${ids})`, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) });
    console.log(`    ejemplos ocultos           ${ocultar.length} OK`);
  }

  console.log('\n  Listo. Revisa con:  node dev/admin-db.mjs estado\n');
}
