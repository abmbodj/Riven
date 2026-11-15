---
name: verify-riven
description: Drive the real Riven web app (React SPA in client/) in headless Chromium the way a signed-in student does, with Supabase replaced by an in-memory fake at the network boundary, and capture screenshots, a Playwright trace, and every database write as proof. Use to prove a client change works end to end (dashboard, classes, decks, flashcard study), to reproduce a UI bug, or before claiming a frontend fix is done.
---

# verify-riven

Proves Riven client behavior by running the production build of the SPA and
driving it through real user paths. Supabase (PostgREST, RPC, edge functions,
auth) is faked **at the network boundary only**: the app's own code — React,
routing, `client/src/api/authApi.js`, FSRS scheduling — runs unmodified. Every
insert/update/delete the app sends is recorded so a journey can assert side
effects, not just pixels.

All paths below are relative to the repo root. Scripts live in
`.claude/skills/verify-riven/scripts/` (call it `$V`).

## What this does and does not prove

- **Proves:** UI renders from realistic data, user interactions work, and the
  client sends the right PostgREST writes / edge-function calls with the right
  payloads.
- **Does not prove:** RLS policies, SQL/RPC logic, edge-function internals,
  Stripe/RevenueCat, real auth. For those use `deno check` + the server/edge unit
  tests (`cd server && npx vitest run`), and say in your report that the backend
  half was not exercised.
- The fake returns **empty data** for any table/RPC/edge function it has not been
  seeded with and lists them under `unstubbed` in the run summary. If a journey
  depends on one, seed it (see *Extending*), don't ignore it.

## Launch

```bash
V=.claude/skills/verify-riven/scripts
$V/launch.sh            # builds client in fixture mode, serves on 127.0.0.1:4174
```

- Builds with `VITE_E2E_FIXTURES=true` and `VITE_SUPABASE_URL=https://example.supabase.co`
  into `client/test-results/verify-riven/.run/dist` (~1 min), then starts
  `vite preview`. Ready = it prints `ready: http://127.0.0.1:4174 (pid N)`.
- Installs `client/node_modules` with `npm ci` if missing.
- Browser: uses `/opt/pw-browsers/chromium` when present (Claude Code cloud
  containers), else `RIVEN_VERIFY_CHROMIUM`, else Playwright's own download. On a
  laptop, run `cd client && npx playwright install chromium` once. This skill was
  proven in a cloud container only; the first laptop run is unverified.
- `RIVEN_VERIFY_PORT=4175 $V/launch.sh` for a second instance. Port 4173 is
  left free for the repo's own `npm run test:e2e`.
- `RIVEN_VERIFY_SKIP_BUILD=1` reuses the last build (only if `doctor.sh` says it is fresh).
- **Rebuild after any change under `client/src`**: it is a production build, not a
  dev server. `$V/cleanup.sh && $V/launch.sh`.

## Doctor

```bash
$V/doctor.sh   # read-only; exit 0 = safe to drive
```

Checks: the pid is our `vite preview` on our port, the SPA is served, the bundle
targets the fake Supabase, and `client/src` has not changed since the build.
Run it first whenever anything looks off.

## Drive

Run one journey, or all of them:

```bash
node $V/journeys/study-deck.mjs
$V/run-all.sh
```

Each prints `PASS|FAIL <journey>` with per-step results and the evidence folder.
Exit code is non-zero on failure.

Write a new journey as `$V/journeys/<name>.mjs`:

```js
import { runJourney } from '../harness.mjs';

await runJourney('my-journey', async ({ page, step, expect, writes, fake }) => {
    await step('open the deck', async () => {
        await page.goto('/deck/31');                       // baseURL is the instance
        await expect(page.getByText('Cell Biology').first()).toBeVisible();
    });
    await step('the app wrote the row', async () => {
        const insert = writes.find((w) => w.table === 'cards' && w.op === 'insert');
        expect(insert.rows[0]).toMatchObject({ deck_id: 31 });
    });
});
```

- `step(name, fn)` screenshots after each step (and on failure) and records timing.
- `writes`: `{ table, op: 'insert'|'update'|'delete', rows|patch|filter }`, plus
  `{ op: 'rpc'|'edge', name, body }` for mutating RPCs and every edge-function call.
