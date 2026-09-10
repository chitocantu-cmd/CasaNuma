// ===========================================================================
// Servidor de vista previa local — SOLO PARA DESARROLLO
// ---------------------------------------------------------------------------
// Levanta la base REAL (las mismas migraciones y el mismo seed) sobre PGlite y
// la expone con la forma que espera supabase-js, para poder ver el sitio
// funcionando sin tener credenciales de Supabase todavía.
//
// NO es parte de producción. No implementa RLS, no verifica nada, y solo
// entiende las consultas que hace este frontend.
//
//   node dev/preview-server.mjs
// ===========================================================================

import { createServer } from 'node:http';
import { crearBase } from '../supabase/tests/harness.mjs';

const PUERTO = 54321;
const HOLD_MINUTOS = 10;

const db = await crearBase({ silencioso: true });
console.log('Base local lista (migraciones + seed reales)');

// ---------------------------------------------------------------------------
// Traducción mínima de PostgREST a SQL
// ---------------------------------------------------------------------------
const OPERADORES = {
  eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=',
};

function construirConsulta(tabla, params) {
  const where = [];
  const valores = [];
  let orden = '';
  let limite = '';

  for (const [clave, valor] of params.entries()) {
    if (clave === 'select' || clave === 'apikey') continue;

    if (clave === 'order') {
      const [col, dir = 'asc'] = valor.split('.');
      if (/^[a-z_]+$/.test(col)) {
        orden = ` order by ${col} ${dir.startsWith('desc') ? 'desc' : 'asc'}`;
      }
      continue;
    }
    if (clave === 'limit') {
      limite = ` limit ${parseInt(valor, 10) || 100}`;
      continue;
    }

    const m = valor.match(/^(\w+)\.(.*)$/);
    if (m && OPERADORES[m[1]] && /^[a-z_]+$/.test(clave)) {
      valores.push(m[2]);
      where.push(`${clave} ${OPERADORES[m[1]]} $${valores.length}`);
    }
  }

  const sql = `select * from ${tabla}`
    + (where.length ? ` where ${where.join(' and ')}` : '')
    + orden + limite;
  return { sql, valores };
}

// ---------------------------------------------------------------------------
function json(res, cuerpo, estado = 200) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(estado, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Range': '0-0/*',
  });
  res.end(texto);
}

async function leerCuerpo(req) {
  const trozos = [];
  for await (const t of req) trozos.push(t);
  if (!trozos.length) return {};
  try { return JSON.parse(Buffer.concat(trozos).toString()); }
  catch { return {}; }
}

// ---------------------------------------------------------------------------
const servidor = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  const ruta = url.pathname;
  // supabase-js pide un objeto en vez de arreglo cuando se usa .single()
  const unSoloObjeto = (req.headers.accept ?? '').includes('pgrst.object');

  try {
    // --- Lecturas: /rest/v1/<tabla> --------------------------------------
    if (ruta.startsWith('/rest/v1/') && req.method === 'GET') {
      const tabla = ruta.replace('/rest/v1/', '');
      if (!/^[a-z_]+$/.test(tabla)) return json(res, { message: 'tabla inválida' }, 400);

      const { sql, valores } = construirConsulta(tabla, url.searchParams);
      const { rows } = await db.query(sql, valores);
      return json(res, unSoloObjeto ? (rows[0] ?? null) : rows);
    }

    // --- RPC: /rest/v1/rpc/<funcion> -------------------------------------
    if (ruta.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
      const fn = ruta.replace('/rest/v1/rpc/', '');
      if (!/^[a-z_]+$/.test(fn)) return json(res, { message: 'función inválida' }, 400);

      const args = await leerCuerpo(req);
      const nombres = Object.keys(args);
      const marcadores = nombres.map((n, i) => `${n} => $${i + 1}`).join(', ');
      const { rows } = await db.query(
        `select ${fn}(${marcadores}) as r`, nombres.map((n) => args[n]),
      );
      return json(res, rows[0]?.r ?? null);
    }

    // --- Edge Functions --------------------------------------------------
    if (ruta.startsWith('/functions/v1/')) {
      const fn = ruta.replace('/functions/v1/', '');
      const cuerpo = await leerCuerpo(req);

      if (fn === 'create-reservation') {
        try {
          const { rows } = await db.query(
            `select crear_reserva($1,$2,$3,$4,$5,$6,$7,$8) r`,
            [cuerpo.slug, cuerpo.quantity, cuerpo.full_name, cuerpo.email,
             cuerpo.phone, cuerpo.companions ?? null, cuerpo.notes ?? null,
             HOLD_MINUTOS],
          );
          return json(res, rows[0].r);
        } catch (e) {
          const mapa = {
            CN001: [409, 'INSUFFICIENT_CAPACITY'],
            CN002: [404, 'WORKSHOP_NOT_AVAILABLE'],
            CN003: [400, 'WORKSHOP_REQUIRES_QUOTE'],
            CN004: [400, 'INVALID_INPUT'],
            CN006: [409, 'WORKSHOP_IN_PAST'],
          };
          const [estado, code] = mapa[e.code] ?? [500, 'INTERNAL_ERROR'];
          return json(res, {
            error: code,
            available: e.code === 'CN001' ? Number(e.detail ?? 0) : undefined,
            message: e.detail ?? e.message,
          }, estado);
        }
      }

      if (fn === 'create-checkout-session') {
        // Stripe no está conectado en la vista previa. Se responde con el
        // mismo error que usaría el backend real, para que el modal muestre
        // su mensaje de siempre en vez de romperse.
        return json(res, {
          error: 'PAYMENT_UNAVAILABLE',
          message: 'Vista previa local: Stripe todavía no está conectado. La reserva SÍ se creó.',
        }, 502);
      }

      if (fn === 'submit-form') {
        try {
          const { rows } = await db.query(
            `select guardar_prospecto($1,$2,$3,$4,$5,$6) id`,
            [cuerpo.tipo, cuerpo.name, cuerpo.email, cuerpo.phone ?? null,
             cuerpo.message ?? null, cuerpo.interests ?? []],
          );
          return json(res, { ok: true, id: rows[0].id });
        } catch (e) {
          return json(res, { error: 'INVALID_INPUT', message: e.detail ?? e.message }, 400);
        }
      }

      if (fn === 'reservation-status') {
        const { rows } = await db.query(
          `select consultar_reserva($1,$2) r`, [cuerpo.reservation_code, cuerpo.email]);
        if (!rows[0].r) return json(res, { error: 'RESERVATION_NOT_FOUND' }, 404);
        return json(res, rows[0].r);
      }

      return json(res, { error: 'NOT_IMPLEMENTED', message: `${fn} no está en la vista previa` }, 501);
    }

    // --- Auth: el panel no se puede usar sin Supabase real ---------------
    if (ruta.startsWith('/auth/v1/')) {
      return json(res, { error: 'not_implemented',
        error_description: 'El panel requiere Supabase real.' }, 501);
    }

    return json(res, { message: 'no encontrado' }, 404);
  } catch (e) {
    console.error('  error:', e.message);
    return json(res, { message: e.message }, 500);
  }
});

servidor.listen(PUERTO, () => {
  console.log(`\n  Backend de vista previa en http://localhost:${PUERTO}`);
  console.log('  Datos reales: 11 talleres, cupos calculados por la BD\n');
});
