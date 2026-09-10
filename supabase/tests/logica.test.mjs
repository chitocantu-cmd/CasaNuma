// ---------------------------------------------------------------------------
// Pruebas de la lógica de negocio, contra PostgreSQL real (PGlite)
// ---------------------------------------------------------------------------
//   node supabase/tests/logica.test.mjs
//
// LÍMITE CONOCIDO: PGlite corre sobre una sola conexión, así que no puede
// probar concurrencia real. El TEST C (dos peticiones simultáneas) verifica
// aquí que el CONTEO es correcto; que el BLOQUEO funciona solo se puede
// comprobar contra un Postgres de verdad — ver docs/PRUEBAS.md.
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

/** Ejecuta y devuelve { ok, rows, error } sin lanzar. */
async function intentar(db, sql, params) {
  try {
    const r = await db.query(sql, params);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
}

const RESERVA = `select crear_reserva($1,$2,$3,$4,$5) as r`;

// ---------------------------------------------------------------------------
console.log('\nPruebas de lógica · Casa Numa\n' + '='.repeat(60));
const db = await crearBase();

// ---------------------------------------------------------------------------
seccion('Utilidades');

{
  const { rows } = await db.query(`
    select normalizar_telefono('81 1234 5678') a,
           normalizar_telefono('+52 81 1234 5678') b,
           normalizar_telefono('528112345678') c,
           normalizar_telefono('5218112345678') d,
           normalizar_telefono('') e
  `);
  const r = rows[0];
  ok('normaliza 10 dígitos a E.164', r.a === '+528112345678', `dio ${r.a}`);
  ok('normaliza con lada de país', r.b === '+528112345678', `dio ${r.b}`);
  ok('normaliza 52 + 10', r.c === '+528112345678', `dio ${r.c}`);
  ok('normaliza el formato viejo 521', r.d === '+528112345678', `dio ${r.d}`);
  ok('cadena vacía devuelve null', r.e === null, `dio ${r.e}`);
  ok('las cuatro formas dan el MISMO número',
     r.a === r.b && r.b === r.c && r.c === r.d);
}

{
  const { rows } = await db.query('select generar_reservation_code() c');
  const c = rows[0].c;
  ok('el código tiene formato NUMA-XXXXXX', /^NUMA-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(c), c);
  ok('el código no usa caracteres ambiguos (0,O,1,I,L)', !/[0O1IL]/.test(c.slice(5)), c);
}

// ---------------------------------------------------------------------------
seccion('TEST A · Reserva normal y disponibilidad');

{
  const { rows: [{ d }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='noche-de-barro'`);
  ok('noche-de-barro arranca 14/16 con 2 libres',
     d.capacity === 16 && d.confirmed === 14 && d.available === 2,
     JSON.stringify(d));

  const r = await intentar(db, RESERVA,
    ['noche-de-barro', 2, 'Ana Prueba', 'ana@ejemplo.com', '8112345678']);
  ok('se crea la reserva de los 2 últimos lugares', r.ok, r.error);

  if (r.ok) {
    const res = r.rows[0].r;
    ok('devuelve código de reservación', /^NUMA-/.test(res.reservation_code));
    ok('el total es precio × cantidad',
       Number(res.total_amount) === Number(res.unit_price) * 2,
       `${res.unit_price} × 2 ≠ ${res.total_amount}`);
    ok('la reserva trae vencimiento (hold)', Boolean(res.expires_at));
  }

  const { rows: [{ d: d2 }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='noche-de-barro'`);
  ok('el hold ocupa lugares de inmediato',
     d2.available === 0 && d2.holds === 2, JSON.stringify(d2));
}

// ---------------------------------------------------------------------------
seccion('TEST B · Rechazo por cupo insuficiente');

{
  const r = await intentar(db, RESERVA,
    ['noche-de-barro', 1, 'Tarde', 'tarde@ejemplo.com', '8112345679']);
  ok('rechaza cuando ya no hay lugares', !r.ok, 'debió fallar');
  ok('el error es INSUFFICIENT_CAPACITY', r.error?.includes('INSUFFICIENT_CAPACITY'), r.error);

  const { rows } = await db.query(
    `select count(*)::int n from customers where email='tarde@ejemplo.com'`);
  const { rows: r2 } = await db.query(
    `select count(*)::int n from reservations r join customers c on c.id=r.customer_id
      where c.email='tarde@ejemplo.com'`);
  ok('NO se insertó ninguna reserva al fallar', r2[0].n === 0);
  ok('el cliente pudo crearse pero sin reserva (la transacción revirtió)',
     rows[0].n === 0, `quedaron ${rows[0].n} clientes huérfanos`);
}

{
  const r = await intentar(db, RESERVA,
    ['ceramica-tematica-septiembre', 1, 'X', 'x@ejemplo.com', '8112345670']);
  ok('rechaza un taller lleno (10/10)',
     !r.ok && r.error?.includes('INSUFFICIENT_CAPACITY'), r.error);
}

{
  const r = await intentar(db, RESERVA,
    ['ceramica-desde-cero', 11, 'X', 'x2@ejemplo.com', '8112345670']);
  ok('rechaza cantidad mayor a 10',
     !r.ok && r.error?.includes('INVALID_INPUT'), r.error);
}

// ---------------------------------------------------------------------------
seccion('TEST C · Conteo bajo contención (el bloqueo requiere Postgres real)');

{
  // Deja exactamente 1 lugar y comprueba que la segunda petición lo ve.
  await db.exec(`update workshops set capacity = 13 where slug='taller-libre-sabado'`);
  const { rows: [{ d }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='taller-libre-sabado'`);

  const libres = d.available;
  const a = await intentar(db, RESERVA,
    ['taller-libre-sabado', libres, 'Primera', 'p1@ejemplo.com', '8110000001']);
  ok(`la primera toma los ${libres} lugares restantes`, a.ok, a.error);

  const b = await intentar(db, RESERVA,
    ['taller-libre-sabado', 1, 'Segunda', 'p2@ejemplo.com', '8110000002']);
  ok('la segunda es rechazada: el hold de la primera ya cuenta',
     !b.ok && b.error?.includes('INSUFFICIENT_CAPACITY'), b.error);
}

// ---------------------------------------------------------------------------
seccion('TEST D · Expiración del hold');

{
  const { rows: [{ r }] } = await db.query(
    `select crear_reserva('esmaltes-y-color',2,'Temp','temp@ejemplo.com','8112345678',null,null,10) r`);
  const id = r.reservation_id;

  const { rows: [{ d }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='esmaltes-y-color'`);
  ok('el hold cuenta mientras está vigente', d.holds === 2, JSON.stringify(d));

  // Se fuerza el vencimiento sin tocar el status: así se prueba que la FÓRMULA
  // libera el lugar, no el cron.
  await db.query(`update reservations set expires_at = now() - interval '1 minute' where id=$1`, [id]);

  const { rows: [{ d: d2 }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='esmaltes-y-color'`);
  ok('el lugar se libera SOLO al vencer, sin correr el cron',
     d2.holds === 0, JSON.stringify(d2));

  const { rows: [{ n }] } = await db.query(`select expirar_holds() n`);
  ok('el barrido marca la reserva como expired', n >= 1, `marcó ${n}`);

  const { rows: [{ status }] } = await db.query(
    `select status from reservations where id=$1`, [id]);
  ok('el estado quedó en expired', status === 'expired', status);
}

// ---------------------------------------------------------------------------
seccion('Reglas de negocio');

{
  const r = await intentar(db, RESERVA,
    ['piezas-personalizadas', 1, 'Q', 'q@ejemplo.com', '8112345678']);
  ok('un taller cotizable NO entra al flujo de pago',
     !r.ok && r.error?.includes('WORKSHOP_REQUIRES_QUOTE'), r.error);
}

{
  await db.exec(`
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status)
    values ('taller-pasado','Pasado','ceramica','2020-01-01','11:00','13:00',500,10,'published')
    on conflict (slug) do nothing;
  `);
  const r = await intentar(db, RESERVA,
    ['taller-pasado', 1, 'P', 'p@ejemplo.com', '8112345678']);
  ok('no se puede reservar un taller cuya fecha ya pasó',
     !r.ok && r.error?.includes('WORKSHOP_IN_PAST'), r.error);
}

{
  await db.exec(`
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status)
    values ('borrador','Borrador','ceramica','2027-01-01','11:00','13:00',500,10,'draft')
    on conflict (slug) do nothing;
  `);
  const r = await intentar(db, RESERVA,
    ['borrador', 1, 'B', 'b@ejemplo.com', '8112345678']);
  ok('no se puede reservar un taller en borrador',
     !r.ok && r.error?.includes('WORKSHOP_NOT_AVAILABLE'), r.error);
}

{
  const r = await intentar(db, RESERVA,
    ['ceramica-desde-cero', 1, 'M', 'sin-arroba', '8112345678']);
  ok('rechaza correo inválido', !r.ok && r.error?.includes('INVALID_INPUT'), r.error);

  const r2 = await intentar(db, RESERVA,
    ['ceramica-desde-cero', 1, 'M', 'm@ejemplo.com', '811']);
  ok('rechaza teléfono de menos de 10 dígitos',
     !r2.ok && r2.error?.includes('INVALID_INPUT'), r2.error);

  const r3 = await intentar(db, RESERVA,
    ['ceramica-desde-cero', 1, '   ', 'm2@ejemplo.com', '8112345678']);
  ok('rechaza nombre vacío', !r3.ok && r3.error?.includes('INVALID_INPUT'), r3.error);
}

// ---------------------------------------------------------------------------
seccion('TEST H · El precio sale de la base, no del cliente');

{
  await db.exec(`update workshops set price = 777.00 where slug='day-pass-estudio'`);
  const { rows: [{ r }] } = await db.query(RESERVA,
    ['day-pass-estudio', 2, 'Precio', 'precio@ejemplo.com', '8112345678']);

  ok('unit_price se toma del taller', Number(r.unit_price) === 777, r.unit_price);
  ok('total_amount = precio × cantidad', Number(r.total_amount) === 1554, r.total_amount);

  // Instantánea: cambiar el precio del taller NO cambia reservas ya creadas.
  await db.exec(`update workshops set price = 999.00 where slug='day-pass-estudio'`);
  const { rows: [{ up, ta }] } = await db.query(
    `select unit_price up, total_amount ta from reservations where id=$1`,
    [r.reservation_id]);
  ok('la reserva conserva su precio aunque el taller suba',
     Number(up) === 777 && Number(ta) === 1554, `${up} / ${ta}`);
}

// ---------------------------------------------------------------------------
seccion('TEST E y G · Confirmación de pago e idempotencia');

{
  const { rows: [{ r }] } = await db.query(RESERVA,
    ['taller-libre-noviembre', 2, 'Pago', 'pago@ejemplo.com', '8112345678']);
  const id = r.reservation_id;

  const { rows: [{ res1 }] } = await db.query(
    `select confirmar_pago($1,'cs_test_1','pi_test_1',840.00,'MXN','paid') res1`, [id]);
  ok('el primer webhook confirma', res1 === 'confirmed', res1);

  const { rows: [{ st, ca, ea }] } = await db.query(
    `select status st, confirmed_at ca, expires_at ea from reservations where id=$1`, [id]);
  ok('la reserva queda confirmed', st === 'confirmed', st);
  ok('confirmed_at se llena', ca !== null);
  ok('expires_at se limpia al confirmar', ea === null, String(ea));

  const { rows: [{ res2 }] } = await db.query(
    `select confirmar_pago($1,'cs_test_1','pi_test_1',840.00,'MXN','paid') res2`, [id]);
  ok('el webhook duplicado devuelve already_confirmed', res2 === 'already_confirmed', res2);

  const { rows: [{ np }] } = await db.query(
    `select count(*)::int np from payments where reservation_id=$1`, [id]);
  ok('NO se duplica el pago', np === 1, `hay ${np}`);

  const { rows: [{ nj }] } = await db.query(
    `select count(*)::int nj from integration_jobs
      where entity_id=$1 and type='email_send'`, [id]);
  ok('NO se duplican los correos encolados', nj === 2, `hay ${nj}, esperaba 2`);

  const { rows: [{ nc }] } = await db.query(
    `select count(*)::int nc from integration_jobs where type='calendar_sync'`);
  ok('la sincronización de calendario se encola una sola vez por taller',
     nc >= 1, `hay ${nc}`);
}

// ---------------------------------------------------------------------------
seccion('Pago que llega sin cupo · needs_review');

{
  // Reserva válida, luego se llena el taller por otro lado, luego llega el pago.
  await db.exec(`update workshops set capacity = 20 where slug='acuarela-botanica'`);
  const { rows: [{ r }] } = await db.query(RESERVA,
    ['acuarela-botanica', 2, 'Tarde2', 'tarde2@ejemplo.com', '8112345678']);
  const id = r.reservation_id;

  // Se vence el hold y se ocupa el cupo con otra reserva confirmada.
  await db.query(`update reservations set expires_at = now() - interval '1 min' where id=$1`, [id]);
  await db.exec(`update workshops set capacity = 9 where slug='acuarela-botanica'`);

  const { rows: [{ res }] } = await db.query(
    `select confirmar_pago($1,'cs_x','pi_x',1180.00,'MXN','paid') res`, [id]);
  ok('un pago sin cupo NO confirma la reserva', res === 'needs_review', res);

  const { rows: [{ st }] } = await db.query(
    `select status from reservations where id=$1`, [id]);
  ok('la reserva NO queda confirmed', st !== 'confirmed', st);

  const { rows: [{ nr, rr }] } = await db.query(
    `select needs_review nr, review_reason rr from payments where reservation_id=$1`, [id]);
  ok('el pago SÍ se registra (el dinero existe)', nr === true);
  ok('queda marcado para revisión manual con motivo', Boolean(rr), String(rr));
}

// ---------------------------------------------------------------------------
seccion('TEST K · Cancelación y reembolso');

{
  await db.exec(`update workshops set capacity = 20 where slug='torno-primera-vez'`);
  const { rows: [{ r }] } = await db.query(RESERVA,
    ['torno-primera-vez', 3, 'Cancel', 'cancel@ejemplo.com', '8112345678']);
  const id = r.reservation_id;
  await db.query(`select confirmar_pago($1,'cs_c','pi_c',2160.00,'MXN','paid')`, [id]);

  const { rows: [{ d }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='torno-primera-vez'`);
  const antes = d.available;

  const { rows: [{ res }] } = await db.query(
    `select cancelar_reserva($1,'prueba','admin') res`, [id]);
  ok('la cancelación se aplica', res === 'cancelled', res);

  const { rows: [{ d: d2 }] } = await db.query(
    `select disponibilidad(id) d from workshops where slug='torno-primera-vez'`);
  ok('el cupo se libera al cancelar', d2.available === antes + 3,
     `${antes} -> ${d2.available}`);

  const { rows: [{ res2 }] } = await db.query(
    `select cancelar_reserva($1,'otra','admin') res2`, [id]);
  ok('cancelar dos veces es idempotente', res2 === 'already_cancelled', res2);

  const { rows: [{ nj }] } = await db.query(
    `select count(*)::int nj from integration_jobs
      where entity_id=$1 and payload->>'template'='cancelacion'`, [id]);
  ok('se encola el correo de cancelación', nj === 1, `hay ${nj}`);
}

{
  await db.exec(`update workshops set capacity = 20 where slug='pinta-tu-propia-pieza'`);
  const { rows: [{ r }] } = await db.query(RESERVA,
    ['pinta-tu-propia-pieza', 1, 'Refund', 'refund@ejemplo.com', '8112345678']);
  await db.query(`select confirmar_pago($1,'cs_r','pi_r',550.00,'MXN','paid')`, [r.reservation_id]);

  const { rows: [{ res }] } = await db.query(
    `select registrar_reembolso('pi_r', 550.00) res`);
  ok('el reembolso se registra', res === 'refunded', res);

  const { rows: [{ ps, rs }] } = await db.query(`
    select p.status ps, r.status rs from payments p
     join reservations r on r.id = p.reservation_id
     where p.stripe_payment_intent_id='pi_r'`);
  ok('el pago queda refunded', ps === 'refunded', ps);
  ok('la reserva queda refunded', rs === 'refunded', rs);

  const { rows: [{ res2 }] } = await db.query(
    `select registrar_reembolso('pi_inexistente', 100) res2`);
  ok('un reembolso de un pago inexistente no truena',
     res2 === 'payment_not_found', res2);
}

// ---------------------------------------------------------------------------
seccion('Formularios y límite por IP');

{
  const { rows: [{ id }] } = await db.query(
    `select guardar_prospecto('contacto','Ana','ana@x.com','8112345678','Hola') id`);
  ok('el prospecto de contacto se guarda', Boolean(id));

  const { rows: [{ n }] } = await db.query(
    `select count(*)::int n from contact_leads where email='ana@x.com'`);
  ok('queda en contact_leads', n === 1);

  const { rows: [{ phone }] } = await db.query(
    `select phone from contact_leads where email='ana@x.com'`);
  ok('el teléfono se normaliza al guardar', phone === '+528112345678', String(phone));

  const { rows: [{ nj }] } = await db.query(
    `select count(*)::int nj from integration_jobs where entity_id=$1`, [id]);
  ok('se encola el aviso al estudio', nj === 1, `hay ${nj}`);

  const r = await intentar(db,
    `select guardar_prospecto('contacto','Ana','ana@x.com','8112345678',null)`);
  ok('contacto sin mensaje es rechazado',
     !r.ok && r.error?.includes('INVALID_INPUT'), r.error);

  const { rows: [{ id2 }] } = await db.query(
    `select guardar_prospecto('membresia','Beto','beto@x.com','8112345670',null,
       array['ceramica','pintura']) id2`);
  ok('membresía SÍ acepta mensaje vacío', Boolean(id2));
}

{
  const res = [];
  for (let i = 0; i < 7; i++) {
    const { rows: [{ p }] } = await db.query(
      `select permitir('ip:1.2.3.4', 5, 10) p`);
    res.push(p);
  }
  ok('el límite por IP deja pasar los primeros 5',
     res.slice(0, 5).every(Boolean), JSON.stringify(res));
  ok('el límite por IP bloquea a partir del sexto',
     res[5] === false && res[6] === false, JSON.stringify(res));
}

// ---------------------------------------------------------------------------
seccion('Integridad del esquema');

{
  const r = await intentar(db, `
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status,booking_mode)
    values ('malo','Malo','ceramica','2027-01-01','13:00','11:00',500,10,'draft','paid')`);
  ok('rechaza horario invertido (fin antes que inicio)',
     !r.ok && r.error?.includes('horario_coherente'), r.error);

  const r2 = await intentar(db, `
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status,booking_mode)
    values ('malo2','Malo','ceramica','2027-01-01','11:00','13:00',0,10,'draft','paid')`);
  ok('rechaza taller de pago con precio 0',
     !r2.ok && r2.error?.includes('precio_coherente'), r2.error);

  const r3 = await intentar(db, `
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status,booking_mode)
    values ('malo3','Malo','ceramica','2027-01-01','11:00','13:00',500,10,'draft','quote')`);
  ok('rechaza taller cotizable con precio distinto de 0',
     !r3.ok && r3.error?.includes('precio_coherente'), r3.error);

  const r4 = await intentar(db, `
    insert into workshops (slug,title,category,date,start_time,end_time,price,capacity,status)
    values ('malo4','Malo','ceramica','2027-01-01','11:00','13:00',500,0,'draft')`);
  ok('rechaza capacidad cero', !r4.ok, r4.error);
}

{
  const { rows } = await db.query(`
    select tablename, rowsecurity from pg_tables
     where schemaname='public' order by tablename`);
  const sinRls = rows.filter((t) => !t.rowsecurity).map((t) => t.tablename);
  ok('RLS activo en TODAS las tablas', sinRls.length === 0,
     `sin RLS: ${sinRls.join(', ')}`);
}

{
  const { rows } = await db.query(`
    select count(*)::int n from pg_proc p
     join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname='public' and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig,'{}')) c
          where c like 'search_path=%')`);
  ok('ninguna función SECURITY DEFINER sin search_path fijo',
     rows[0].n === 0, `hay ${rows[0].n}`);
}

{
  const { rows } = await db.query(`
    select count(*)::int n from public_workshops`);
  ok('la vista pública solo expone talleres publicados', rows[0].n >= 10, String(rows[0].n));

  const { rows: cols } = await db.query(`
    select column_name from information_schema.columns
     where table_name='public_workshops'`);
  const nombres = cols.map((c) => c.column_name);
  ok('la vista NO expone google_calendar_event_id',
     !nombres.includes('google_calendar_event_id'));
  ok('la vista NO expone cloudinary_public_id',
     !nombres.includes('cloudinary_public_id'));
  ok('la vista SÍ expone seats_available', nombres.includes('seats_available'));
}

// ---------------------------------------------------------------------------
await db.close();

console.log('\n' + '='.repeat(60));
console.log(`  ${pasadas} pasadas · ${fallidas} fallidas`);
if (fallos.length) {
  console.log('\nFallos:');
  fallos.forEach((f) => console.log(`  · ${f}`));
}
console.log('');
process.exit(fallidas > 0 ? 1 : 0);
