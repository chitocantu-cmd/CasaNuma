// ===========================================================================
// Crea un administrador de Casa Numa
// ---------------------------------------------------------------------------
//   node dev/crear-admin.mjs correo@ejemplo.com
//
// Hace tres cosas:
//   1. Crea el usuario en Supabase Auth (confirmado, sin contraseña conocida)
//   2. Lo registra en admin_profiles
//   3. Devuelve un enlace para que la persona ponga SU propia contraseña
//
// La contraseña nunca pasa por aquí ni queda escrita en ningún lado: se genera
// una aleatoria que nadie ve, y el enlace de recuperación deja que su dueña la
// reemplace. Es más seguro que inventarle una y mandársela.
// ===========================================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const SITIO = 'https://casa-numa-liart.vercel.app';

const correo = process.argv[2];
if (!correo || !correo.includes('@')) {
  console.error('\n  Uso: node dev/crear-admin.mjs tu@correo.com\n');
  process.exit(1);
}

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

console.log(`\n  Creando administrador: ${correo}\n`);

// --- 1. ¿Ya existe? --------------------------------------------------------
const lista = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: H })
  .then((r) => r.json());
let usuario = (lista.users ?? []).find(
  (u) => (u.email ?? '').toLowerCase() === correo.toLowerCase());

if (usuario) {
  console.log('    usuario            ya existía');
} else {
  // Contraseña aleatoria que nadie conoce: se reemplaza con el enlace de abajo.
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      email: correo,
      password: randomBytes(32).toString('base64url'),
      email_confirm: true,
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    console.error(`\n  No se pudo crear (${r.status}): ${JSON.stringify(j).slice(0, 200)}\n`);
    process.exit(1);
  }
  usuario = j;
  console.log('    usuario            creado');
}

// --- 2. Registrarlo como admin --------------------------------------------
const perfil = await fetch(`${URL_BASE}/rest/v1/admin_profiles`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({
    user_id: usuario.id,
    name: correo.split('@')[0],
    role: 'admin',
  }),
});

if (!perfil.ok) {
  const t = await perfil.text();
  console.error(`\n  No se pudo registrar en admin_profiles (${perfil.status}): ${t.slice(0, 200)}\n`);
  process.exit(1);
}
console.log('    admin_profiles     registrado');

// --- 3. Enlace para poner contraseña ---------------------------------------
const enlace = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    type: 'recovery',
    email: correo,
    options: { redirect_to: `${SITIO}/admin/login` },
  }),
}).then((r) => r.json());

const url = enlace?.action_link ?? enlace?.properties?.action_link;

console.log('\n  ' + '-'.repeat(58));
if (url) {
  console.log('\n  Abre este enlace para poner tu contraseña:\n');
  console.log('  ' + url + '\n');
  console.log('  (de un solo uso, caduca en una hora)');
} else {
  console.log('\n  El usuario ya es admin, pero no se pudo generar el enlace.');
  console.log('  Ponle contraseña desde Supabase -> Authentication -> Users.');
  console.log('  Respuesta:', JSON.stringify(enlace).slice(0, 200));
}
console.log(`\n  Después entra en: ${SITIO}/admin/login\n`);
