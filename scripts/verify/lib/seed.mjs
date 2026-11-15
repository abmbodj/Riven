// Deterministic seed for the local verification stack.
//
// 1. Wipes app data (public schema rows, seeded auth users, cached ai jobs).
// 2. Creates each seeded auth user with the GoTrue admin API, signs in, and calls the
//    real `complete-registration` edge function, so the users row, default themes and
//    preset tags are created by the same code as a production sign-up.
// 3. Applies fixture rows (classes, decks, cards, notes, assignments) and per-user
//    state (tier, onboarding) with SQL.
// Re-running gives the same users (ids 1..n in USERS order) and the same content.
import fs from 'node:fs';
import path from 'node:path';
import { PASSWORD, SUPABASE, USERS, VERIFY_DIR, requireServer } from './config.mjs';

const { Client } = requireServer('pg');

async function http(method, url, { body, token, apikey = SUPABASE.anonKey } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', apikey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

export async function signIn(email, password = PASSWORD) {
  return http('POST', `${SUPABASE.url}/auth/v1/token?grant_type=password`, { body: { email, password } });
}

async function wipe(db) {
  const { rows } = await db.query(`select tablename from pg_tables where schemaname = 'public'`);
  if (rows.length) {
    await db.query(`truncate ${rows.map((r) => `public."${r.tablename}"`).join(', ')} restart identity cascade`);
  }
  await db.query(`delete from auth.users where email like '%@riven.test'`);
  await db.query(`delete from storage.objects where owner_id is not null or name like 'riven-verify/%'`).catch(() => {});
}

async function createAuthUser(user) {
  return http('POST', `${SUPABASE.url}/auth/v1/admin/users`, {
    apikey: SUPABASE.serviceKey,
    token: SUPABASE.serviceKey,
    body: { email: user.email, password: PASSWORD, email_confirm: true, user_metadata: { username: user.username, display_name: user.displayName } },
  });
}

export async function seed({ log = () => {} } = {}) {
  const db = new Client({ connectionString: SUPABASE.dbUrl });
  await db.connect();
  try {
    await wipe(db);
    log('wiped');
    const ids = {};
    for (const [key, user] of Object.entries(USERS)) {
      await createAuthUser(user);
      const session = await signIn(user.email);
      const reg = await http('POST', `${SUPABASE.url}/functions/v1/complete-registration`, { token: session.access_token, body: { username: user.username } });
      ids[key] = reg.user.id;
      log(`registered ${key} as users.id=${reg.user.id}`);
    }
    const fixtures = fs.readFileSync(path.join(VERIFY_DIR, 'db/20-seed-fixtures.sql'), 'utf8');
    await db.query(fixtures);
    log('fixtures applied');
    const { rows: counts } = await db.query(`
      select (select count(*) from public.users)::int as users, (select count(*) from public.classes)::int as classes,
             (select count(*) from public.decks)::int as decks, (select count(*) from public.cards)::int as cards,
             (select count(*) from public.notes)::int as notes`);
    return { users: ids, counts: counts[0] };
  } finally {
    await db.end();
  }
}
