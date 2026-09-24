// ---------------------------------------------------------------------------
// Pruebas de reservas v2 (sesiones, folio, cupo, membresía, NUMA Kids, RLS)
// ---------------------------------------------------------------------------
//   node supabase/tests/reservas-v2.test.mjs
//
// Crea sus propias sesiones con fechas relativas a hoy: no caduca.
// Mismo límite que logica.test.mjs: PGlite es una sola conexión, así que aquí
// se prueba que el CONTEO y las reglas son correctas; el bloqueo concurrente
// (FOR UPDATE) solo se comprueba contra un Postgres de verdad.
// ---------------------------------------------------------------------------

import { crearBase } from './harness.mjs';

let pasadas = 0, fallidas = 0;
const fallos = [];
function ok(nombre, condicion, detalle = '') {
  if (condicion) { pasadas++; console.log(`  ✓ ${nombre}`); }
  else { fallidas++; fallos.push(`${nombre}${detalle ? ' — ' + detalle : ''}`);
         console.log(`  ✗ ${nombre}${detalle ? '\n      ' + detalle : ''}`); }
}
function seccion(t) { console.log(`\n${t}`); }
async function intentar(db, sql, params) {
  try { const r = await db.query(sql, params); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, error: e.message, code: e.code, detail: e.detail, hint: e.hint }; }
}

const RESERVAR = `select crear_reserva_sesiones($1, $2::uuid[], $3, $4, $5, $6, $7::jsonb, $8, $9) as r`;
const reservar = (db, { tipo, sesiones, personas = 1, nombre = 'Clienta Prueba', correo = 'clienta@ejemplo.com',
  tel = '8112345678', ninos = [], usuario = null, origen = 'web' }) =>
  intentar(db, RESERVAR, [tipo, sesiones, personas, nombre, correo, tel, JSON.stringify(ninos), usuario, origen]);
const pagar = (db, id, n) =>
  db.query(`select confirmar_pago($1, $2, $3, $4, 'mxn', 'succeeded') as s`, [id, `cs_${n}`, `pi_${n}`, 1]);

console.log('\nReservas v2 · Casa Numa\n' + '='.repeat(60));
const db = await crearBase();

