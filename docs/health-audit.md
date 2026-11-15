# Riven health audit (2026-11-15)

Read-only audit of `client/`, `server/` and `supabase/` at `a2da44d` plus the Phase 1
verification work. Every number below was measured in this session; the commands are
listed under *Method*. Nothing in the app was changed to produce it.

**Ranking:** risk (1-5: chance × blast radius of a user-facing or data problem) against
effort (1-5). Items marked **ASK** touch auth, billing or the database schema and wait
for your approval per the ground rules.

## Ranked findings

| # | Finding | Risk | Effort | Area | Proposed action |
|---|---|---|---|---|---|
| 1 | **XP can be minted by any signed-in user.** The client inserts `exam_attempts.score/total`; `exam-complete` awards XP from them. Reproduced locally: three fabricated 100/100 attempts → +360 XP, level 1 → 4. `study-session-complete` likewise scores the client's `studyStateAfter` (capped per session, sessions unlimited). Breaks the CLAUDE.md invariant "recompute XP server-side from DB state". | 4 | 3 | entitlements, RLS | **ASK** (RLS/schema). Score attempts server-side from stored answers vs `mock_exams.questions`; deny client-set `score/total`. |
| 2 | **Two independent Stripe webhook implementations.** `server/routes/webhooks.js` (inline SQL) and edge `stripe-webhook` (`_shared/stripeWebhookCore.mjs`) both handle `checkout.session.completed`, subscription deletion, payment failure, with separately maintained copies of the same rules (tier mapping, lifetime protection, email fallback) that can drift apart. Whichever Stripe is pointed at decides behavior; the other rots. | 5 | 3 | billing | **ASK.** Tell me which endpoint Stripe calls; delete the other after a characterization test of the live one. |
| 3 | **Production schema is not reproducible from the repo.** Migrations assume tables created by `server/db.js initDb()` plus dashboard edits. Found drift: `users.supabase_auth_id` (in no file), `users.password` nullable in prod but `NOT NULL` in code, `user_internal_id()` prod-only, buckets `avatars`/`group-files` created by nothing. `initDb()` still runs DDL against production on every Express boot unless `RIVEN_SKIP_DB_INIT=true`. | 4 | 2 | schema | **ASK.** `supabase db dump --schema public` → one baseline migration; stop boot-time DDL. Local workaround: `scripts/verify/db/10-baseline-gaps.sql`. |
| 4 | **Edge functions are never type-checked or linted in CI.** `deno check */index.ts`: 23 errors (create-checkout 5, create-portal 5, hearts 3, referrals 3, …). `deno lint`: 203 problems (80 `no-explicit-any`, 70 `no-import-prefix`, 44 `require-await`, 8 unused vars). CI only runs `_shared/*.test.ts`. | 3 | 1 | guardrails | Phase 3: add `deno check` + `deno lint` to CI. The type errors in create-checkout/portal are billing code: **ASK** before fixing those; others are free. |
| 5 | **Red and environment-dependent baseline.** `GroupDetails.test.jsx`: 2 tests fail deterministically (meetup composer). Without `VITE_SUPABASE_*` in the shell, 9 more client tests fail (`authApi.login.test.js`) and 5 suites fail to load: tests read ambient env. | 3 | 1 | tests | Fix the 2 tests; have `vitest.config.js` set the test env so results don't depend on the shell. |
| 6 | **Dead code and dependency hygiene; knip misconfigured.** The checked-in `knip.json` isn't workspace-aware (603 false "unlisted dependencies") and isn't in CI. With a workspace config: unused files `client/src/api/studyCoverage.js`, `components/messages/ReadReceipt.jsx`, `components/onboarding/ProfilePictureStep.jsx`; unused deps client `@posthog/react`, `@react-oauth/google`, `@revenuecat/purchases-js`, `capacitor-voice-recorder`¹, server `@google/genai`, `mammoth`, `uuid`; 66 unused exports; unlisted (imported but not declared) `framer-motion`, `highlight.js`, `@tiptap/core`, `@testing-library/dom`. | 2 | 1 | dead code | Phase 3: fix `knip.json`, run in CI; remove confirmed-dead files/deps one PR each. ¹verify iOS plugin use first. |
| 7 | **Missing lint coverage.** `server/` has no ESLint config at all. Client lint is error-free but has 54 warnings (48 `react-refresh/only-export-components`, 5 `exhaustive-deps`). Husky pre-commit runs only TruffleHog and **passes silently when TruffleHog isn't installed** (it isn't here). | 3 | 2 | guardrails | Phase 3: server ESLint (flat config, `eslint-plugin-n`), pre-commit = lint-staged (eslint + knip on staged workspaces), make missing TruffleHog a warning that CI backs. |
| 8 | **Audio-note enhancement rail can stall after the job finished** (suspected app bug). In 1 of 3 `audio-to-notes` runs the job was `completed` in `ai_jobs` but the editor stayed at "Preparing timestamped class transcript 18%" for 30 s+. Likely cause: `NoteEditor`'s 3 s poll re-arms only when the job state changes, so a missed Realtime event leaves it stuck. Evidence: `client/test-results/riven-verify/2026-11-15T21-54-29-476-audio-to-notes/` (local). | 3 | 2 | AI pipeline UX | Characterization test of the poll/realtime state machine, then fix. |
| 9 | **`client/src/api/authApi.js` is a god file**: 6,350 lines, 261 exports, 144 PostgREST calls, auth + every feature. 23 non-API modules import it directly, bypassing the `api.js` cache layer (16 components/pages). Every agent change touches it; RIV-025 split is in progress. | 3 | 4 | structure | `/architect` candidate: finish RIV-025 by domain (auth, decks, notes, exams, guides, groups, billing…), with a lint rule banning new direct `authApi` imports from components. |
| 10 | **AI pipeline coupling.** `_shared/aiJobProcessors.ts` (2,619 lines) holds every job kind; `_shared/aiCore.mjs` (1,733) mixes quota, prompt text, response parsing and the guide pipeline. `generate-deck/exam/guide` each keep a streaming and a non-streaming path that copy the same auth → quota → source prep → parse → persist steps (jscpd: 111 / 105 duplicated lines between them; `generate-from-youtube` duplicates itself, 97 lines). | 3 | 4 | AI pipeline | `/architect` candidate: one `generationPipeline` (auth, quota, source prep, telemetry, persist) with per-artifact prompt+parse modules; split processors by job kind. |
| 11 | **Legacy Express still serves AI-adjacent routes.** `POST /api/study/assist` and `GET /api/study/coach` are live and the client calls `/study/assist` (`assistStudyCoach`) through the legacy bridge, while CLAUDE.md says AI/study Express routes were removed. `server/routes/study.js` duplicates 31 lines of `_shared/studyCoachCore.mjs`. | 2 | 2 | boundaries | Move `assist` to an edge function (or confirm it is intended), delete the Express route. Touches auth bridge → **ASK** if it changes how the call authenticates. |
| 12 | **Untested critical paths.** 46 of 49 edge `index.ts` handlers have no test (auth, quota, wiring); untested `_shared` modules include `aiJobs.ts` (608 lines), `canvasLmsSync.ts`, `rateLimit.ts`, `ragAnswer.ts`, `acceptSharedResourceHandler.ts`. Client: `context/` has 1 test for 11 files (`RecordingSessionContext.jsx`, 1,368 lines, is only covered by the new journey). The 9 `riven-verify` journeys now cover the 8 core flows end to end. | 3 | 3 | tests | Characterization tests per flow before any refactor (Phase 3), starting with the files the refactor touches. |
| 13 | **Client/edge logic duplicated by copy.** `client/src/utils/subjectInference.js` ↔ `_shared/subjectInference.mjs` (73 lines); `deepgramBatchCore` ↔ `deepgramCallbackCore` (30); `grade-answer` ↔ `grade-tutor-answer` (24). Overall duplication is low (0.78%, 795 lines). | 2 | 2 | duplication | Share `_shared/*.mjs` with the client where runtime-agnostic (the pattern already used for tests). |
| 14 | **Large page components.** `GuideView.jsx` 2,739, `NoteEditor.jsx` 2,213, `Garden.jsx` 1,382, `ThemeSettings.jsx` 1,318, `Home.jsx` 1,302, `GroupDetails.jsx` 1,253. | 2 | 4 | structure | Split only where a refactor already needs it; journeys guard behavior. |
| 15 | **Small UI defects found while driving.** Mock-exam "generate" is an icon-only button with no accessible name. Syllabus file input `accept` has `line/msword` (should be `application/msword`). | 1 | 1 | a11y | Fix in a small PR with a lint rule for icon-only buttons (`jsx-a11y/control-has-associated-label`). |
| 16 | **"Or propose a time" is broken after 6 PM.** `GroupScheduleHub` seeds the composer with today 18:00; `ProposeSessionSheet` rejects past starts, so in the evening every submit fails with "Can't propose a session in the past." until the user edits the time. Found because the two GroupDetails tests failed after 18:00 (#5). | 3 | 1 | groups UX | Default to the next future 18:00 (or next full hour). User-visible change: needs your OK. |

## Proposed order

1. **Guardrails first (Phase 3, no approval needed):** #5, #6, #7, #4 (CI part) — they make
   every later change safer and are each about an hour.
2. **Decisions I need from you:** #2 (which Stripe webhook is live), #3 (may I add a
   baseline migration from a production dump, and drop boot-time DDL), #1 (may I change
   `exam_attempts` RLS/scoring), #11 if it changes auth.
