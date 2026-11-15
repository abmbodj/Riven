#!/usr/bin/env node
// Exhaustive delivery-order check for the RevenueCat webhook -> premium access path.
//
// For each scenario (a real RevenueCat event timeline for one subscriber) and each
// starting user, this runs the REAL processRevenueCatWebhookEvent + isPremiumActive
// over EVERY delivery order with every event delivered once or twice (retries),
// then applies one pass of the daily reconcile job, and checks the properties below.
//
//   node .claude/skills/verify-entitlements/check.mjs              # check against baseline
//   node .claude/skills/verify-entitlements/check.mjs --all        # print every counterexample
//   node .claude/skills/verify-entitlements/check.mjs --self-test  # prove each property can fail
//   node .claude/skills/verify-entitlements/check.mjs --module <dir>  # check a copy of _shared/
//
// Exit: 0 = failures match baseline.json exactly; 1 = new failure; 2 = a baseline
// finding no longer reproduces (fixed? update baseline.json after confirming).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SHARED = path.join(ROOT, 'supabase/functions/_shared');
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const at = (days) => T0 + days * DAY;
const dayOf = (iso) => {
    if (iso == null) return 'none';
    const d = (Date.parse(iso) - T0) / DAY;
    const whole = Math.floor(d + 1e-9);
    const hours = Math.round((d - whole) * 24);
    return `day ${whole}${hours ? ` +${hours}h` : ''}`;
};
const H = 1 / 24;

// ---------- scenarios: provider truth, in the order RevenueCat emits ----------
// exp = expiration_at_ms in days; `activeAt(now)` is RevenueCat's own answer at `now`.
const ev = (type, day, exp) => ({ type, event_timestamp_ms: at(day), ...(exp != null ? { expiration_at_ms: at(exp) } : {}) });
const SCENARIOS = [
    { id: 'new-purchase', story: 'buys monthly on day 0', now: 10, activeAtNow: true,
        events: [ev('INITIAL_PURCHASE', 0, 30)] },
    { id: 'renewal', story: 'buys monthly on day 0, renews on day 30', now: 45, activeAtNow: true,
        events: [ev('INITIAL_PURCHASE', 0, 30), ev('RENEWAL', 30, 60)] },
    // Realistic reorder: the EXPIRATION delivery fails once and RevenueCat's retry lands
    // after the re-purchase an hour later. (RevenueCat retries failed deliveries for hours.)
    { id: 'lapse-resubscribe', story: 'buys on day 0, lapses on day 30, buys again 1 hour later', now: 45, activeAtNow: true,
        events: [ev('INITIAL_PURCHASE', 0, 30), ev('EXPIRATION', 30, 30), ev('INITIAL_PURCHASE', 30 + H, 60 + H)] },
    { id: 'cancel-expire', story: 'buys on day 0, turns off auto-renew on day 10, expires day 30', now: 35, activeAtNow: false,
        events: [ev('INITIAL_PURCHASE', 0, 30), ev('CANCELLATION', 10, 30), ev('EXPIRATION', 30, 30)] },
    { id: 'cancel-uncancel', story: 'buys on day 0, cancels day 10, re-enables day 12, renews day 30', now: 45, activeAtNow: true,
        events: [ev('INITIAL_PURCHASE', 0, 30), ev('CANCELLATION', 10, 30), ev('UNCANCELLATION', 12, 30), ev('RENEWAL', 30, 60)] },
    { id: 'billing-retry', story: 'buys on day 0, card fails day 30, renewal succeeds day 31', now: 45, activeAtNow: true,
        events: [ev('INITIAL_PURCHASE', 0, 30), ev('BILLING_ISSUE', 30, 30), ev('RENEWAL', 31, 61)] },
];
const STARTING_USERS = [
    { id: 'free', row: { subscription_tier: 'free', subscription_expires_at: null, role: 'user' } },
    { id: 'web-lifetime', row: { subscription_tier: 'lifetime', subscription_expires_at: null, role: 'user' },
        note: 'already owns lifetime via Stripe on the web, then subscribes on iOS' },
];

// ---------- persistence: mirrors supabase/functions/revenuecat-webhook/index.ts ----------
// updateUserTier (index.ts:65-83) is a blind UPDATE of tier + expires_at, no guards.
function makePersistence(user) {
    const notifications = [];
    return {
        notifications,
        async getUserByAppUserId() { return { ...user }; },
        async updateUserTierByAppUserId(_id, tier, expiresAt) {
            user.subscription_tier = tier;
            user.subscription_expires_at = expiresAt;
            return { ...user };
        },
        async createUserNotification(n) { notifications.push(n); },
    };
}

// ---------- reconcile: mirrors supabase/functions/reconcile-subscriptions/index.ts ----------
// Only 'supporter' rows whose expiry is null or past are re-queried; active at provider ->
// refresh expiry; expired -> tier 'free'. Lifetime/role/free rows are never touched.
function reconcile(user, scenario, now, isPremiumActive) {
    if (user.subscription_tier !== 'supporter') return;
    if (isPremiumActive(user, new Date(now)) && user.subscription_expires_at) return;
    const last = [...scenario.events].reverse().find((e) => e.expiration_at_ms);
    if (scenario.activeAtNow) user.subscription_expires_at = new Date(last.expiration_at_ms).toISOString();
    else { user.subscription_tier = 'free'; user.subscription_expires_at = new Date(last.expiration_at_ms).toISOString(); }
}

