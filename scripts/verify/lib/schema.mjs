// Rebuilds the public schema of the local verification database from the repo.
//
// Production's schema is older than supabase/migrations/, so the migrations alone do not
// replay on an empty database. The order that reproduces it locally:
//   1. server/db.js initDb()          legacy base tables, as the Express server creates them
//   2. db/10-baseline-gaps.sql        the few objects production gained outside the repo
//   3. supabase/migrations/*.sql      in filename order, each with ON_ERROR_STOP
// Nothing here runs against a remote database: the URL is the local stack's.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SUPABASE, VERIFY_DIR, requireServer } from './config.mjs';

const { Client } = requireServer('pg');

const RESET_SQL = `
set client_min_messages = warning;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
do $$ begin perform cron.unschedule(jobid) from cron.job; exception when others then null; end $$;
`;

function psqlFile(file) {
  try {
    execFileSync('psql', [SUPABASE.dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = String(error.stderr ?? '');
    const detail = stderr.split('\n').filter((l) => /ERROR|DETAIL|CONTEXT|LINE/.test(l)).slice(0, 4).join(' | ');
    throw new Error(`${path.relative(ROOT, file)}: ${detail || stderr.slice(0, 400)}`);
  }
}

export async function rebuildSchema({ log = () => {} } = {}) {
  const started = Date.now();
  const db = new Client({ connectionString: SUPABASE.dbUrl });
  await db.connect();
  await db.query(RESET_SQL);
  await db.end();
  log('public schema reset');

  execFileSync(process.execPath, ['-e', "require('./db').ready().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })"], {
    cwd: path.join(ROOT, 'server'),
    env: { ...process.env, DATABASE_URL: SUPABASE.dbUrl, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  log('legacy initDb applied');

  psqlFile(path.join(VERIFY_DIR, 'db/10-baseline-gaps.sql'));
  const migrationsDir = path.join(ROOT, 'supabase/migrations');
  const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) psqlFile(path.join(migrationsDir, file));
  log(`${migrations.length} migrations applied`);
  return { migrations: migrations.length, ms: Date.now() - started };
}