3. **Bugs with evidence:** #8, #15.
4. **Structural (`/architect` scope):** #9 (`authApi.js`), #10 (AI pipeline). These are
   the top-ranked structural issues; nothing else warrants an architecture pass.
5. Opportunistic: #12-#14 alongside the work above.

## Detail and evidence

### Dead code (knip, workspace-aware config)

The repo config (`knip.json`) treats the monorepo as one package, so every client import
shows as an unlisted dependency. A config with `client` and `server` workspaces reduces
noise to real findings (listed in #6). Caveat: knip does not see Capacitor's native
plugin registration, so `capacitor-voice-recorder` and `@capacitor/ios` need a manual
check; exports used only by tests also count as unused.

### Lint and type coverage

| Area | Linted | Type-checked | In CI |
|---|---|---|---|
| client | ESLint (0 errors, 54 warnings) | no (JS) | lint, tests, build, perf budget, e2e |
| server | **no config** | no (JS) | tests only |
| supabase/functions | `deno lint` not run (203 problems) | `deno check` not run (23 errors) | `_shared/*.test.ts` only |
| SQL | — | pgTAP for the dashboard RPC only | yes |

### Auth and billing surface (for the ASK items)

- Two auth systems coexist: Supabase Auth (primary) and the legacy Express JWT bridge
  (2FA, OAuth, login fallback when `VITE_ENABLE_LEGACY_AUTH_BRIDGE` / `VITE_API_URL` is
  set). The new journeys exercise only Supabase password sign-in.
- Billing paths: web Stripe (edge `create-checkout`, `create-portal`, `stripe-webhook`;
  Express `/api/webhooks/stripe` + `server/routes/stripe.js`), iOS RevenueCat
  (`sync-revenuecat`, `revenuecat-webhook`, `reconcile-subscriptions`). The
  `billing-paywall` journey proves only quota gating and checkout creation.

### Verification baseline (Phase 1)

`node scripts/verify/riven-verify.mjs run all --retry 1`: 9/9 journeys pass on a clean
seed (~2 minutes); one `audio-to-notes` run reproduced #8. Feature map: `docs/features/`.

## Method

```bash
cd server && npx vitest run                               # 272/272 pass
cd client && VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x \
  VITE_ENABLE_LEGACY_AUTH_BRIDGE=false npx vitest run       # 813/815 (GroupDetails x2)
cd client && npx eslint .                                 # 0 errors, 54 warnings
npx knip --config <workspace config>                      # see #6
npx jscpd@4.0.5 client/src server supabase/functions --min-lines 15 --min-tokens 120
cd supabase/functions && deno check */index.ts && deno lint
node scripts/verify/riven-verify.mjs run all --retry 1
```

`/how`, `/create-verification-skill` and `/architect` are not installed in this
environment; the audit was done by direct inspection with the tools above.