// ---------- delivery orders: every event once or twice, every interleaving ----------
function* multisetPermutations(items) {
    const counts = new Map();
    for (const i of items) counts.set(i, (counts.get(i) || 0) + 1);
    const keys = [...counts.keys()];
    const out = [];
    function* rec() {
        if (out.length === items.length) { yield [...out]; return; }
        for (const k of keys) {
            if (!counts.get(k)) continue;
            counts.set(k, counts.get(k) - 1); out.push(k);
            yield* rec();
            out.pop(); counts.set(k, counts.get(k) + 1);
        }
    }
    yield* rec();
}
function* deliveries(n) {
    for (let mask = 0; mask < 1 << n; mask++) {
        const items = [];
        for (let i = 0; i < n; i++) { items.push(i); if (mask & (1 << i)) items.push(i); }
        yield* multisetPermutations(items);
    }
}

// ---------- properties ----------
// Each returns a failure message or null. `s` = final state after deliveries + reconcile.
const PROPERTIES = {
    'P1-no-wrongful-lockout': {
        says: 'A user RevenueCat says is paid up right now has premium in Riven.',
        harm: 'A paying iOS subscriber is locked out of Pro features they paid for.',
        check: (s) => (s.scenario.activeAtNow && !s.premium ? 'provider says active, Riven says no premium' : null),
    },
    'P2-no-free-ride': {
        says: 'A user whose subscription has ended (and who never bought lifetime) has no premium after reconcile.',
        harm: 'Riven gives away Pro after the subscription ended.',
        check: (s) => (!s.scenario.activeAtNow && s.start.id === 'free' && s.premium ? 'provider says expired, Riven still grants premium' : null),
    },
    'P3-lifetime-kept': {
        says: 'A user who owns lifetime keeps tier lifetime whatever RevenueCat sends.',
        harm: 'A lifetime buyer is downgraded to a subscription, then to free when it lapses.',
        check: (s) => (s.start.row.subscription_tier === 'lifetime' && s.user.subscription_tier !== 'lifetime' ? `lifetime overwritten with "${s.user.subscription_tier}"` : null),
    },
    'P4-retry-idempotent': {
        says: 'Receiving the same event twice in a row leaves the same row as receiving it once.',
        harm: 'A RevenueCat retry changes access or sends a second notification.',
        check: (s) => s.retryDiff,
    },
};

async function runOnce(core, scenario, start, order) {
    const user = { id: 7, ...structuredClone(start.row) };
    const persistence = makePersistence(user);
    const steps = [];
    for (const idx of order) {
        const e = { ...scenario.events[idx], app_user_id: 'uuid-7' };
        const before = { tier: user.subscription_tier, exp: user.subscription_expires_at };
        const r = await core.processRevenueCatWebhookEvent({ event: e, persistence, logger: { info() {}, warn() {}, error() {} } });
        steps.push({ idx, e, before, after: { tier: user.subscription_tier, exp: user.subscription_expires_at }, outcome: r.outcome });
    }
    return { user, persistence, steps };
}

async function check(moduleDir) {
    const core = await import(pathToFileURL(path.join(moduleDir, 'revenuecatWebhookCore.mjs')));
    const { isPremiumActive } = await import(pathToFileURL(path.join(moduleDir, 'premiumAccess.mjs')));
    const failures = new Map(); // key -> { shortest counterexample }
    let runs = 0;
    for (const scenario of SCENARIOS) {
        for (const start of STARTING_USERS) {
            for (const order of deliveries(scenario.events.length)) {
                runs++;
                const { user, persistence, steps } = await runOnce(core, scenario, start, order);
                const now = at(scenario.now);
                const afterWebhooks = { ...user };
                reconcile(user, scenario, now, isPremiumActive);
                // P4: compare against the same order with adjacent duplicates collapsed.
                const collapsed = order.filter((v, i) => i === 0 || order[i - 1] !== v);
                let retryDiff = null;
                if (collapsed.length !== order.length) {
                    const once = await runOnce(core, scenario, start, collapsed);
                    if (once.user.subscription_tier !== afterWebhooks.subscription_tier || once.user.subscription_expires_at !== afterWebhooks.subscription_expires_at
                        || once.persistence.notifications.length !== persistence.notifications.length) retryDiff = 'back-to-back retry changed the result';
                }
                const state = { scenario, start, order, steps, user, afterWebhooks, retryDiff, premium: isPremiumActive(user, new Date(now)) };
                for (const [pid, p] of Object.entries(PROPERTIES)) {
                    const msg = p.check(state);
                    if (!msg) continue;
                    const key = `${pid} | ${scenario.id} | ${start.id}`;
                    const prev = failures.get(key);
                    if (!prev || order.length < prev.state.order.length) failures.set(key, { pid, msg, state, count: (prev?.count || 0) + 1 });
                    else prev.count++;
                }
            }
        }
    }
    return { failures, runs };
}

