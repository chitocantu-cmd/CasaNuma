import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const URL_BASE = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const PUBLICA = 'sb_publishable_YHNS0lzUGRa9SUF1S6NR2g_mdEbYB4O';
const SITIO = 'https://casa-numa-liart.vercel.app';
const CORREO = `consulta-${Date.now()}@ejemplo.com`;

// 1. Crear una reserva real para tener un código que consultar
const r = await fetch(`${URL_BASE}/functions/v1/create-reservation`, {
  method: 'POST',
  headers: { apikey: PUBLICA, Authorization: `Bearer ${PUBLICA}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    slug: 'esmaltes-y-color', quantity: 2,
    full_name: 'Consulta Prueba', email: CORREO, phone: '8112345678',
  }),
}).then((x) => x.json());

if (!r.reservation_code) {
  console.log('  No se pudo crear la reserva:', JSON.stringify(r).slice(0, 150));
  process.exit(1);
}
console.log(`\n  Reserva creada: ${r.reservation_code}\n`);

const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const p = await nav.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

// 2. Abrir la consulta SIN sesión previa (como quien llega desde el correo)
await p.goto(`${SITIO}/reserva/${r.reservation_code}`, { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise((x) => setTimeout(x, 2000));

const paso1 = await p.evaluate(() => ({
  pideCorreo: Boolean(document.querySelector('#correo-consulta')),
  texto: document.body.innerText.slice(0, 120).replace(/\n+/g, ' | '),
}));
console.log('  Sin correo guardado');
console.log('    pide el correo   :', paso1.pideCorreo);
console.log('    pantalla         :', paso1.texto.slice(0, 100));

// 3. Probar con correo EQUIVOCADO
if (paso1.pideCorreo) {
  await p.type('#correo-consulta', 'otro@ejemplo.com');
  await p.click('button[type=submit]');
  await new Promise((x) => setTimeout(x, 4000));
  const malo = await p.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '));
  console.log('\n  Con correo equivocado');
  console.log('    ', malo.slice(0, 140));
}

// 4. Probar con el correo CORRECTO
await p.goto(`${SITIO}/reserva/${r.reservation_code}`, { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise((x) => setTimeout(x, 1500));
await p.type('#correo-consulta', CORREO);
await p.click('button[type=submit]');
await new Promise((x) => setTimeout(x, 6000));

const bueno = await p.evaluate(() => ({
  texto: document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '),
  confirmando: /Estamos confirmando/.test(document.body.innerText),
}));
console.log('\n  Con el correo correcto');
console.log('    ', bueno.texto.slice(0, 200));

console.log('\n  errores JS:', errores.length ? errores.slice(0, 2) : 'ninguno');
await nav.close();

// Limpieza
const KEY = readFileSync('dev/secretos.env', 'utf8')
  .match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m)[1].trim();
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const cs = await fetch(`${URL_BASE}/rest/v1/customers?select=id&email=eq.${CORREO}`, { headers: H })
  .then((x) => x.json());
if (cs?.[0]) {
  await fetch(`${URL_BASE}/rest/v1/reservations?customer_id=eq.${cs[0].id}`, { method: 'DELETE', headers: H });
  await fetch(`${URL_BASE}/rest/v1/customers?id=eq.${cs[0].id}`, { method: 'DELETE', headers: H });
  console.log('  (reserva de prueba borrada)');
}
