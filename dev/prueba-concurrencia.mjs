// ===========================================================================
// TEST C · Concurrencia real
// ---------------------------------------------------------------------------
// La prueba que de verdad importa: varias personas peleando por el ÚLTIMO
// lugar, al mismo tiempo, contra el PostgreSQL de producción y a través de la
// Edge Function real.
//
// Es la única que PGlite no podía correr: usa una sola conexión, así que
// verificaba el conteo pero no el bloqueo `select ... for update`.
//
//   node dev/prueba-concurrencia.mjs [rondas]
// ===========================================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const PUBLICA = 'sb_publishable_YHNS0lzUGRa9SUF1S6NR2g_mdEbYB4O';
const SLUG = 'taller-libre-noviembre';   // el que no tiene ocupación de demo
const ATACANTES = 6;                      // peticiones simultáneas por ronda
const RONDAS = Number(process.argv[2] ?? 8);

const KEY = readFileSync(join(AQUI, 'secretos.env'), 'utf8')
  .match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m)?.[1]?.trim();
if (!KEY || KEY.endsWith('...')) {
  console.error('\n  Falta SUPABASE_SERVICE_ROLE_KEY en dev/secretos.env\n');
  process.exit(1);
}
const ADMIN = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const rest = (ruta, init = {}) =>
  fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...init, headers: { ...ADMIN, ...init.headers } });

// PostgREST a veces responde HTML en un error; nunca reventar por eso.
const jsonSeguro = async (r) => {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};

// El limitador por IP (10 intentos / 10 min) bloquearia las rondas siguientes
// y la prueba dejaria de medir concurrencia. Se vacia entre rondas para que
// cada una arranque limpia. En produccion real el limitador sigue activo.
async function limpiarLimite() {
  await rest('rate_limit?clave=not.is.null', { method: 'DELETE' });
}

async function limpiar() {
  const cs = await rest('customers?select=id&email=like.carrera*').then(jsonSeguro);
  if (cs?.length) {
    const ids = cs.map((c) => c.id).join(',');
    await rest(`reservations?customer_id=in.(${ids})`, { method: 'DELETE' });
    await rest(`customers?id=in.(${ids})`, { method: 'DELETE' });
  }
}

async function disponibles() {
  const j = await rest(`public_workshops?select=seats_available&slug=eq.${SLUG}`).then(jsonSeguro);
  return j?.[0]?.seats_available ?? 0;
}

/** Deja el taller con exactamente `n` lugares libres. */
async function dejarEn(n) {
  const [w] = (await rest(`workshops?select=id,capacity&slug=eq.${SLUG}`).then(jsonSeguro)) ?? [];
  const libres = await disponibles();
  const ocupados = w.capacity - libres;
  await rest(`workshops?id=eq.${w.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ capacity: ocupados + n }),
  });
}

console.log(`\n  TEST C · ${ATACANTES} peticiones simultáneas por el ÚLTIMO lugar`);
console.log(`  ${RONDAS} rondas contra el PostgreSQL de producción\n`);

await limpiar();

let ganadoresTotales = 0;
let fallos = 0;

for (let ronda = 1; ronda <= RONDAS; ronda++) {
  await limpiar();
  await limpiarLimite();
  await dejarEn(1);

  const antes = await disponibles();
  if (antes !== 1) {
    console.log(`  ronda ${ronda}: no se pudo dejar en 1 (quedó en ${antes}), se salta`);
    continue;
  }

  // Se preparan TODAS las peticiones y se sueltan juntas con Promise.all.
  const disparos = Array.from({ length: ATACANTES }, (_, i) =>
    fetch(`${URL_BASE}/functions/v1/create-reservation`, {
      method: 'POST',
      headers: {
        apikey: PUBLICA,
        Authorization: `Bearer ${PUBLICA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: SLUG,
        quantity: 1,
        full_name: `Carrera ${i}`,
        email: `carrera${i}-r${ronda}@ejemplo.com`,
        phone: `81100000${String(i).padStart(2, '0')}`,
      }),
    }).then(async (r) => ({ code: r.status, body: await r.json().catch(() => ({})) })),
  );

  const res = await Promise.all(disparos);

  const ganadores = res.filter((r) => r.code === 200 && r.body.reservation_code);
  const rechazados = res.filter((r) => r.body.error === 'INSUFFICIENT_CAPACITY');
  const otros = res.filter((r) => r.code !== 200 && r.body.error !== 'INSUFFICIENT_CAPACITY');

  // La verdad la dice la base, no las respuestas.
  const despues = await disponibles();
  const sobrevendido = despues < 0;

  const ok = ganadores.length === 1 && despues === 0 && !sobrevendido;
  if (!ok) fallos++;
  ganadoresTotales += ganadores.length;

  console.log(
    `  ronda ${String(ronda).padStart(2)}  ` +
    `ganadores: ${ganadores.length}  ` +
    `rechazados: ${String(rechazados.length).padStart(2)}  ` +
    `otros: ${otros.length}  ` +
    `libres despues: ${String(despues).padStart(2)}  ` +
    (ok ? 'OK' : '*** FALLA ***'),
  );

  if (otros.length) {
    console.log('      respuestas raras:', JSON.stringify(otros.slice(0, 2)).slice(0, 180));
  }
}

await limpiar();
// Se restaura la capacidad original del taller.
await rest(`workshops?slug=eq.${SLUG}`, {
  method: 'PATCH', body: JSON.stringify({ capacity: 8 }),
});

console.log('\n  ' + '-'.repeat(56));
if (fallos === 0) {
  console.log(`  ${RONDAS} rondas · ${ATACANTES * RONDAS} peticiones simultáneas`);
  console.log(`  Exactamente 1 ganador por ronda. CERO sobreventa.\n`);
} else {
  console.log(`  ${fallos} de ${RONDAS} rondas FALLARON — hay sobreventa posible.\n`);
  process.exit(1);
}