function explain({ pid, msg, state, count }) {
    const { scenario, start, steps, user, afterWebhooks } = state;
    const lines = [`${pid}  scenario=${scenario.id}  user=${start.id}  (${count} failing orders; shortest shown)`,
        `  Property: ${PROPERTIES[pid].says}`,
        `  Story: user ${start.note ? `${start.note}; ` : ''}${scenario.story}. Checked on day ${scenario.now}.`];
    steps.forEach((s, i) => {
        const exp = s.e.expiration_at_ms ? `, period ends ${dayOf(new Date(s.e.expiration_at_ms).toISOString())}` : '';
        lines.push(`  ${i + 1}. RevenueCat delivers ${s.e.type} (sent ${dayOf(new Date(s.e.event_timestamp_ms).toISOString())}${exp}) -> tier ${s.before.tier}→${s.after.tier}, expires ${dayOf(s.before.exp)}→${dayOf(s.after.exp)} [${s.outcome}]`);
    });
    const healed = afterWebhooks.subscription_tier !== user.subscription_tier || afterWebhooks.subscription_expires_at !== user.subscription_expires_at;
    lines.push(`  ${steps.length + 1}. Daily reconcile ${healed ? `changes row to tier ${user.subscription_tier}, expires ${dayOf(user.subscription_expires_at)}` : `leaves the row alone (it only revisits 'supporter' rows with a null or past expiry)`}`);
    lines.push(`  Result: ${msg}. Harm: ${PROPERTIES[pid].harm}`);
    return lines.join('\n');
}

const BASELINE = path.join(HERE, 'baseline.json');
const args = process.argv.slice(2);
const moduleDir = args.includes('--module') ? path.resolve(args[args.indexOf('--module') + 1]) : SHARED;

if (args.includes('--self-test')) {
    // Each mutant is a realistic one-line slip in the real module. The check must
    // report at least one failure the unmutated code does not have.
    const MUTANTS = [
        { name: 'CANCELLATION revokes immediately', file: 'revenuecatWebhookCore.mjs', from: "    case 'EXPIRATION':\n      return 'free';", to: "    case 'EXPIRATION':\n    case 'CANCELLATION':\n      return 'free';" },
        { name: 'INITIAL_PURCHASE ignored', file: 'revenuecatWebhookCore.mjs', from: "    case 'INITIAL_PURCHASE':\n", to: '' },
        { name: 'BILLING_ISSUE revokes immediately', file: 'revenuecatWebhookCore.mjs', from: "    case 'EXPIRATION':\n      return 'free';", to: "    case 'EXPIRATION':\n    case 'BILLING_ISSUE':\n      return 'free';" },
        { name: 'expiry compare inverted', file: 'premiumAccess.mjs', from: 'return expiryMs > now.getTime();', to: 'return expiryMs < now.getTime();' },
    ];
    const base = await check(SHARED);
    let ok = true;
    for (const m of MUTANTS) {
        const dir = mkdtempSync(path.join(tmpdir(), 'verify-entitlements-'));
        cpSync(SHARED, dir, { recursive: true });
        const f = path.join(dir, m.file);
        const src = readFileSync(f, 'utf8');
        if (!src.includes(m.from)) { console.log(`STALE  mutant "${m.name}": anchor not found in ${m.file}; update MUTANTS`); ok = false; rmSync(dir, { recursive: true }); continue; }
        writeFileSync(f, src.replace(m.from, m.to));
        const res = await check(dir);
        rmSync(dir, { recursive: true });
        // Caught = a (property, scenario, user) that newly fails, or one that fails in more delivery orders.
        const fresh = [...res.failures.keys()].filter((k) => !base.failures.has(k) || res.failures.get(k).count > base.failures.get(k).count);
        console.log(`${fresh.length ? 'CAUGHT' : 'MISSED'} mutant "${m.name}"${fresh.length ? ` -> ${fresh.slice(0, 3).join('; ')}` : ''}`);
        if (!fresh.length) ok = false;
    }
    process.exit(ok ? 0 : 1);
}

const { failures, runs } = await check(moduleDir);
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).knownFindings;
const found = [...failures.keys()].sort();
const unexpected = found.filter((k) => !baseline.includes(k));
const fixed = baseline.filter((k) => !failures.has(k));
console.log(`checked ${runs} delivery orders across ${SCENARIOS.length} scenarios x ${STARTING_USERS.length} starting users`);
for (const k of found) {
    const tag = baseline.includes(k) ? 'KNOWN' : 'NEW  ';
    if (args.includes('--all') || tag === 'NEW  ') console.log(`\n${tag} ${explain(failures.get(k))}`);
    else console.log(`${tag} ${k}`);
}
for (const k of fixed) console.log(`FIXED ${k}  (no longer fails: confirm, then remove it from baseline.json)`);
if (!found.length) console.log('all properties hold');
process.exit(unexpected.length ? 1 : fixed.length ? 2 : 0);
