# Riven — agent & contributor guide

Riven turns class material into focused study sessions (AI decks, guides, exams,
groups, gamified garden). Monorepo with three deploy targets.

## Architecture (read before changing backend code)

- **`client/`** — React 19 + Vite SPA, Capacitor iOS wrapper. The SPA is the only
  frontend; it talks to Supabase edge functions for almost everything.
- **`supabase/`** — Postgres (RLS on every table) + 35 Deno edge functions +
  migrations. **This is the primary backend.** All AI generation, study sessions,
  groups, admin, payments-sync, and social features route here via
  `edgeFunctionFetch` (`client/src/api/authApi.js`).
- **`server/`** — Express 5 on Render. A **legacy bridge**, not the main backend.
  It handles only: 2FA-enabled OAuth, Canvas/LMS iCal, Stripe checkout/portal/
  webhooks, hearts, referrals, shared-resource accept, and the Supabase
  email/recovery bridge. The AI/study/groups/admin Express routes were dead code
  and were removed in the 2026-06 remediation — do not re-add them; add features as
  edge functions.

Shared business logic lives in `supabase/functions/_shared/*.mjs` and is unit-tested
from **both** runtimes (Node via `server/test/*-core.test.js`, Deno at runtime). Keep
those modules runtime-agnostic (no Node-only or Deno-only APIs).

## Commands

```bash
# from repo root
npm start                      # run server + client together

# server (cwd: server/)
npx vitest run                 # unit tests (fake DATABASE_URL/JWT_SECRET injected)

# client (cwd: client/)
npx vitest run                 # unit tests (jsdom)
npx eslint .                   # must be error-free (warnings allowed)
npx vite build                 # production build

# edge functions
deno check supabase/functions/<name>/index.ts
```

## Security invariants (do not regress — see docs/reviews/)

- **Auth:** legacy Express JWTs carry a `jti` and are revocable via the
  `revoked_tokens` denylist + `users.tokens_invalid_before` (`server/tokenRevocation.js`).
  Supabase access tokens are validated upstream and are short-lived.
- **CSRF:** enforced whenever the auth cookie is present; bearer-only (Capacitor)
  requests are exempt. Return the literal `{ error: 'CSRF token mismatch' }` so the
  client auto-retries after priming `GET /api/csrf`.
- **SSRF:** any server-side fetch of a user-supplied URL must go through
  `server/utils/ssrfGuard.js` (Express) or `validateCanvasFeedUrl`
  (`supabase/functions/_shared/canvasLmsCore.mjs`).
- **RLS:** never widen an INSERT policy to let users insert their own membership/
  ownership rows; gate joins through a service-role edge function that validates the
  invite/join code. New `SECURITY DEFINER` functions must `SET search_path`.
- **Entitlements:** never trust a client-supplied subscriber id / tier / XP. Sync the
  caller's own RevenueCat subscriber; recompute XP server-side from DB state.
- **Secrets:** the TruffleHog pre-commit hook is skippable with `--no-verify`; CI is
  the backstop. Never commit `.env` or live keys.

## Conventions

- Match the surrounding file's style. Express routes are registered via
  `register*Routes({ app, db, authMiddleware, ... })` from `server/index.js`.
- Client API calls go through `client/src/api/authApi.js` (and its `api.js` wrapper).
- Tests that mock `authApi` must spread the real module
  (`vi.mock('.../authApi', async (importOriginal) => ({ ...(await importOriginal()), ...overrides }))`)
  so unrelated exports don't become `undefined`.
