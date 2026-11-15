// Starts, stops and inspects the local verification stack.
//
//   docker      local Supabase (Postgres, Auth, PostgREST, Storage, Kong) via the Supabase CLI,
//               migrations disabled (schema.mjs rebuilds them), edge-runtime excluded
//   edge        supabase/functions/* under host Deno (edge/host.ts) with third-party fakes,
//               reached by Kong through a socat container named like the edge runtime
//   api         server/ (Express) on :3000
//   client      client/ (Vite dev server) on :5173, pointed at the local Supabase
//
// Process ids and log paths live in .run/state.json; logs in .run/logs/.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PORTS, ROOT, RUN_DIR, SUPABASE, TOOLS, VERIFY_DIR } from './config.mjs';

const LOG_DIR = path.join(RUN_DIR, 'logs');
const STATE_FILE = path.join(RUN_DIR, 'state.json');
export const FAKE_LOG = path.join(LOG_DIR, 'fakes.jsonl');
const EDGE_CONTAINER = 'supabase_edge_runtime_Riven';
const KONG_CONTAINER = 'supabase_kong_Riven';
const SUPABASE_EXCLUDE = 'studio,imgproxy,vector,logflare,supavisor,postgres-meta,mailpit,edge-runtime';

const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { procs: {} }; } };
const writeState = (s) => { fs.mkdirSync(RUN_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

export function portOpen(port, host = '127.0.0.1', timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function waitFor(check, { timeoutMs = 120_000, intervalMs = 500, what }) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const parseEnvFile = (file) => Object.fromEntries(
  fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

function startProc(name, cmd, args, { cwd = ROOT, env = {} } = {}) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, `${name}.log`);
  const out = fs.openSync(logFile, 'w');
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', out, out], detached: true });
  child.unref();
  const state = readState();
  state.procs[name] = { pid: child.pid, logFile, cmd: [cmd, ...args].join(' '), startedAt: new Date().toISOString() };
  writeState(state);
  return child.pid;
}

function stopProc(name) {
  const state = readState();
  const proc = state.procs[name];
  if (proc && alive(proc.pid)) {
    try { process.kill(-proc.pid, 'SIGTERM'); } catch { try { process.kill(proc.pid, 'SIGTERM'); } catch { /* gone */ } }
  }
  delete state.procs[name];
  writeState(state);
}

async function ensureDocker(log) {
  try { sh('docker', ['info']); return; } catch { /* not running */ }
  log('docker daemon not running; starting dockerd');
  startProc('dockerd', 'dockerd', []);
  await waitFor(() => { try { sh('docker', ['info']); return true; } catch { return false; } }, { what: 'dockerd', timeoutMs: 60_000 });
}

async function ensureSupabase(log) {
  if (await portOpen(PORTS.db) && await portOpen(PORTS.supabase)) return;
  log('starting local Supabase (first run pulls images, several minutes)');
  sh('npx', ['-y', TOOLS.supabaseCli, 'start', '-x', SUPABASE_EXCLUDE], {
    cwd: ROOT,
    env: {
      ...process.env,
      // Migrations are replayed by schema.mjs (they need the legacy baseline first).
      SUPABASE_DB_MIGRATIONS_ENABLED: 'false',
      SUPABASE_DB_SEED_ENABLED: 'false',
      // public.ecr.aws is unreachable from some sandboxes; Docker Hub mirrors the images.
      SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY ?? 'docker.io',
    },
    timeout: 1_200_000,
  });
}

async function startEdge(log) {
  stopProc('edge');
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(FAKE_LOG, '');
  const env = {
    ...parseEnvFile(path.join(VERIFY_DIR, 'edge/local.env')),
    RIVEN_EDGE_PORT: String(PORTS.edge),
    RIVEN_VERIFY_FAKE_LOG: FAKE_LOG,
  };
  if (!process.env.DENO_CERT && fs.existsSync('/root/.ccr/ca-bundle.crt')) env.DENO_CERT = '/root/.ccr/ca-bundle.crt';
  const deno = commandExists('deno') ? ['deno'] : ['npx', '-y', TOOLS.deno];
  startProc('edge', deno[0], [...deno.slice(1), 'run', '-A', '--config', 'scripts/verify/edge/deno.json', 'scripts/verify/edge/host.ts'], { env });
  await waitFor(() => portOpen(PORTS.edge), { what: 'edge host', timeoutMs: 180_000 });

  // Kong routes /functions/v1/* to http://supabase_edge_runtime_Riven:8081.
  try { sh('docker', ['rm', '-f', EDGE_CONTAINER]); } catch { /* absent */ }
  sh('docker', ['run', '-d', '--name', EDGE_CONTAINER, '--network', 'supabase_network_Riven',
    '--add-host', 'host.docker.internal:host-gateway', TOOLS.socatImage,
    'TCP-LISTEN:8081,fork,reuseaddr', `TCP:host.docker.internal:${PORTS.edge}`]);
  sh('docker', ['restart', KONG_CONTAINER]); // Kong caches a failed lookup of the edge host.
  await waitFor(async () => {
    const res = await fetch(`${SUPABASE.url}/functions/v1/ai-limits`).catch(() => null);
    return res?.status === 401;
  }, { what: 'functions through Kong', timeoutMs: 180_000 });
  log('edge functions ready');
}

function commandExists(cmd) { try { sh('which', [cmd]); return true; } catch { return false; } }

async function startApi(log) {
  stopProc('api');
  startProc('api', process.execPath, ['index.js'], {
    cwd: path.join(ROOT, 'server'),
    env: {
      NODE_ENV: 'development', PORT: String(PORTS.api), HOST: '127.0.0.1',
      DATABASE_URL: SUPABASE.dbUrl, RIVEN_SKIP_DB_INIT: 'true',
      JWT_SECRET: 'riven-verify-local-jwt-secret-0123456789',
      SUPABASE_URL: SUPABASE.url, SUPABASE_ANON_KEY: SUPABASE.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE.serviceKey, SUPABASE_JWT_SECRET: SUPABASE.jwtSecret,
      FRONTEND_URL: `http://localhost:${PORTS.client}`, CLIENT_URL: `http://localhost:${PORTS.client}`,
      ALLOWED_ORIGINS: `http://localhost:${PORTS.client},http://127.0.0.1:${PORTS.client}`,
    },
  });
  await waitFor(() => portOpen(PORTS.api), { what: 'api :3000', timeoutMs: 60_000 });
  log('api ready');
}

async function startClient(log) {
  stopProc('client');
  startProc('client', 'npx', ['vite', '--host', '127.0.0.1', '--port', String(PORTS.client), '--strictPort'], {
    cwd: path.join(ROOT, 'client'),
    env: {
      VITE_SUPABASE_URL: SUPABASE.url, VITE_SUPABASE_ANON_KEY: SUPABASE.anonKey,
      VITE_ENABLE_LEGACY_AUTH_BRIDGE: 'false', VITE_SKIP_TURNSTILE: 'true',
      // Must match STRIPE_PRICE_* in edge/local.env (create-checkout allow-lists them).
      VITE_STRIPE_PRICE_MONTHLY: 'price_local_monthly', VITE_STRIPE_PRICE_ANNUAL: 'price_local_annual',
      // Keep telemetry off locally.
      VITE_SENTRY_DSN: '', VITE_PUBLIC_POSTHOG_KEY: '',
    },
  });
  await waitFor(() => portOpen(PORTS.client), { what: 'client :5173', timeoutMs: 120_000 });
  log('client ready');
}

export async function up({ log = () => {}, only } = {}) {
  const want = (name) => !only || only.includes(name);
  if (want('supabase')) { await ensureDocker(log); await ensureSupabase(log); }
  if (want('edge')) await startEdge(log);
  if (want('api')) await startApi(log);
  if (want('client')) await startClient(log);
  return status();
}

export async function down({ supabase = false } = {}) {
  for (const name of ['client', 'api', 'edge']) stopProc(name);
  try { sh('docker', ['rm', '-f', EDGE_CONTAINER]); } catch { /* absent */ }
  if (supabase) sh('npx', ['-y', TOOLS.supabaseCli, 'stop', '--no-backup'], { cwd: ROOT, timeout: 300_000 });
  return status();
}

export async function status() {
  const state = readState();
  const procs = Object.fromEntries(Object.entries(state.procs).map(([k, v]) => [k, { ...v, alive: alive(v.pid) }]));
  const ports = {};
  for (const [name, port] of Object.entries(PORTS)) ports[name] = { port, open: await portOpen(port) };
  return { ports, procs, logs: LOG_DIR };
}

export function logFile(name) {
  if (name === 'fakes') return FAKE_LOG;
  return readState().procs[name]?.logFile ?? path.join(LOG_DIR, `${name}.log`);
}