// --- Sesiones de prueba (relativas a hoy) -----------------------------------
const { rows: [{ taller }] } = await db.query(`select id as taller from workshops limit 1`);
async function sesion(sql) { return (await db.query(sql + ' returning id')).rows[0].id; }
const S = {
  halloween: await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, end_time, capacity, price)
                           values ('taller', '${taller}', current_date + 10, '11:00', '13:00', 3, 800)`),
  infoDm:    await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                           values ('taller', '${taller}', current_date + 11, '19:00', null, null)`),
  pasada:    await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                           values ('taller', '${taller}', current_date - 1, '11:00', 5, 800)`),
  kids:      await sesion(`insert into workshop_sessions (experience_type, date, start_time, end_time, capacity, price)
                           values ('kids', current_date + 12, '17:00', '18:30', null, 680)`),
};
const mem = [];
for (const d of [3, 10, 17, 24]) {
  mem.push(await sesion(`insert into workshop_sessions (experience_type, date, start_time, end_time, capacity)
    values ('membresia', (date_trunc('month', now()) + interval '2 months')::date + ${d - 1}, '10:00', '13:00', ${d === 24 ? 1 : 'null'})`));
}
const memOtroMes = await sesion(`insert into workshop_sessions (experience_type, date, start_time, end_time, capacity)
  values ('membresia', (date_trunc('month', now()) + interval '3 months')::date + 4, '10:00', '13:00', null)`);

// ---------------------------------------------------------------------------
seccion('Folio');
{
  const { rows } = await db.query(`select siguiente_folio() a, siguiente_folio() b`);
  const n = (f) => Number(f.slice(5));
  ok('formato NUMA-00000', /^NUMA-\d{5}$/.test(rows[0].a), rows[0].a);
  ok('consecutivo', n(rows[0].b) === n(rows[0].a) + 1, `${rows[0].a} → ${rows[0].b}`);
  const { rows: conf } = await db.query(`select count(*)::int n, count(folio)::int f from reservations where status = 'confirmed'`);
  ok('las reservas confirmadas existentes recibieron folio', conf[0].n === conf[0].f, JSON.stringify(conf[0]));
}

// ---------------------------------------------------------------------------
seccion('Catálogo sin datos inventados');
{
  const a = await intentar(db, `
    insert into workshops (slug, title, date, start_time, end_time, capacity, price, booking_mode, status,
                           label, price_label, age_min, age_max, image_key, is_featured)
    values ('prueba-info-dm', 'Clases de Cerámica', current_date + 30, '10:00', null, null, 0, 'quote', 'published',
            'Clases', 'Info DM', null, null, 'taller-clases', true)
    returning id`);
  ok('un taller sin cupo ni hora de cierre se puede guardar', a.ok, a.error);
  const { rows: [pw] } = await db.query(`select seats_available from public_workshops where slug = 'prueba-info-dm'`);
  ok('v1 lo ve con 0 lugares (falla del lado seguro)', pw?.seats_available === 0, JSON.stringify(pw));
  const v1 = await intentar(db, `select crear_reserva('prueba-info-dm', 1, 'x', 'x@ejemplo.com', '8112345678')`);
  ok('crear_reserva v1 no lo vende', !v1.ok, 'se pudo');
}

// ---------------------------------------------------------------------------
seccion('Taller con cupo (3 lugares)');
let r1;
{
  const a = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 2 });
  ok('aparta 2 lugares', a.ok, a.error);
  r1 = a.rows?.[0].r;
  ok('queda pending_payment y SIN folio', r1?.status === 'pending_payment' && r1?.folio === null, JSON.stringify(r1));
  ok('total calculado en el backend: 2 × 800', Number(r1?.total_amount) === 1600, String(r1?.total_amount));

  const b = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 2, correo: 'otra@ejemplo.com' });
  ok('el apartado ya ocupa lugar: 2 más no caben', !b.ok && b.code === 'CN001', b.error);
  ok('informa cuántos quedan (1)', b.detail === '1', b.detail);

  const st = await pagar(db, r1.reservation_id, 1);
  ok('confirmar_pago → confirmed', st.rows[0].s === 'confirmed', st.rows[0].s);
  const { rows: [x] } = await db.query(`select folio, status from reservations where id = $1`, [r1.reservation_id]);
  ok('el folio lo asigna el backend al confirmar', /^NUMA-\d{5}$/.test(x.folio ?? ''), x.folio);

  const { rows: jobs } = await db.query(
    `select type::text, payload->>'template' t from integration_jobs where entity_id = $1 order by 1, 2`, [r1.reservation_id]);
  const tipos = jobs.map((j) => `${j.type}:${j.t}`);
  ok('encola correo a la clienta', tipos.includes('email_send:confirmacion'), tipos.join(', '));
  ok('encola correo al equipo', tipos.includes('email_send:admin_reserva'), tipos.join(', '));
  ok('encola WhatsApp al equipo (API, no wa.me)', tipos.includes('whatsapp_send:admin_reserva'), tipos.join(', '));

  const otra = await pagar(db, r1.reservation_id, 1);
  ok('confirmar dos veces es idempotente', otra.rows[0].s === 'already_confirmed');
  const { rows: [{ n }] } = await db.query(`select count(*)::int n from integration_jobs where entity_id = $1`, [r1.reservation_id]);
  ok('sin avisos duplicados', n === 3, String(n));

  const c = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 1, correo: 'c@ejemplo.com' });
  ok('el último lugar sí se puede apartar', c.ok, c.error);
  const d = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 1, correo: 'd@ejemplo.com' });
  ok('lleno: no se aparta nada más (AGOTADO)', !d.ok && d.code === 'CN001' && d.detail === '0', d.error);

  const { rows: [pub] } = await db.query(`select seats_available from public_sessions where id = $1`, [S.halloween]);
  ok('public_sessions muestra 0 disponibles', pub.seats_available === 0, String(pub.seats_available));

  // El apartado de C vence: el lugar vuelve.
  await db.query(`update reservations set expires_at = now() - interval '1 minute' where id = $1`, [c.rows[0].r.reservation_id]);
  const { rows: [{ o }] } = await db.query(`select lugares_ocupados_sesion($1) o`, [S.halloween]);
  ok('un apartado vencido libera el lugar', o === 2, String(o));

  // Mientras tanto D toma el lugar… y luego C paga tarde.
  const d2 = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 1, correo: 'd@ejemplo.com' });
  ok('otra persona toma el lugar liberado', d2.ok, d2.error);
  await pagar(db, d2.rows[0].r.reservation_id, 2);
  const tarde = await pagar(db, c.rows[0].r.reservation_id, 3);
  ok('pago tardío sin cupo → needs_review (no sobrevende)', tarde.rows[0].s === 'needs_review', tarde.rows[0].s);
  const { rows: [cc] } = await db.query(`select status::text, folio from reservations where id = $1`, [c.rows[0].r.reservation_id]);
  ok('esa reserva NO queda confirmada ni con folio', cc.status !== 'confirmed' && cc.folio === null, JSON.stringify(cc));
}

// ---------------------------------------------------------------------------
seccion('Reglas del catálogo');
{
  const a = await reservar(db, { tipo: 'taller', sesiones: [S.infoDm], personas: 1 });
  ok('taller "Info DM" (sin precio) no se reserva en línea', !a.ok && a.code === 'CN003', a.error);
  const b = await reservar(db, { tipo: 'taller', sesiones: [S.pasada], personas: 1 });
  ok('una sesión pasada no se reserva', !b.ok && b.code === 'CN006', b.error);
  const c = await reservar(db, { tipo: 'kids', sesiones: [S.halloween], personas: 1, ninos: [{ name: 'Ana', age: 11 }] });
  ok('no se mezcla el tipo de experiencia con la sesión', !c.ok && c.code === 'CN002', c.error);
  const d = await reservar(db, { tipo: 'taller', sesiones: [S.halloween], personas: 1, tel: '123' });
  ok('teléfono inválido se rechaza en el backend', !d.ok && d.code === 'CN004', d.error);
}

// ---------------------------------------------------------------------------
seccion('NUMA Kids (cupo sin confirmar)');
{
  const ninos = Array.from({ length: 7 }, (_, i) => ({ name: `Niña ${i}`, age: 11 }));
  const a = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 7, ninos });
  ok('cupo sin confirmar: aplica el tope por reserva (6)', !a.ok && a.code === 'CN004', a.error);
  const b = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 2, ninos: [{ name: 'Emilio', age: 11 }] });
  ok('un nombre y edad por cada lugar', !b.ok && b.code === 'CN004', b.error);
  const b2 = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 1, ninos: [{ name: 'Sofía', age: 5 }] });
  ok('menores de la edad mínima se rechazan en el backend', !b2.ok && b2.code === 'CN004', b2.error);
  const b3 = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 1, ninos: [{ name: 'Sofía', age: 8 }] });
  ok('NUMA Kids: 8 años no (10 a 14)', !b3.ok && b3.code === 'CN004' && /10 a 14/.test(b3.detail ?? ''), b3.error);
  const b4 = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 1, ninos: [{ name: 'Sofía', age: 15 }] });
  ok('NUMA Kids: 15 años no (10 a 14)', !b4.ok && b4.code === 'CN004', b4.error);
  const { rows: [{ sueltos }] } = await db.query(`select count(*)::int sueltos from reservations r
     where r.experience_type = 'kids' and not exists (select 1 from reservation_children c where c.reservation_id = r.id)`);
  ok('una edad rechazada no deja reservas a medias', sueltos === 0, String(sueltos));
  const c = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 1, ninos: [{ name: 'Emilio', age: 11, alergias: 'x', escuela: 'y' }],
    nombre: 'Tutora Kids', correo: 'tutora@ejemplo.com' });
  ok('reserva de NUMA Kids', c.ok, c.error);
  ok('precio del backend: $680', Number(c.rows?.[0].r.total_amount) === 680);
  const { rows: cols } = await db.query(`select column_name from information_schema.columns where table_name = 'reservation_children' order by 1`);
  ok('del menor solo se guarda nombre y edad', cols.map((x) => x.column_name).join(',') === 'age,child_name,created_at,id,reservation_id',
     cols.map((x) => x.column_name).join(','));
  await pagar(db, c.rows[0].r.reservation_id, 4);
  const { rows: [d] } = await db.query(`select datos_reserva($1) d`, [c.rows[0].r.reservation_id]);
  ok('datos_reserva: título, folio, niños y sesión', d.d.workshop.title === 'NUMA Kids' && /^NUMA-/.test(d.d.folio)
     && d.d.children[0].name === 'Emilio' && d.d.sessions.length === 1 && d.d.paid === true, JSON.stringify(d.d).slice(0, 200));
  const { rows: [{ p }] } = await db.query(`select seats_available p from public_sessions where id = $1`, [S.kids]);
  ok('sin cupo confirmado, public_sessions no inventa un número', p === null, String(p));
}

// ---------------------------------------------------------------------------
seccion('Membresía (4 clases)');
{
  const a = await reservar(db, { tipo: 'membresia', sesiones: mem.slice(0, 3) });
  ok('con 3 clases no se puede', !a.ok && a.code === 'CN004', a.error);
  const b = await reservar(db, { tipo: 'membresia', sesiones: [...mem.slice(0, 3), memOtroMes] });
  ok('las 4 clases deben ser del mismo mes', !b.ok && b.code === 'CN004', b.error);

  const c = await reservar(db, { tipo: 'membresia', sesiones: mem, nombre: 'Alumna Uno', correo: 'uno@ejemplo.com' });
  ok('membresía de 4 clases', c.ok, c.error);
  ok('precio del plan: $3,200', Number(c.rows?.[0].r.total_amount) === 3200);
  const { rows: [u] } = await db.query(`select * from membership_usage where reservation_id = $1`, [c.rows[0].r.reservation_id]);
  ok('uso: 0 utilizadas · 4 reservadas · 4 restantes',
     u.sessions_used === 0 && u.sessions_booked === 4 && u.sessions_remaining === 4, JSON.stringify(u));

  // La clase del 24 tiene cupo 1 y ya está tomada: la membresía entera falla.
  const { rows: [{ antes }] } = await db.query(`select count(*)::int antes from reservation_items`);
  const d = await reservar(db, { tipo: 'membresia', sesiones: mem, nombre: 'Alumna Dos', correo: 'dos@ejemplo.com' });
  ok('si una de las 4 clases está llena, no se aparta ninguna', !d.ok && d.code === 'CN001', d.error);
  const { rows: [{ despues }] } = await db.query(`select count(*)::int despues from reservation_items`);
  ok('…y no quedan partidas sueltas', antes === despues, `${antes} → ${despues}`);
  ok('el error dice qué sesión está llena', (d.hint ?? '').includes(mem[3]), d.hint);
}

// ---------------------------------------------------------------------------
seccion('Panel: reserva manual y pago por transferencia');
{
  const s2 = await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                            values ('taller', '${taller}', current_date + 20, '16:00', 4, 800)`);
  const a = await reservar(db, { tipo: 'taller', sesiones: [s2], personas: 2, origen: 'panel', correo: 'panel@ejemplo.com' });
  ok('el equipo registra una reserva', a.ok, a.error);
  const r = a.rows[0].r;
  ok('la reserva del panel tiene folio desde que se crea', /^NUMA-\d{5}$/.test(r.folio ?? ''), r.folio);
  const { rows: [x] } = await db.query(
    `select expires_at = inicio_taller(date, start_time, timezone) aparta_hasta_la_clase
       from reservations, workshop_sessions where reservations.id = $1 and workshop_sessions.id = $2`, [r.reservation_id, s2]);
  ok('aparta el lugar hasta que empieza la clase', x.aparta_hasta_la_clase === true);

  const p = await db.query(`select registrar_pago_manual($1, 1600, 'transferencia', 'SPEI 123') s`, [r.reservation_id]);
  ok('registrar pago recibido → confirmed', p.rows[0].s === 'confirmed');
  const { rows: [pg] } = await db.query(`select provider, method, reference, status::text from payments where reservation_id = $1`, [r.reservation_id]);
  ok('pago manual con método y referencia', pg.provider === 'manual' && pg.method === 'transferencia' && pg.reference === 'SPEI 123', JSON.stringify(pg));
  const { rows: [f] } = await db.query(`select folio from reservations where id = $1`, [r.reservation_id]);
  ok('conserva el mismo folio', f.folio === r.folio);

  const m = await intentar(db, `select (admin_actualizar_reserva($1, 'completed', 'Llegó 10 min tarde')).status::text s`, [r.reservation_id]);
  ok('marcar como completada', m.ok && m.rows[0].s === 'completed', m.error);
  const { rows: [{ o }] } = await db.query(`select lugares_ocupados_sesion($1) o`, [s2]);
  ok('una completada sigue contando en el cupo', o === 2, String(o));
  const n = await intentar(db, `select admin_actualizar_reserva($1, 'confirmed')`, [r.reservation_id]);
  ok('solo acepta completada / no asistió', !n.ok && n.code === 'CN004', n.error);
}

