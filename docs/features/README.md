# Riven feature map

One file per core flow: how a student reaches it, what runs behind it, and how to
drive it end to end with `riven-verify`. Keep this current when a flow's UI or
backend path changes: a journey that no longer matches its doc is a broken proof.

## The verification CLI

`scripts/verify/riven-verify.mjs` starts the whole stack locally from the repo and a
seeded database, drives the real app in headless Chromium, and prints JSON.

```bash
V="node scripts/verify/riven-verify.mjs"
$V up                    # Supabase (Docker), edge functions, API :3000, client :5173
$V reset                 # rebuild the schema from the repo + seed (about 10 s)
$V run all --retry 1     # every journey; JSON summary on stdout
$V run flashcards        # one journey
$V shot /calendar --as pro   # sign in, open a route, screenshot it
$V logs edge --lines 50  # edge|api|client|fakes
$V down [--supabase]
```

Each run re-seeds first, so every journey starts from the same data. Evidence goes to
`client/test-results/riven-verify/<stamp>-<journey>/` (git-ignored): one screenshot
per step, `trace.zip`, `console.log`, `edge.log`, `fakes.json` (every third-party call
the backend made) and `summary.json`. Details: [`.claude/skills/riven-verify/SKILL.md`](../../.claude/skills/riven-verify/SKILL.md).

## Seeded accounts (password `riven-local-pass-1`)

| key | email | state |
|---|---|---|
| `student` | student@riven.test | free, onboarded; class **BIO 101 Cell Biology**, deck **Cell Energy** (id 1001, 4 cards), note **Lecture 5: Cellular respiration**, 2 assignments |
| `pro` | pro@riven.test | Supporter (premium) for 30 days, onboarded, no content |
| `newbie` | new@riven.test | free, not onboarded (lands in onboarding) |

## Core flows

| Flow | Journey | What is proven | Not proven |
|---|---|---|---|
| [Audio to notes](./audio-to-notes.md) | `audio-to-notes` | record → live transcript → stop → Enhance → enhanced note | iOS native recorder, tab audio, 4 h limit, offline resume |
| [Syllabus upload](./syllabus-upload.md) | `syllabus-upload` | upload → AI fills class form → class, times, assignments saved | PDF / image parsing (text file only) |
| [YouTube import](./youtube-import.md) | `youtube-import` | URL → notes + deck via `ai_jobs` with Realtime progress | tutor / exam outputs, real caption scraping |
| [Flashcards](./flashcards.md) | `flashcards` | AI deck from notes (streaming) → study → FSRS grades + session saved | manual deck, mobile swipe, free review |
| [Mock exams](./mock-exams.md) | `mock-exam` | exam from note → simulation → submit → results + attempt | practice mode, AI short-answer grading, blueprints |
| [AI tutor](./ai-tutor.md) | `ai-tutor` | session from note (skeleton + teaching) → chat → AI-graded answer | full session completion, file / topic-only sources |
| [Canvas sync](./canvas-sync.md) | `canvas-sync` | paste feed → courses + assignments imported | native school search, auto-sync cron, semester cleanup |
| [Billing / paywall](./billing-paywall.md) | `billing-paywall` | quota exhausted → paywall, no AI call; Upgrade → Stripe Checkout redirect | webhook → premium, portal, RevenueCat (iOS) |

`sign-in` covers email/password login and the account-to-auth link. `group-propose`
covers creating a study group and proposing a session in the evening (audit #16).

## What the stack fakes (and what it does not)

Real: Postgres with every migration, RLS, triggers and pg_cron jobs; Supabase Auth,
PostgREST, Storage and Realtime; every edge function's code; the Express API; the
React app. Faked at the network boundary only: OpenAI, Gemini embeddings, Deepgram
(batch, callback and the browser's live WebSocket), transcriptapi.com, YouTube,
Canvas iCal feeds, Stripe and Resend (`scripts/verify/fakes/`). Edge functions share
one Deno process instead of one isolate each; the gateway JWT check is reproduced from
`verify_jwt` in `supabase/config.toml` (`scripts/verify/edge/gatewayJwt.ts`).

AI output is canned per prompt, so the journeys prove plumbing (requests, parsing,
storage, UI) and not model quality. A prompt change that no fixture matches shows up
as `openai.chat:unrouted` in `summary.json` → `unroutedExternal`.

## Known stack flakes

- **Kong keep-alive 502** (`upstream prematurely closed connection`): rare, local
  gateway only. `--retry 1` re-seeds and reruns; the result is marked `flaky`.
- **`audio-to-notes` enhancement rail can stall** after the job has completed. This
  looks like an app bug, not a stack flake: see `docs/health-audit.md`.
