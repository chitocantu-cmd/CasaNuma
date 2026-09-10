// ===========================================================================
// Asigna una contraseña temporal a un administrador
// ---------------------------------------------------------------------------
//   node dev/poner-password.mjs correo@ejemplo.com
//
// La contraseña se genera al azar y se escribe en dev/acceso-admin.txt, que
// está en .gitignore. NUNCA se imprime en pantalla ni viaja por ningún lado:
// así no queda registrada en una conversación ni en el repositorio.
//
// Es temporal. Cámbiala desde Supabase -> Authentication -> Users cuando
// entres por primera vez.
// ===========================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const SITIO = 'https://casa-numa-liart.vercel.app';

const correo = process.argv[2];
if (!correo?.includes('@')) {
  console.error('\n  Uso: node dev/poner-password.mjs tu@correo.com\n');
  process.exit(1);
}

const texto = readFileSync(join(AQUI, 'secretos.env'), 'utf8');
const KEY = texto.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m)?.[1]?.trim();
if (!KEY || KEY.endsWith('...')) {
  console.error('\n  Falta SUPABASE_SERVICE_ROLE_KEY en dev/secretos.env\n');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// Contraseña legible pero fuerte: 4 bloques de 4 caracteres sin ambigüedades.
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const bloque = () => Array.from(randomBytes(4))
  .map((b) => ALFABETO[b % ALFABETO.length]).join('');
const password = [bloque(), bloque(), bloque(), bloque()].join('-');

const lista = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: H })
  .then((r) => r.json());
const usuario = (lista.users ?? []).find(
  (u) => (u.email ?? '').toLowerCase() === correo.toLowerCase());

if (!usuario) {
  console.error(`\n  No existe un usuario con el correo ${correo}\n`);
  process.exit(1);
}

const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${usuario.id}`, {
  method: 'PUT',
  headers: H,
  body: JSON.stringify({ password, email_confirm: true }),
});

if (!r.ok) {
  console.error(`\n  Falló (${r.status}): ${(await r.text()).slice(0, 200)}\n`);
  process.exit(1);
}

const destino = join(AQUI, 'acceso-admin.txt');
writeFileSync(destino, `Casa Numa - acceso al panel
============================

  ${SITIO}/admin/login

  Correo:     ${correo}
  Contraseña: ${password}

Esta contraseña es TEMPORAL y se genero al azar.
Cambiala en Supabase -> Authentication -> Users -> (tu usuario) -> Reset password.

Este archivo esta en .gitignore: no se sube al repositorio.
Borralo cuando ya te la sepas.
`, 'utf8');

console.log(`
  Contraseña asignada a ${correo}

  La escribí en:  dev/acceso-admin.txt
  (no la imprimo aquí para que no quede en la conversación)

  Ábrelo, entra en ${SITIO}/admin/login, y cámbiala cuando puedas.
`);
