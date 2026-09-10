// ---------------------------------------------------------------------------
// Arnés de pruebas contra PostgreSQL real (PGlite = Postgres compilado a WASM)
// ---------------------------------------------------------------------------
// Corre las migraciones de verdad, no una imitación. Lo que Supabase aporta y
// PGlite no —el esquema `auth`, los roles, pg_cron— se sustituye por stubs
// mínimos, y las migraciones que dependen de esa infraestructura se saltan.
//
//   node supabase/tests/harness.mjs
// ---------------------------------------------------------------------------

import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

// Migraciones que dependen de infraestructura exclusiva de Supabase.
const SALTAR = ['20260909100500_cron.sql'];

export async function crearBase({ conSeed = true, silencioso = true } = {}) {
  const db = new PGlite({ extensions: { citext } });

  // -- Stubs de Supabase ----------------------------------------------------
  // auth.users existe en Supabase; aquí se recrea lo mínimo para que las
  // llaves foráneas y auth.uid() funcionen igual.
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique
    );
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
    end
    $$;
  `);

  // -- Migraciones reales ---------------------------------------------------
  const dir = join(RAIZ, 'migrations');
  const archivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const archivo of archivos) {
    if (SALTAR.includes(archivo)) {
      if (!silencioso) console.log(`  · ${archivo} (saltada: requiere pg_cron/pg_net)`);
      continue;
    }
    const sql = readFileSync(join(dir, archivo), 'utf8');
    try {
      await db.exec(sql);
      if (!silencioso) console.log(`  ✓ ${archivo}`);
    } catch (e) {
      console.error(`\n  ✗ ${archivo}\n    ${e.message}\n`);
      throw e;
    }
  }

  if (conSeed) {
    const seed = readFileSync(join(RAIZ, 'seed.sql'), 'utf8');
    try {
      await db.exec(seed);
      if (!silencioso) console.log('  ✓ seed.sql');
    } catch (e) {
      console.error(`\n  ✗ seed.sql\n    ${e.message}\n`);
      throw e;
    }
  }

  return db;
}

// Ejecutado directamente: solo comprueba que todo aplica.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('\nAplicando migraciones sobre PostgreSQL real (PGlite)…\n');
  const db = await crearBase({ silencioso: false });

  const { rows: tablas } = await db.query(`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name;
  `);
  const { rows: funcs } = await db.query(`
    select proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by proname;
  `);
  const { rows: talleres } = await db.query('select count(*)::int n from workshops');

  console.log(`\n  Tablas:     ${tablas.length}`);
  console.log(`  Funciones:  ${funcs.length}`);
  console.log(`  Talleres:   ${talleres[0].n}`);
  console.log('\n  TODAS LAS MIGRACIONES APLICAN CORRECTAMENTE\n');
  await db.close();
}