// ---------------------------------------------------------------------------
seccion('Pago y consulta de NUMA Kids y membresía');
{
  const k = await reservar(db, { tipo: 'kids', sesiones: [S.kids], personas: 1, ninos: [{ name: 'Mateo', age: 12 }],
    nombre: 'Tutor Pago', correo: 'tutor-pago@ejemplo.com' });
  ok('reserva de NUMA Kids para pagar', k.ok, k.error);
  const { rows: [{ p }] } = await db.query(`select reserva_para_pago($1) p`, [k.rows[0].r.reservation_id]);
  ok('reserva_para_pago: NUMA Kids $680 sin taller ligado',
     p.workshop_title === 'NUMA Kids' && Number(p.unit_price) === 680 && Number(p.total_amount) === 680
     && p.workshop_id === null && p.sessions.length === 1 && p.customer_email === 'tutor-pago@ejemplo.com', JSON.stringify(p));

  const sesMem = [];
  for (const d of [2, 9, 16, 23]) {
    sesMem.push(await sesion(`insert into workshop_sessions (experience_type, date, start_time, end_time)
      values ('membresia', (date_trunc('month', now()) + interval '4 months')::date + ${d - 1}, '10:00', '13:00')`));
  }
  const m = await reservar(db, { tipo: 'membresia', sesiones: sesMem, nombre: 'Alumna Pago', correo: 'alumna-pago@ejemplo.com' });
  ok('membresía para pagar', m.ok, m.error);
  const { rows: [{ q }] } = await db.query(`select reserva_para_pago($1) q`, [m.rows[0].r.reservation_id]);
  ok('reserva_para_pago: membresía $3,200 con sus 4 clases',
     q.workshop_title === 'Membresía NUMA' && Number(q.total_amount) === 3200 && q.quantity === 1 && q.sessions.length === 4, JSON.stringify(q));

  await pagar(db, m.rows[0].r.reservation_id, 9);
  const { rows: [{ c }] } = await db.query(`select consultar_reserva($1, 'alumna-pago@ejemplo.com') c`, [m.rows[0].r.reservation_code]);
  ok('consultar_reserva: membresía confirmada, con folio y sus 4 clases',
     c && c.status === 'confirmed' && /^NUMA-\d{5}$/.test(c.folio ?? '') && c.sessions.length === 4 && c.payment_status === 'paid', JSON.stringify(c));
  ok('consultar_reserva no expone los datos del cliente', c && !('customer' in c));
  const { rows: [{ x }] } = await db.query(`select consultar_reserva($1, 'otra@ejemplo.com') x`, [m.rows[0].r.reservation_code]);
  ok('consultar_reserva con otro correo no devuelve nada', x === null);

  const venc = await intentar(db, `select reserva_para_pago($1)`, [m.rows[0].r.reservation_id]);
  ok('una reserva ya pagada no se vuelve a cobrar', !venc.ok && venc.code === 'CN007', venc.error);
}

