// Journey runner: drives the real app in headless Chromium against the local stack and
// writes evidence. A journey file exports `meta` and `default async function (ctx)`.
//
// ctx = { page, step, expect, signIn, db, sql, fakeCalls, edgeLog, user, evidenceDir, baseURL }
//   step(name, fn)      runs fn, screenshots after it (and on failure), records timing
//   signIn(userKey)     signs in through the real login form as a seeded user
//   sql(text, params)   query the local Postgres (assert side effects)
//   fakeCalls()         third-party calls the edge functions made during this journey
//   edgeLog()           edge host log lines written during this journey
import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE_DIR, PASSWORD, PORTS, SUPABASE, USERS, requireClient, requireServer } from './config.mjs';
import { FAKE_LOG, logFile } from './stack.mjs';

const { chromium, expect } = requireClient('@playwright/test');
const { Client } = requireServer('pg');

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const fileSize = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };
const readFrom = (f, offset) => { try { return fs.readFileSync(f).subarray(offset).toString('utf8'); } catch { return ''; } };
const chromiumPath = () => ['/opt/pw-browsers/chromium', process.env.RIVEN_VERIFY_CHROMIUM].find((p) => p && fs.existsSync(p));

export async function runJourney(name, journey, { viewport = { width: 1440, height: 900 }, headed = false } = {}) {
  const evidenceDir = path.join(EVIDENCE_DIR, `${stamp()}-${name}`);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const baseURL = `http://127.0.0.1:${PORTS.client}`;
  const steps = [];
  const consoleLines = [];
  const httpErrors = [];
  const edgeLogFile = logFile('edge');
  const edgeOffset = fileSize(edgeLogFile);
  const fakeOffset = fileSize(FAKE_LOG);
  const db = new Client({ connectionString: SUPABASE.dbUrl });
  await db.connect();

  const executablePath = chromiumPath();
  const browser = await chromium.launch({
    headless: !headed,
    ...(executablePath && fs.statSync(executablePath).isFile() ? { executablePath } : {}),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-background-networking', '--disable-component-update'],
  });
  const context = await browser.newContext({ baseURL, viewport, deviceScaleFactor: 1, permissions: ['microphone'] });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && (url.startsWith(SUPABASE.url) || url.includes('/api/'))) {
      httpErrors.push({ status: res.status(), method: res.request().method(), url: url.replace(SUPABASE.url, '') });
    }
  });

  const step = async (stepName, fn) => {
    const started = Date.now();
    const shot = path.join(evidenceDir, `${String(steps.length + 1).padStart(2, '0')}-${slug(stepName)}.png`);
    try {
      await fn();
      await page.screenshot({ path: shot, fullPage: false });
      steps.push({ name: stepName, ok: true, ms: Date.now() - started, screenshot: path.relative(evidenceDir, shot) });
    } catch (error) {
      const failShot = path.join(evidenceDir, `FAILED-${path.basename(shot)}`);
      await page.screenshot({ path: failShot, fullPage: false }).catch(() => {});
      steps.push({ name: stepName, ok: false, ms: Date.now() - started, screenshot: path.relative(evidenceDir, failShot), error: String(error?.message ?? error).split('\n').slice(0, 6).join('\n') });
      throw error;
    }
  };

  const signIn = async (userKey = 'student') => {
    const user = USERS[userKey];
    if (!user) throw new Error(`unknown seeded user: ${userKey}`);
    await page.goto('/account');
    await page.getByPlaceholder('you@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').fill(PASSWORD);
    await page.getByRole('button', { name: 'Enter' }).click();
    // A signed-in /account shows the profile with a Sign Out action instead of the form.
    await expect(page.getByText('Sign Out').first()).toBeVisible({ timeout: 30_000 });
  };

  const sql = async (text, params) => (await db.query(text, params)).rows;
  const fakeCalls = () => readFrom(FAKE_LOG, fakeOffset).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const edgeLog = () => readFrom(edgeLogFile, edgeOffset).split('\n').filter(Boolean);

  let failure = null;
  const started = Date.now();
  try {
    await journey({ page, step, expect, signIn, sql, db, fakeCalls, edgeLog, evidenceDir, baseURL, users: USERS });
  } catch (error) {
    failure = String(error?.message ?? error).split('\n').slice(0, 8).join('\n');
  }

  await context.tracing.stop({ path: path.join(evidenceDir, 'trace.zip') }).catch(() => {});
  await browser.close();
  await db.end();

  const edgeLines = edgeLog();
  const edgeCalls = edgeLines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e?.fn);
  const calls = fakeCalls();
  fs.writeFileSync(path.join(evidenceDir, 'console.log'), consoleLines.join('\n'));
  fs.writeFileSync(path.join(evidenceDir, 'edge.log'), edgeLines.join('\n'));
  fs.writeFileSync(path.join(evidenceDir, 'fakes.json'), JSON.stringify(calls, null, 2));
  const summary = {
    journey: name,
    ok: !failure,
    ms: Date.now() - started,
    failure,
    steps,
    evidence: path.relative(process.cwd(), evidenceDir),
    edgeCalls: edgeCalls.map(({ fn, method, status, ms, error }) => ({ fn, method, status, ms, ...(error ? { error: error.slice(0, 300) } : {}) })),
    externalCalls: calls.map(({ route, status }) => ({ route, status })),
    unroutedExternal: calls.filter((c) => c.route === 'blocked' || c.route.endsWith(':unrouted')),
    httpErrors,
    pageErrors: consoleLines.filter((l) => l.startsWith('[pageerror]')),
  };
  fs.writeFileSync(path.join(evidenceDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
