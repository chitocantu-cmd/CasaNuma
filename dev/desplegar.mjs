// ===========================================================================
// Despliegue de Edge Functions a Supabase
// ---------------------------------------------------------------------------
// Un solo comando en vez de ocho. Verifica lo que hace falta antes de intentar
// nada, para no fallar a la mitad.
//
//   node dev/desplegar.mjs
//
// REQUISITOS (una vez):
//   1. npx supabase login          <- abre el navegador
//   2. dev/secretos.env con los valores llenos
// ===========================================================================

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const PROJECT_REF = 'xjerknpiyokzzcihwkpg';
const SECRETOS = join(AQUI, 'secretos.env');

const FUNCIONES = [
  'create-reservation',
  'create-checkout-session',
  'stripe-webhook',
  'reservation-status',
  'submit-form',
  'process-jobs',
  'admin-actions',
  'cloudinary-sign',
];

// Las que no pueden funcionar sin cierta variable. Se avisa, no se bloquea:
// desplegarlas sin su secreto es válido, solo fallan al invocarse.
const REQUISITOS = {
  'create-checkout-session': ['STRIPE_SECRET_KEY'],
  'stripe-webhook': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  'process-jobs': ['RESEND_API_KEY', 'CRON_SECRET'],
  'cloudinary-sign': ['CLOUDINARY_API_SECRET'],
};

const sh = (cmd, silencioso = false) =>
  execSync(cmd, { cwd: RAIZ, stdio: silencioso ? 'pipe' : 'inherit', encoding: 'utf8' });

console.log('\nDespliegue de Casa Numa\n' + '='.repeat(58));

// --- 1. ¿Hay sesión? -------------------------------------------------------
try {
  sh('npx supabase projects list', true);
} catch {
  console.error(`
  No hay sesión con Supabase.

  Corre primero:   npx supabase login

  Se abre el navegador, autorizas, y vuelves a correr este script.
`);
  process.exit(1);
}
console.log('  Sesión de Supabase: OK');

// --- 2. Secretos -----------------------------------------------------------
let definidos = new Set();
if (existsSync(SECRETOS)) {
  const texto = readFileSync(SECRETOS, 'utf8');
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    // Se ignoran los que siguen con el valor de ejemplo.
    if (m && !/^(\.\.\.|sk_test_\.\.\.|re_\.\.\.|cambia|TU_|xxx)/i.test(m[2].trim())) {
      definidos.add(m[1]);
    }
  }
  console.log(`  Secretos con valor real: ${definidos.size}`);
  try {
    sh(`npx supabase secrets set --env-file "${SECRETOS}" --project-ref ${PROJECT_REF}`, true);
    console.log('  Secretos cargados a Supabase: OK');
  } catch (e) {
    console.error('  No se pudieron cargar los secretos:', e.message.slice(0, 200));
  }
} else {
  console.log(`
  AVISO: no existe dev/secretos.env

  Las funciones se van a desplegar, pero las que necesitan credenciales
  van a fallar al invocarse. Copia dev/secretos.env.example y llénalo.
`);
}

// --- 3. Desplegar ----------------------------------------------------------
console.log('\n  Desplegando funciones…\n');
const fallidas = [];

for (const f of FUNCIONES) {
  const faltan = (REQUISITOS[f] ?? []).filter((v) => !definidos.has(v));
  const nota = faltan.length ? `  (sin ${faltan.join(', ')} — se despliega pero no operará)` : '';
  process.stdout.write(`    ${f}${nota}\n`);
  try {
    sh(`npx supabase functions deploy ${f} --project-ref ${PROJECT_REF}`, true);
  } catch (e) {
    fallidas.push(f);
    console.error(`      FALLÓ: ${String(e.message).slice(0, 180)}`);
  }
}

console.log('\n' + '='.repeat(58));
if (fallidas.length) {
  console.log(`  ${FUNCIONES.length - fallidas.length} desplegadas, ${fallidas.length} fallaron:`);
  fallidas.forEach((f) => console.log(`    · ${f}`));
  process.exit(1);
}
console.log(`  Las ${FUNCIONES.length} funciones quedaron desplegadas.`);
console.log(`
  Verifica con:   node dev/verificar.mjs
`);