// ---------------------------------------------------------------------------
seccion('Pago real de Stripe: fila pendiente → pagada');
{
  const s4 = await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                            values ('taller', '${taller}', current_date + 41, '11:00', 4, 800)`);
  const a = await reservar(db, { tipo: 'taller', sesiones: [s4], personas: 2, correo: 'stripe@ejemplo.com' });
  const id = a.rows[0].r.reservation_id;
  // create-checkout-session deja la fila pendiente con la sesión de Stripe.
  await db.query(`select guardar_checkout_session($1, 'cs_flujo', 1600, 'mxn')`, [id]);
  const w = await intentar(db, `select confirmar_pago($1, 'cs_flujo', 'pi_flujo', 1600, 'mxn', 'paid') s`, [id]);
  ok('el webhook confirma sobre la fila pendiente (sin choque de índice)', w.ok && w.rows[0].s === 'confirmed', w.error);
  const f = await intentar(db, `select confirmar_pago($1, 'cs_flujo', 'pi_flujo', 1600, 'mxn', 'paid') s`, [id]);
  ok('el respaldo llega después: already_confirmed', f.ok && f.rows[0].s === 'already_confirmed', f.error);
  const { rows: pagos } = await db.query(`select status::text, stripe_payment_intent_id i, method from payments where reservation_id = $1`, [id]);
  ok('una sola fila de pago, pagada, con el cobro de Stripe',
     pagos.length === 1 && pagos[0].status === 'paid' && pagos[0].i === 'pi_flujo' && pagos[0].method === 'tarjeta', JSON.stringify(pagos));

  // Pago tardío sin cupo, también con fila pendiente previa.
  const b = await reservar(db, { tipo: 'taller', sesiones: [s4], personas: 2, correo: 'tarde@ejemplo.com' });
  const idB = b.rows[0].r.reservation_id;
  await db.query(`select guardar_checkout_session($1, 'cs_tarde', 1600, 'mxn')`, [idB]);
  await db.query(`update reservations set expires_at = now() - interval '1 minute' where id = $1`, [idB]);
  await reservar(db, { tipo: 'taller', sesiones: [s4], personas: 2, correo: 'gana@ejemplo.com' });
  const t = await intentar(db, `select confirmar_pago($1, 'cs_tarde', 'pi_tarde', 1600, 'mxn', 'paid') s`, [idB]);
  ok('pago tardío sin cupo → needs_review (con fila pendiente previa)', t.ok && t.rows[0].s === 'needs_review', t.error);
  const { rows: [pt] } = await db.query(`select count(*)::int n, bool_and(needs_review) r, min(status::text) st from payments where reservation_id = $1`, [idB]);
  ok('…una sola fila, pagada y marcada para revisión', pt.n === 1 && pt.r === true && pt.st === 'paid', JSON.stringify(pt));
}

// ---------------------------------------------------------------------------
seccion('Cupo desde el panel');
{
  const s3 = await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                            values ('taller', '${taller}', current_date + 40, '11:00', null, 800)`);
  const a = await reservar(db, { tipo: 'taller', sesiones: [s3], personas: 3, correo: 'cupo@ejemplo.com' });
  ok('reserva de 3 con cupo sin confirmar', a.ok, a.error);
  const bajo = await intentar(db, `select admin_ajustar_cupo($1, 2)`, [s3]);
  ok('no deja poner un cupo menor a lo reservado', !bajo.ok && bajo.code === 'CN004' && /3 lugares/.test(bajo.detail ?? ''), bajo.error);
  const bien = await intentar(db, `select (admin_ajustar_cupo($1, 5)).capacity c`, [s3]);
  ok('cupo 5 con 3 reservados', bien.ok && bien.rows[0].c === 5, bien.error);
  const { rows: [pub] } = await db.query(`select seats_available from public_sessions where id = $1`, [s3]);
  ok('el sitio ve 2 disponibles', pub.seats_available === 2, String(pub.seats_available));
  const nulo = await intentar(db, `select (admin_ajustar_cupo($1, null)).capacity c`, [s3]);
  ok('se puede regresar a «cupo sin confirmar»', nulo.ok && nulo.rows[0].c === null, nulo.error);
}

