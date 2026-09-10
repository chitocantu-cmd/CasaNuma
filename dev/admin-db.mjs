// ===========================================================================
// Utilidades de administración de la base
// ---------------------------------------------------------------------------
// Lee la Secret key de dev/secretos.env (nunca la imprime) y ejecuta tareas
// que no tienen interfaz todavía.
//
//   node dev/admin-db.mjs limpiar          borra los datos de prueba
//   node dev/admin-db.mjs estado           resumen de lo que hay en la base
//   node dev/admin-db.mjs admin <correo>   vuelve admin a un usuario existente
// ===========================================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';

function secreto(nombre) {
  const texto = readFileSync(join(AQUI, 'secretos.env'), 'utf8');
  const m = texto.match(new RegExp(`^${nombre}\\s*=\\s*(.+)$`, 'm'));
  const v = m?.[1]?.trim();
  if (!v || v.endsWith('...')) {
    console.error(`\n  Falta ${nombre} en dev/secretos.env\n`);
    process.exit(1);
  }
  return v;
}

const KEY = secreto('SUPABASE_SERVICE_ROLE_KEY');
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const rest = async (ruta, init = {}) => {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...init, headers: { ...H, ...init.headers } });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* texto plano */ }
  return { code: r.status, data: j, texto: t };
};

const accion = process.argv[2];

// ---------------------------------------------------------------------------
if (accion === 'estado') {
  console.log('\n  Estado de la base\n' + '  ' + '-'.repeat(46));
  for (const t of ['workshops', 'customers', 'reservations', 'payments',
                   'contact_leads', 'membership_leads', 'integration_jobs',
                   'admin_profiles']) {
    const { data } = await rest(`${t}?select=*`, { headers: { Prefer: 'count=exact' } });
    console.log(`  ${t.padEnd(20)} ${Array.isArray(data) ? data.length : '?'}`);
  }

  const { data: res } = await rest('reservations?select=reservation_code,status,quantity,created_at&order=created_at.desc&limit=8');
  if (res?.length) {
    console.log('\n  Últimas reservaciones');
    res.forEach((r) => console.log(`    ${r.reservation_code}  ${String(r.status).padEnd(16)} ${r.quantity}`));
  }
  console.log('');
}

// ---------------------------------------------------------------------------
if (accion === 'limpiar') {
  console.log('\n  Borrando datos de prueba…\n');

  // Reservas de correos de prueba
  const { data: clientes } = await rest(
    'customers?select=id,email&or=(email.like.*@ejemplo.com,email.like.*@casanuma.local)');

  if (clientes?.length) {
    const ids = clientes.map((c) => c.id);
    const filtro = `customer_id=in.(${ids.join(',')})`;

    const { data: reservas } = await rest(`reservations?select=id&${filtro}`);
    if (reservas?.length) {
      const rids = reservas.map((r) => r.id);
      const p = await rest(`payments?reservation_id=in.(${rids.join(',')})`, { method: 'DELETE' });
      console.log(`    pagos borrados          ${p.code === 204 || p.code === 200 ? 'OK' : p.code}`);
      const j = await rest(`integration_jobs?entity_id=in.(${rids.join(',')})`, { method: 'DELETE' });
      console.log(`    trabajos en cola        ${j.code === 204 || j.code === 200 ? 'OK' : j.code}`);
    }

    const r = await rest(`reservations?${filtro}`, { method: 'DELETE' });
    console.log(`    reservaciones (${reservas?.length ?? 0})       ${r.code === 204 || r.code === 200 ? 'OK' : r.code}`);

    const c = await rest(`customers?id=in.(${ids.join(',')})`, { method: 'DELETE' });
    console.log(`    clientes (${clientes.length})           ${c.code === 204 || c.code === 200 ? 'OK' : c.code}`);
  } else {
    console.log('    no había clientes de prueba');
  }

  const l = await rest('contact_leads?email=like.*@ejemplo.com', { method: 'DELETE' });
  console.log(`    mensajes de contacto    ${l.code === 204 || l.code === 200 ? 'OK' : l.code}`);
  const m = await rest('membership_leads?email=like.*@ejemplo.com', { method: 'DELETE' });
  console.log(`    prospectos membresía    ${m.code === 204 || m.code === 200 ? 'OK' : m.code}`);

  console.log('\n  Listo.\n');
}

