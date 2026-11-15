#!/usr/bin/env node
// riven-verify: start the whole Riven stack locally from a seeded database and drive
// it like a user. Every command prints one JSON object on stdout (progress goes to
// stderr), so agents can parse results. Exit code is non-zero on failure.
//
//   up [--only supabase,edge,api,client]   start the stack (idempotent)
//   reset                                  rebuild schema from the repo + seed
//   seed                                   re-seed data only (fast)
//   status                                 ports, processes, log paths
//   list                                   journeys and what each covers
//   run <journey...|all> [--no-reset] [--mobile] [--headed] [--retry N]
//                                          seed, drive the journey, write evidence; --retry
//                                          re-seeds and reruns a failure (reported as flaky)
//   shot <path> [--as student|pro|newbie] [--mobile]
//                                          sign in, open a route, screenshot it
//   logs <edge|api|client|fakes> [--lines N]
//   down [--supabase]                      stop app processes (and Supabase)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { VERIFY_DIR } from './lib/config.mjs';

const [command = 'help', ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const flagValue = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--only', '--as', '--lines', '--retry'].includes(rest[i - 1])));
const log = (msg) => process.stderr.write(`[riven-verify] ${msg}\n`);
const out = (obj, ok = true) => { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); process.exitCode = ok ? 0 : 1; };
const JOURNEY_DIR = path.join(VERIFY_DIR, 'journeys');

async function loadJourneys() {
  const files = fs.readdirSync(JOURNEY_DIR).filter((f) => f.endsWith('.mjs')).sort();
  const journeys = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(JOURNEY_DIR, f)).href);
    journeys.push({ name: f.replace(/\.mjs$/, ''), meta: mod.meta ?? {}, run: mod.default });
  }
  return journeys;
}

async function main() {
  const stack = await import('./lib/stack.mjs');
  switch (command) {
    case 'up': {
      const only = flagValue('--only')?.split(',');
      return out(await stack.up({ log, only }));
    }
    case 'down':
      return out(await stack.down({ supabase: flags.has('--supabase') }));
    case 'status':
      return out(await stack.status());
    case 'reset': {
      const { rebuildSchema } = await import('./lib/schema.mjs');
      const { seed } = await import('./lib/seed.mjs');
      const schema = await rebuildSchema({ log });
      return out({ schema, seed: await seed({ log }) });
    }
    case 'seed': {
      const { seed } = await import('./lib/seed.mjs');
      return out(await seed({ log }));
    }
    case 'list': {
      const journeys = await loadJourneys();
      return out(journeys.map(({ name, meta }) => ({ name, ...meta })));
    }
    case 'run': {
      const { runJourney } = await import('./lib/harness.mjs');
      const { seed } = await import('./lib/seed.mjs');
      const all = await loadJourneys();
      const wanted = positional.includes('all') || positional.length === 0 ? all : positional.map((n) => {
        const j = all.find((x) => x.name === n);
        if (!j) throw new Error(`unknown journey "${n}"; try: ${all.map((x) => x.name).join(', ')}`);
        return j;
      });
      const results = [];
      const retries = Number(flagValue('--retry') ?? 0);
      for (const j of wanted) {
        const viewport = flags.has('--mobile') ? { width: 390, height: 844 } : j.meta.viewport;
        const attempts = [];
        for (let attempt = 0; attempt <= retries; attempt++) {
          if (!flags.has('--no-reset')) await seed();
          log(`running ${j.name}${attempt ? ` (retry ${attempt})` : ''}`);
          const result = await runJourney(j.name, j.run, { viewport, headed: flags.has('--headed') });
          log(`${result.ok ? 'PASS' : 'FAIL'} ${j.name} (${result.ms} ms) -> ${result.evidence}`);
          attempts.push(result);
          if (result.ok) break;
        }
        const final = attempts.at(-1);
        results.push({ ...final, attempts: attempts.length, flaky: final.ok && attempts.length > 1, earlierFailures: attempts.slice(0, -1).map((a) => ({ failure: a.failure, evidence: a.evidence })) });
      }
      const ok = results.every((r) => r.ok);
      return out({ ok, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, flaky: results.filter((r) => r.flaky).map((r) => r.journey), results }, ok);
    }
    case 'shot': {
      const { runJourney } = await import('./lib/harness.mjs');
      const route = positional[0] ?? '/dashboard';
      const as = flagValue('--as') ?? 'student';
      const result = await runJourney(`shot-${as}${route.replace(/\//g, '-')}`, async ({ page, step, signIn }) => {
        await step(`sign in as ${as}`, () => signIn(as));
        await step(`open ${route}`, async () => {
          await page.goto(route);
          await page.waitForLoadState('networkidle').catch(() => {});
        });
      }, { viewport: flags.has('--mobile') ? { width: 390, height: 844 } : undefined });
      return out(result, result.ok);
    }
    case 'logs': {
      const name = positional[0] ?? 'edge';
      const lines = Number(flagValue('--lines') ?? 100);
      const file = stack.logFile(name);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      return out({ file, lines: text.split('\n').filter(Boolean).slice(-lines) });
    }
    default:
      process.stdout.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
  }
}

main().catch((error) => out({ ok: false, error: String(error?.message ?? error) }, false));
