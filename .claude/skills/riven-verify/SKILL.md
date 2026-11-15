---
name: riven-verify
description: Start the full Riven stack locally (real Supabase in Docker with every migration, all edge functions, Express API on :3000, Vite client on :5173) from a seeded database, sign in as a seeded user, drive core flows in headless Chromium, and get JSON results with screenshots, traces, logs and every third-party call. Use to prove a change works end to end (audio notes, syllabus, YouTube, flashcards, exams, tutor, Canvas, billing), to reproduce a bug against real Postgres/RLS/edge code, or before claiming a refactor preserved behavior.
---

# riven-verify

`node scripts/verify/riven-verify.mjs <command>` (call it `$V`). Every command prints one
JSON object on stdout and progress on stderr; exit code is non-zero on failure.

## Quick start

```bash
$V up            # first run pulls Supabase images (minutes); later runs ~30 s
$V reset         # rebuild schema from the repo + seed (do this after migration changes)
$V run all --retry 1
```

Read `docs/features/README.md` first: it maps each core flow to its journey and says
what each journey does and does not prove.

## Commands

| Command | Does |
|---|---|
| `up [--only supabase,edge,api,client]` | Start what is not running. Restart `edge` after edits under `supabase/functions/` or `scripts/verify/fakes/`; Vite hot-reloads the client. |
| `reset` | Drop and rebuild `public` (legacy `initDb` → `db/10-baseline-gaps.sql` → all migrations), then seed. |
| `seed` | Wipe rows and re-seed (fast). `run` does this before every journey. |
| `run <name...|all> [--retry N] [--no-reset] [--mobile] [--headed]` | Drive journeys; evidence per journey. |
| `shot <route> [--as student|pro|newbie] [--mobile]` | Sign in, open a route, screenshot. |
| `list` | Journeys and what they cover. |
| `logs <edge|api|client|fakes> [--lines N]` | Tail a service log. |
| `status` / `down [--supabase]` | Ports and processes / stop. |

## Reading a result

`results[]` per journey: `ok`, `steps[]` (name, ms, screenshot, error), `edgeCalls`
(every edge function call with status), `externalCalls` (faked third-party calls),
`unroutedExternal` (a backend call nobody fakes, or a prompt no AI fixture matches:
fix the fake, never ignore it), `httpErrors` (4xx/5xx from Supabase or the API seen by
the browser), `browserBlocked` (off-box hosts the page tried), `pageErrors`, `flaky`.

Evidence: `client/test-results/riven-verify/<stamp>-<journey>/`. Look at the screenshots
before claiming success; `npx playwright show-trace <dir>/trace.zip` (from `client/`) to
step through a failure.

## Writing a journey

`scripts/verify/journeys/<name>.mjs`:

```js
export const meta = { feature: 'x', covers: 'one line', doc: 'docs/features/x.md' };
export default async function ({ page, step, expect, signIn, sql, fakeCalls, deepgramLive }) {
  await step('sign in', () => signIn('student'));
  await step('do the thing', async () => { await page.goto('/route'); /* real clicks */ });
  await step('side effect is in the database', async () => {
    const rows = await sql('select ... where id = $1', [id]);
    expect(rows.length).toBe(1);
  });
}
```

Rules: drive the real UI (roles, labels, placeholders; add `.filter({ visible: true })`
where desktop and mobile copies coexist); assert both what the user sees and the row
that was written; wait on state (`expect.poll`, visible text), never fixed sleeps except
to let an animation settle for a screenshot; add the journey to `docs/features/`.

## Fakes

`scripts/verify/fakes/` answers OpenAI, Gemini, Deepgram (batch + callback), YouTube,
transcriptapi, Canvas iCal, Stripe and Resend inside the edge host; the harness answers
the browser's Deepgram WebSocket. AI rules match prompt phrases (`fakes/ai.ts`); when a
prompt changes, add or fix a rule. Fixtures are about cell respiration so screenshots are
recognisable.

## Limits

- Edge functions share one Deno process (no per-function isolation). The gateway JWT
  check follows `verify_jwt` in `supabase/config.toml`.
- AI output is canned: journeys prove plumbing, not model quality.
- Not covered: iOS/Capacitor native paths, RevenueCat, Stripe webhooks, push, groups,
  messaging, garden. The older `verify-riven` skill (in-memory fake, no Docker) still
  covers dashboard/classes/deck UI quickly.
- Environment notes and dead ends: `docs/verification/failed-approaches.md`.