// ---------------------------------------------------------------------------
if (accion === 'admin') {
  const correo = process.argv[3];
  if (!correo) {
    console.error('\n  Uso: node dev/admin-db.mjs admin tu@correo.com\n');
    process.exit(1);
  }

  // Busca el usuario en auth.users con la API de administración.
  const r = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=200`, { headers: H });
  const j = await r.json();
  const usuario = (j.users ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === correo.toLowerCase());

  if (!usuario) {
    console.error(`
  No encontré un usuario con el correo ${correo}

  Créalo primero en Supabase:
    Authentication -> Users -> Add user
    (marca "Auto Confirm User")
`);
    process.exit(1);
  }

  const ins = await rest('admin_profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: usuario.id, name: correo.split('@')[0], role: 'admin' }),
  });

  if (ins.code >= 200 && ins.code < 300) {
    console.log(`\n  ${correo} ya es administrador.`);
    console.log('  Entra en http://localhost:5173/admin/login\n');
  } else {
    console.error(`\n  Falló (${ins.code}): ${ins.texto.slice(0, 200)}\n`);
    process.exit(1);
  }
}


// ---------------------------------------------------------------------------
if (accion === 'demo') {
  // Repone la ocupacion de demostracion del seed, para que la agenda se vea
  // viva: talleres llenos, otros con "ultimos lugares". Son reservas reales
  // que el sistema cuenta igual que cualquier otra.
  //
  // BORRAR ANTES DE OPERAR DE VERDAD:  node dev/admin-db.mjs limpiar
  console.log('\n  Reponiendo ocupacion de demostracion…\n');

  const NOMBRES = ['Maria Fernanda G.','Ana Sofia R.','Regina M.','Paulina T.',
    'Valeria C.','Daniela H.','Ximena L.','Andrea P.'];

  const OCUPACION = {
    'ceramica-desde-cero': [2,1,1],
    'pinta-tu-propia-pieza': [2,1,3,1],
    'ceramica-tematica-septiembre': [2,1,3,2,1,1],
    'taller-libre-sabado': [2,1,2],
    'day-pass-estudio': [2],
    'torno-primera-vez': [2,1],
    'acuarela-botanica': [2,1,3,2,1],
    'esmaltes-y-color': [2],
    'noche-de-barro': [2,1,3,2,1,2,3],
  };

  // Clientes
  const clientes = NOMBRES.map((n, i) => ({
    full_name: n, email: `demo${i + 1}@casanuma.local`,
    phone: `+5281800010${String(i).padStart(2, '0')}`,
  }));
  await rest('customers', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(clientes),
  });
  const { data: cs } = await rest('customers?select=id,email&email=like.*@casanuma.local');
  const porCorreo = Object.fromEntries((cs ?? []).map((c) => [c.email, c.id]));

  const { data: ws } = await rest('workshops?select=id,slug,price');
  const porSlug = Object.fromEntries((ws ?? []).map((w) => [w.slug, w]));

  const filas = [];
  const alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const codigo = () => 'NUMA-' + Array.from({ length: 6 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');

  for (const [slug, partes] of Object.entries(OCUPACION)) {
    const w = porSlug[slug];
    if (!w) continue;
    partes.forEach((n, i) => {
      const email = `demo${(i % NOMBRES.length) + 1}@casanuma.local`;
      filas.push({
        reservation_code: codigo(), workshop_id: w.id,
        customer_id: porCorreo[email], quantity: n,
        unit_price: w.price, total_amount: (Number(w.price) * n).toFixed(2),
        currency: 'MXN', status: 'confirmed',
        confirmed_at: new Date(Date.now() - i * 3600000).toISOString(),
        notes: 'Ocupacion de demostracion. Borrar antes de operar.',
      });
    });
  }

  const r = await rest('reservations', { method: 'POST', body: JSON.stringify(filas) });
  console.log(`    ${filas.length} reservaciones  ${r.code >= 200 && r.code < 300 ? 'OK' : r.code + ' ' + r.texto.slice(0, 120)}`);
  console.log('');
}

if (!['estado', 'limpiar', 'admin', 'demo'].includes(accion)) {
  console.log(`
  Uso:
    node dev/admin-db.mjs estado
    node dev/admin-db.mjs limpiar
    node dev/admin-db.mjs admin tu@correo.com
    node dev/admin-db.mjs demo
`);
}