- `fake.tables`: the live in-memory DB (read it to assert final state).
- Seeded world (`$V/seed.mjs`): user **7 "atlas"** (free tier, onboarded), classes
  **21 Biology** / **22 Calculus**, deck **31 "Cell Biology"** (class 21) with cards
  **501–503**, theme "Sage Temple", 5 hearts. Pass `seed` to `runJourney(name, fn, { seed })`
  to change it (`const seed = defaultSeed(); seed.tables.cards.push(...)`).

Selector rules for this app:

- Prefer roles/labels/placeholders: `getByRole('button', { name: 'Add class' })`,
  `getByPlaceholder('Question or term')`, `[data-dashboard-ready="true"]`.
- Many controls exist twice (mobile `xl:hidden` + desktop). Add
  `.filter({ visible: true }).first()`.
- The default viewport is 1440×900 (desktop layout). Pass `{ viewport: { width: 390, height: 844 } }`
  as the third `runJourney` arg for the mobile layout; labels differ (e.g. study's
  "Recall ON" is "Spaced Repetition ON" on mobile).
- Wait for state, never sleep: e.g. study cards ignore flips mid-transition, so wait
  for the `N / M` counter and the "Reveal prompt" phase before pressing Space.

## Evidence

Each run writes `client/test-results/verify-riven/<UTC-stamp>-<journey>/`
(git-ignored, survives cleanup):

| File | What |
|---|---|
| `NN-<step>.png` | screenshot after each step; `FAILED-…` on failure |
| `trace.zip` | Playwright trace: `cd client && npx playwright show-trace <path>` |
| `writes.json` | every DB mutation / edge call the app made |
| `requests.log` | every request to the fake, with status (look for `406`/`404`) |
| `console.log` | browser console + page errors |
| `summary.json` | pass/fail per step, `unstubbed` endpoints, blocked external hosts |

Proof standards:

- Drive the real user path (clicks, keys, forms). Never call app internals or set
  React state from the test.
- Assert **both** the visible result and the side effect in `writes` / `fake.tables`.
- Some writes happen on navigation away (e.g. study sessions save on unmount):
  leave the page before asserting them.
- `ERR_FAILED` lines in `console.log` are the harness blocking off-box hosts
  (Google Fonts, analytics) and are expected. A `406` in `requests.log` means the
  app asked for a single row the seed lacks; fix the seed.
- Quote the evidence folder path in your report.

## Cleanup

```bash
$V/cleanup.sh
```

Kills only the pid recorded by `launch.sh` (after checking it is our `vite preview`)
and deletes `.run/` (build + logs). Evidence folders stay. Prune old evidence by
hand: `rm -rf client/test-results/verify-riven/2026-*`.

## Extending the fake

`$V/harness.mjs` → `createFakeSupabase(seed)` implements PostgREST `GET/HEAD/POST/PATCH/DELETE`
with `eq, neq, in, is, gt(e), lt(e), like, ilike, not.*`, `order`, `limit`, `offset`,
`Accept: vnd.pgrst.object+json` (single → 406 if not exactly one row), and
`Prefer: count=exact|return=representation`. Not implemented: `or=`/`and=` filters,
embedded-resource selects (full rows are returned regardless of `select`). Those show
up under `unstubbed`.

- New table data → `seed.tables.<table>` (use real column names from `supabase/migrations/`).
- RPC → `seed.rpc.<name> = (body, { tables, state }) => result`.
- Edge function → `seed.edge.<name> = (body, state, { tables, query }) => result`.
- Legacy Express routes (`/api/*`): only `/api/auth/me` and `/api/csrf` are answered;
  others return 404 and show as `express /api/...` in `unstubbed`.
- Auth: a fake Supabase session (unsigned JWT, `sub` = `AUTH_USER_ID` in `seed.mjs`)
  is planted in `localStorage['sb-example-auth-token']`; `users.supabase_auth_id`
  must match it.

## Feature map

`features/README.md` indexes the user-facing features and which journey covers
each. A proof is incomplete if it drives one entry point while the map lists others
for that feature. Keep it current with `/pstack:maintain-verification-skill`.