// ---------------------------------------------------------------------------
seccion('Seguridad');
{
  const { rows: [{ ana }] } = await db.query(`insert into auth.users (email) values ('ana@cuenta.com') returning id as ana`);
  const { rows: [{ beto }] } = await db.query(`insert into auth.users (email) values ('beto@cuenta.com') returning id as beto`);

  const sA = await sesion(`insert into workshop_sessions (experience_type, workshop_id, date, start_time, capacity, price)
                           values ('taller', '${taller}', current_date + 25, '11:00', 10, 800)`);
  const a = await reservar(db, { tipo: 'taller', sesiones: [sA], personas: 1, correo: 'ana@cuenta.com', nombre: 'Ana', usuario: ana });
  await pagar(db, a.rows[0].r.reservation_id, 5);
  // Beto, con su sesión, escribe el correo de otra persona.
  const b = await reservar(db, { tipo: 'taller', sesiones: [sA], personas: 1, correo: 'uno@ejemplo.com', nombre: 'Beto', usuario: beto });
  ok('reserva con correo ajeno', b.ok, b.error);
  const { rows: [c] } = await db.query(`select user_id from customers where email = 'uno@ejemplo.com'`);
  ok('la cuenta NO se liga a un cliente con otro correo', c.user_id === null, String(c.user_id));

  async function como(uid, sql) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
    await db.query(`set role authenticated`);
    try { return await intentar(db, sql); } finally { await db.query(`reset role`); }
  }
  const verAna = await como(ana, `select id, folio from reservations`);
  ok('Ana ve su reserva', verAna.ok && verAna.rows.length === 1 && verAna.rows[0].id === a.rows[0].r.reservation_id,
     verAna.error ?? JSON.stringify(verAna.rows));
  const verBeto = await como(beto, `select r.id from reservations r`);
  ok('Beto solo ve la que hizo él, no el historial de "uno@ejemplo.com"',
     verBeto.ok && verBeto.rows.length === 1 && verBeto.rows[0].id === b.rows[0].r.reservation_id,
     verBeto.error ?? JSON.stringify(verBeto.rows));
  const ninos = await como(ana, `select * from reservation_children`);
  ok('Ana no ve niños de otras reservas', ninos.ok && ninos.rows.length === 0, ninos.error ?? String(ninos.rows.length));
  const pagos = await como(ana, `select * from payments`);
  ok('una clienta no lee la tabla de pagos', !pagos.ok || pagos.rows.length === 0, pagos.error);
  const crear = await como(ana, `select crear_reserva_sesiones('taller', array['${sA}']::uuid[], 1, 'x', 'x@x.com', '8112345678')`);
  ok('el navegador no puede llamar crear_reserva_sesiones', !crear.ok, 'se pudo');
  const folio = await como(ana, `select siguiente_folio()`);
  ok('el navegador no puede generar folios', !folio.ok, 'se pudo');

  await db.query(`insert into admin_profiles (user_id) values ($1)`, [beto]);
  const verAdmin = await como(beto, `select count(*)::int n from reservations`);
  const { rows: [{ total }] } = await db.query(`select count(*)::int total from reservations`);
  ok('el equipo (admin) ve todas', verAdmin.ok && verAdmin.rows[0].n === total, `${verAdmin.rows?.[0]?.n} de ${total}`);

  const { rows } = await db.query(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
  ok('RLS activo en TODAS las tablas', rows.length === 0, rows.map((x) => x.tablename).join(', '));
  const { rows: sd } = await db.query(`
    select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
  ok('ninguna función SECURITY DEFINER sin search_path fijo', sd.length === 0, sd.map((x) => x.proname).join(', '));
}

await db.close();
console.log('\n' + '='.repeat(60));
console.log(`  ${pasadas} pasadas · ${fallidas} fallidas`);
if (fallos.length) { console.log('\nFallos:'); fallos.forEach((f) => console.log(`  · ${f}`)); }
console.log('');
process.exit(fallidas > 0 ? 1 : 0);
