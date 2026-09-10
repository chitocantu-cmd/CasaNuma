// ===========================================================================
// Verificación del sistema contra el Supabase REAL
// ---------------------------------------------------------------------------
// Comprueba, en orden, qué funciona y qué falta. Cada punto dice qué hacer si
// falla, para no tener que adivinar.
//
//   node dev/verificar.mjs
// ===========================================================================

const URL = 'https://xjerknpiyokzzcihwkpg.supabase.co';
const KEY = 'sb_publishable_YHNS0lzUGRa9SUF1S6NR2g_mdEbYB4O';

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

let ok = 0, fallos = 0;
const pendientes = [];

function marca(nombre, bien, detalle = '', comoArreglar = '') {
  if (bien) { ok++; console.log(`  ✓ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else {
    fallos++;
    console.log(`  ✗ ${nombre}${detalle ? ' — ' + detalle : ''}`);
    if (comoArreglar) pendientes.push(`${nombre}\n      ${comoArreglar}`);
  }
}

const get = async (ruta) => {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, { headers: H });
  return { code: r.status, body: await r.text() };
};
const post = async (fn, cuerpo) => {
  const r = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST', headers: H, body: JSON.stringify(cuerpo),
  });
  return { code: r.status, body: await r.text() };
};

console.log('\nVerificación · Casa Numa\n' + '='.repeat(62));

// --- Base de datos ---------------------------------------------------------
console.log('\nBase de datos');
{
  const { code, body } = await get('public_workshops?select=slug,seats_available');
  let n = 0;
  try { n = JSON.parse(body).length; } catch { /* ignore */ }
  marca('Catálogo público', code === 200 && n > 0, `${n} talleres`,
    'Corre supabase/migracion-completa.sql en el SQL Editor.');
}

// --- RLS -------------------------------------------------------------------
console.log('\nSeguridad (RLS)');
for (const t of ['customers', 'reservations', 'payments', 'contact_leads', 'audit_log']) {
  const { code, body } = await get(`${t}?select=*&limit=1`);
  let filas = -1;
  try { const j = JSON.parse(body); filas = Array.isArray(j) ? j.length : -1; } catch { /* ignore */ }
  marca(`${t} protegida`, code === 401 || filas === 0, code === 200 ? `FUGA: ${filas} filas` : `HTTP ${code}`,
    'La migración de RLS no se aplicó completa.');
}
{
  const r = await fetch(`${URL}/rest/v1/workshops`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ slug: 'prueba-seguridad', title: 'x', category: 'ceramica',
      date: '2027-01-01', start_time: '11:00', end_time: '13:00', price: 1, capacity: 1 }),
  });
  marca('Escritura anónima bloqueada', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}

// --- Edge Functions --------------------------------------------------------
console.log('\nEdge Functions');
const fns = ['create-reservation', 'create-checkout-session', 'stripe-webhook',
  'reservation-status', 'submit-form', 'process-jobs', 'admin-actions', 'cloudinary-sign'];
let desplegadas = 0;
for (const f of fns) {
  const { code } = await post(f, {});
  const existe = code !== 404;
  if (existe) desplegadas++;
  marca(f, existe, existe ? `HTTP ${code}` : 'no desplegada',
    'Corre: npx supabase login  y luego  node dev/desplegar.mjs');
}

// --- Flujo real ------------------------------------------------------------
if (desplegadas > 0) {
  console.log('\nFlujo de reserva');

  {
    const { code, body } = await post('create-reservation', {
      slug: 'ceramica-tematica-septiembre', quantity: 1,
      full_name: 'Prueba Cupo', email: 'prueba-cupo@ejemplo.com', phone: '8112345678',
    });
    let err = '';
    try { err = JSON.parse(body).error ?? ''; } catch { /* ignore */ }
    marca('Rechaza taller lleno', code === 409 && err === 'INSUFFICIENT_CAPACITY',
      `HTTP ${code} ${err}`, 'Revisa SUPABASE_SERVICE_ROLE_KEY en los secretos.');
  }

  {
    const { code, body } = await post('create-reservation', {
      slug: 'piezas-personalizadas', quantity: 1,
      full_name: 'Prueba', email: 'prueba-quote@ejemplo.com', phone: '8112345678',
    });
    let err = '';
    try { err = JSON.parse(body).error ?? ''; } catch { /* ignore */ }
    marca('Taller cotizable no cobrable', code === 400 && err === 'WORKSHOP_REQUIRES_QUOTE',
      `HTTP ${code} ${err}`);
  }

  {
    const { code, body } = await post('create-reservation', {
      slug: 'esmaltes-y-color', quantity: 1,
      full_name: 'Prueba Reserva', email: 'prueba-ok@ejemplo.com', phone: '8112345678',
    });
    let datos = {};
    try { datos = JSON.parse(body); } catch { /* ignore */ }
    const creada = code === 200 && Boolean(datos.reservation_code);
    marca('Crea reserva con hold', creada,
      creada ? datos.reservation_code : `HTTP ${code} ${body.slice(0, 90)}`);

    if (creada) {
      const { code: c2, body: b2 } = await post('create-checkout-session', {
        reservation_id: datos.reservation_id,
      });
      let d2 = {};
      try { d2 = JSON.parse(b2); } catch { /* ignore */ }
      marca('Crea sesión de pago (Stripe)', c2 === 200 && Boolean(d2.checkout_url),
        c2 === 200 ? 'URL de Checkout OK' : `HTTP ${c2} ${d2.error ?? ''}`,
        'Falta STRIPE_SECRET_KEY en dev/secretos.env');
    }
  }

  {
    const { code, body } = await post('submit-form', {
      tipo: 'contacto', name: 'Prueba', email: 'prueba-form@ejemplo.com',
      phone: '8112345678', message: 'Prueba automática de verificación.',
    });
    let d = {};
    try { d = JSON.parse(body); } catch { /* ignore */ }
    marca('Formulario de contacto guarda', code === 200 && d.ok === true,
      `HTTP ${code}`);
  }
}

// --- Resumen ---------------------------------------------------------------
console.log('\n' + '='.repeat(62));
console.log(`  ${ok} bien · ${fallos} pendientes\n`);
if (pendientes.length) {
  console.log('  Qué falta:');
  [...new Set(pendientes)].forEach((p) => console.log(`\n    · ${p}`));
  console.log('');
}
