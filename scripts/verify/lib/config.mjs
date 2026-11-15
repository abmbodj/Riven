// Shared constants for the riven-verify CLI. Everything here is local-only.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERIFY_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(VERIFY_DIR, '../..');
export const RUN_DIR = path.join(VERIFY_DIR, '.run');
export const EVIDENCE_DIR = path.join(ROOT, 'client/test-results/riven-verify');

export const PORTS = { client: 5173, api: 3000, supabase: 54321, db: 54322, edge: 54331 };

// Supabase CLI public demo credentials: identical on every machine, valid only for a
// local stack (see `supabase status -o env`).
export const SUPABASE = {
  url: `http://127.0.0.1:${PORTS.supabase}`,
  dbUrl: `postgresql://postgres:postgres@127.0.0.1:${PORTS.db}/postgres`,
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  jwtSecret: 'super-secret-jwt-token-with-at-least-32-characters-long',
};

// Pinned tool versions (fetched with npx on first use; not project dependencies).
export const TOOLS = {
  supabaseCli: 'supabase@2.99.0',
  deno: 'deno@2.5.6',
  socatImage: 'alpine/socat:1.8.0.3',
};

export const PASSWORD = 'riven-local-pass-1';

// Seeded accounts. `key` is what journeys and `riven-verify login --as` use.
export const USERS = {
  student: { email: 'student@riven.test', username: 'sam_student', displayName: 'Sam Student', tier: 'free', onboarded: true },
  pro: { email: 'pro@riven.test', username: 'pat_pro', displayName: 'Pat Pro', tier: 'supporter', onboarded: true },
  newbie: { email: 'new@riven.test', username: 'nia_new', displayName: 'Nia New', tier: 'free', onboarded: false },
};

// Resolve packages the repo already installs (no extra dependencies for the CLI).
const fromClient = createRequire(path.join(ROOT, 'client/package.json'));
const fromServer = createRequire(path.join(ROOT, 'server/package.json'));
export const requireClient = (name) => fromClient(name);
export const requireServer = (name) => fromServer(name);
