// verify-riven harness: drives the real Riven SPA (fixture build) in Chromium and
// stands in for Supabase at the network boundary with an in-memory PostgREST.
// Every write the app makes is recorded so a journey can prove side effects.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AUTH_USER_ID, defaultSeed } from './seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const CLIENT = path.join(ROOT, 'client');
const require = createRequire(path.join(CLIENT, 'package.json'));
const { chromium } = require('playwright');
export const { expect } = require('@playwright/test');

const RUN = path.join(CLIENT, 'test-results/verify-riven/.run');
const EVIDENCE_ROOT = path.join(CLIENT, 'test-results/verify-riven');
const SUPABASE = 'https://example.supabase.co';

const portFile = path.join(RUN, 'port');
export const BASE_URL = `http://127.0.0.1:${process.env.RIVEN_VERIFY_PORT || (existsSync(portFile) ? readFileSync(portFile, 'utf8').trim() : '4174')}`;

// ---------- fake Supabase auth session ----------
// supabase-js reads its session from localStorage key sb-<project-ref>-auth-token.
// The JWT is unsigned (the fake never verifies it); the app only checks aud/sub/exp.
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function fakeSession(user) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const authUser = { id: AUTH_USER_ID, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'email' }, user_metadata: { app_user_id: user.id } };
    const access_token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: authUser.id, aud: 'authenticated', role: 'authenticated', exp, email: user.email })}.verify-riven`;
    return { access_token, refresh_token: 'verify-riven-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: authUser };
}

// ---------- fake PostgREST ----------
function parseValue(raw) {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
}
function matches(row, col, expr) {
    const negate = expr.startsWith('not.');
    if (negate) expr = expr.slice(4);
    const dot = expr.indexOf('.');
    const op = expr.slice(0, dot);
    const raw = expr.slice(dot + 1);
    const v = row[col];
    let r;
    switch (op) {
        case 'eq': r = String(v) === raw; break;
        case 'neq': r = String(v) !== raw; break;
        case 'is': r = (parseValue(raw) === null ? v == null : v === parseValue(raw)); break;
        case 'in': r = raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v)); break;
        case 'gt': r = v > raw || Number(v) > Number(raw); break;
        case 'gte': r = v >= raw || Number(v) >= Number(raw); break;
        case 'lt': r = v < raw || Number(v) < Number(raw); break;
        case 'lte': r = v <= raw || Number(v) <= Number(raw); break;
        case 'like': case 'ilike': {
            const re = new RegExp('^' + raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', op === 'ilike' ? 'i' : '');
            r = re.test(String(v ?? '')); break;
        }
        default: return { unsupported: `${col}=${expr}` };
    }
    return negate ? !r : r;
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function filterRows(rows, params, unsupported) {
    return rows.filter((row) => {
        for (const [k, v] of params) {
            if (RESERVED.has(k)) continue;
            if (k === 'or' || k === 'and') { unsupported.add(`${k}=${v}`); continue; }
            const m = matches(row, k, v);
            if (m && typeof m === 'object') { unsupported.add(m.unsupported); continue; }
            if (!m) return false;
        }
        return true;
    });
}
function orderRows(rows, order) {
    if (!order) return rows;
    const keys = order.split(',').map((part) => { const [col, dir] = part.split('.'); return { col, desc: dir === 'desc' }; });
    return [...rows].sort((a, b) => {
        for (const { col, desc } of keys) {
            if (a[col] === b[col]) continue;
            if (a[col] == null) return 1;
            if (b[col] == null) return -1;
            return (a[col] < b[col] ? -1 : 1) * (desc ? -1 : 1);
        }
        return 0;
    });
}

export function createFakeSupabase(seed) {
    const tables = structuredClone(seed.tables);
    const state = {};
    const writes = [];      // { table, op, rows|patch, filter }
    const calls = [];       // every request to the fake, for the evidence log
    const unsupported = new Set();
    let nextId = 10_000;

    async function handle(route) {
        const req = route.request();
        const url = new URL(req.url());
        const method = req.method();
        const body = (() => { try { return req.postDataJSON(); } catch { return req.postData(); } })();
        const accept = req.headers()['accept'] || '';
        const prefer = req.headers()['prefer'] || '';
        const call = { method, path: decodeURIComponent(url.pathname + url.search), body, status: 200 };
        const json = (status, data, headers = {}) => (call.status = status, route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(data) }));
        calls.push(call);

        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

        const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/);
        if (rpc) {
            const fn = seed.rpc?.[rpc[1]];
            if (!fn) unsupported.add(`rpc ${rpc[1]}`);
            if (rpc[1] && /^(insert|update|delete|create|record|save|set|complete|award)/.test(rpc[1])) writes.push({ op: 'rpc', name: rpc[1], body });
            return json(200, fn ? await fn(body, { tables, state }) : []);
        }

        const fnMatch = url.pathname.match(/^\/functions\/v1\/([^/]+)/);
        if (fnMatch) {
            const fn = seed.edge?.[fnMatch[1]];
            if (!fn) unsupported.add(`edge ${fnMatch[1]}`);
            writes.push({ op: 'edge', name: fnMatch[1], method, body });
            return json(200, fn ? await fn(body, state, { tables, query: Object.fromEntries(url.searchParams) }) : {});
        }

        if (url.pathname.startsWith('/auth/v1/')) {
            if (url.pathname === '/auth/v1/user') return json(200, seed.session.user);
            if (url.pathname === '/auth/v1/token') return json(200, seed.session);
            if (url.pathname === '/auth/v1/logout') { writes.push({ op: 'auth', name: 'logout' }); return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
            unsupported.add(`auth ${url.pathname}`);
            return json(200, {});
        }

        const rest = url.pathname.match(/^\/rest\/v1\/([^/]+)$/);
        if (!rest) {
            unsupported.add(`${method} ${url.pathname}`);
            return json(200, url.pathname.startsWith('/auth/') ? {} : []);
        }
        const table = rest[1];
        if (!tables[table]) { unsupported.add(`table ${table}`); tables[table] = []; }
        const params = [...url.searchParams];
        const single = accept.includes('vnd.pgrst.object');
        const wantCount = /count=(exact|planned|estimated)/.test(prefer);
        const reply = (rows) => {
            const headers = wantCount || method === 'HEAD' ? { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {};
            if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', ...headers } });
            if (single) {
                if (rows.length !== 1) return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
                return json(200, rows[0], headers);
            }
            return json(200, rows, headers);
        };

        if (method === 'GET' || method === 'HEAD') {
            let rows = orderRows(filterRows(tables[table], params, unsupported), url.searchParams.get('order'));
            const offset = Number(url.searchParams.get('offset') || 0);
            const limit = url.searchParams.get('limit');
            rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
            return reply(rows);
        }
        if (method === 'POST') {
            const now = new Date().toISOString();
            const input = Array.isArray(body) ? body : [body];
            const inserted = input.map((r) => ({ id: nextId++, created_at: now, updated_at: now, ...r }));
            tables[table].push(...inserted);
            writes.push({ table, op: 'insert', rows: inserted });
            return prefer.includes('return=representation') ? reply(inserted) : route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
        }
        if (method === 'PATCH') {
            const hit = filterRows(tables[table], params, unsupported);
            hit.forEach((row) => Object.assign(row, body));
            writes.push({ table, op: 'update', filter: params.filter(([k]) => !RESERVED.has(k)), patch: body, count: hit.length });
            return prefer.includes('return=representation') ? reply(hit) : route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        if (method === 'DELETE') {
            const hit = filterRows(tables[table], params, unsupported);
            tables[table] = tables[table].filter((row) => !hit.includes(row));
            writes.push({ table, op: 'delete', filter: params.filter(([k]) => !RESERVED.has(k)), count: hit.length });
            return prefer.includes('return=representation') ? reply(hit) : route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        }
        unsupported.add(`${method} ${url.pathname}`);
        return json(405, { message: 'fake supabase: method not handled' });
    }

    return { tables, state, writes, calls, unsupported, handle };
}

// ---------- session ----------
export async function openRiven({ journey, seed = defaultSeed(), viewport = { width: 1440, height: 900 }, trace = true } = {}) {
    if (!journey) throw new Error('openRiven({ journey }) is required: it names the evidence folder');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(EVIDENCE_ROOT, `${stamp}-${journey}`);
    mkdirSync(outDir, { recursive: true });

    const executablePath = process.env.RIVEN_VERIFY_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
    const browser = await chromium.launch({ executablePath });
    const context = await browser.newContext({ viewport, baseURL: BASE_URL, serviceWorkers: 'block' });
    if (trace) await context.tracing.start({ screenshots: true, snapshots: true });
    const fake = createFakeSupabase(seed);
    const consoleLines = [];
    const external = new Set();

    seed.session ??= fakeSession(seed.user);
    await context.addInitScript(({ fixtures, session }) => {
        window.__RIVEN_E2E_FIXTURES__ = fixtures;
        if (!sessionStorage.getItem('__verify_riven_seeded__')) {
            sessionStorage.setItem('__verify_riven_seeded__', '1');
            localStorage.setItem('riven_auth_persistence', 'local');
            localStorage.setItem('sb-example-auth-token', JSON.stringify(session));
        }
    }, { fixtures: seed.fixtures, session: seed.session });
    // Registered first: Playwright tries the most recently added route first, so the
    // specific Supabase/API routes below win. Everything else off-box (fonts,
    // analytics, Sentry) is cut so runs are offline and deterministic.
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { external.add(new URL(route.request().url()).host); return route.abort(); });
    await context.route(`${SUPABASE}/**`, fake.handle);
    // Legacy Express bridge (server/): only /auth/me is needed for client writes (getAppUserId).
    await context.route(`${BASE_URL}/api/**`, (route) => {
        const p = new URL(route.request().url()).pathname;
        fake.calls.push({ method: route.request().method(), path: p, body: null });
        if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(seed.user) });
        if (p === '/api/csrf') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrfToken: 'verify' }) });
        fake.unsupported.add(`express ${p}`);
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not stubbed"}' });
    });

    const page = await context.newPage();
    page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));

    let shotN = 0;
    const steps = [];
    const ctx = {
        page, fake, outDir, expect,
        writes: fake.writes,
        async shot(name) {
            const file = path.join(outDir, `${String(++shotN).padStart(2, '0')}-${name}.png`);
            await page.screenshot({ path: file, fullPage: false });
            return file;
        },
        async step(name, fn) {
            const started = Date.now();
            try {
                await fn();
                steps.push({ name, ok: true, ms: Date.now() - started });
                await ctx.shot(name.replace(/\W+/g, '-').toLowerCase());
            } catch (err) {
                steps.push({ name, ok: false, ms: Date.now() - started, error: String(err?.message || err).split('\n').slice(0, 6).join('\n') });
                await ctx.shot(`FAILED-${name.replace(/\W+/g, '-').toLowerCase()}`).catch(() => {});
                throw err;
            }
        },
        async close({ notes } = {}) {
            if (trace) await context.tracing.stop({ path: path.join(outDir, 'trace.zip') }).catch(() => {});
            await browser.close();
            const ok = steps.length > 0 && steps.every((s) => s.ok);
            writeFileSync(path.join(outDir, 'writes.json'), JSON.stringify(fake.writes, null, 2));
            writeFileSync(path.join(outDir, 'requests.log'), fake.calls.map((c) => `${c.status ?? '   '} ${c.method} ${c.path}${c.body ? '  ' + JSON.stringify(c.body).slice(0, 300) : ''}`).join('\n') + '\n');
            writeFileSync(path.join(outDir, 'console.log'), consoleLines.join('\n') + '\n');
            const summary = { journey, ok, baseUrl: BASE_URL, steps, unstubbed: [...fake.unsupported], blockedExternalHosts: [...external], notes: notes || null };
            writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
            console.log(`${ok ? 'PASS' : 'FAIL'} ${journey}  evidence: ${path.relative(ROOT, outDir)}`);
            for (const s of steps) console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.error ? '\n       ' + s.error.replace(/\n/g, '\n       ') : ''}`);
            if (fake.unsupported.size) console.log(`  unstubbed (answered with empty data): ${[...fake.unsupported].join(', ')}`);
            return summary;
        },
    };
    return ctx;
}

// Run a journey body with evidence + exit code handled. Journey files call this.
export async function runJourney(journey, body, options = {}) {
    const ctx = await openRiven({ journey, ...options });
    let error;
    try { await body(ctx); } catch (err) { error = err; }
    const summary = await ctx.close();
    if (error && !summary.steps.some((s) => !s.ok)) console.error(error);
    process.exitCode = summary.ok && !error ? 0 : 1;
}
