# Riven — 2026-06 Security Remediation

**Branch:** `fix/2026-06-remediation`
**Source review:** [`2026-06-full-review.md`](./2026-06-full-review.md) (commit `e3f93e90`)
**Outcome:** all 6 HIGH and 9 MEDIUM findings fixed; LOW/INFO addressed or documented;
2 net-new bugs found and fixed during the work.

The decision on the dead Express layer was to **freeze the migration and delete the
dead routes**; JWT revocation uses a **`jti` denylist + `tokens_invalid_before`**.

## Phase / commit map

| Phase | Scope | Gate |
|-------|-------|------|
| P1 | Delete dead Express routes (ai/admin/groups/social + dead study handler) | server vitest, no regressions |
| P2 | Express hardening + Supabase auth bridge + server-test repairs | server vitest **157/157** |
| P3 | Supabase migration + edge-function hardening | `deno check` clean on all touched fns |
| P4a | Dependency bumps + `npm audit fix` (no `--force`) | client/server prod: **0 high/critical** |
| P4b/c | CSP headers, console strip, RC client pairing, mechanical/drift test fixes | client suite 508 → **524** passing |
| P4d | Clear all 23 ESLint errors | `eslint .` **0 errors**, `vite build` ok |
| P7 | CI, CLAUDE.md, remove tracked PNG, this doc | — |
| P6 | `authApi.js` modularization | client suite + build green |

## Finding → fix

| ID | Sev | Fix | Where |
|----|-----|-----|-------|
| RIV-001 | HIGH | Apple OAuth enforces expiry (`clockTolerance: 30`) | `server/routes/auth.js` |
| RIV-002 | HIGH | SSRF guard (https-only + private-IP/internal-host) on Canvas iCal, both paths | `server/utils/ssrfGuard.js`, `supabase/functions/_shared/canvasLmsCore.mjs` |
| RIV-003 | HIGH | Removed `rcAppUserIdOverride` (server + 3 client sites); env-driven sandbox; dropped PII logs | `supabase/functions/sync-revenuecat/index.ts`, `client/src/components/ui/PricingModal.jsx`, `client/src/pages/Settings.jsx` |
| RIV-004 | HIGH | `group_members_insert` policy is creator-only; joins go through the service-role edge fn | `supabase/migrations/20260610000000_*.sql` |
| RIV-005 | HIGH | `jti` on all 6 sign sites + `revoked_tokens` denylist + `tokens_invalid_before`; logout revokes, password change invalidates | `server/tokenRevocation.js`, `server/index.js`, `server/routes/auth.js`, `server/db.js` |
| RIV-006 | HIGH | `speedLimiter` + `authLimiter` on `/api/auth/2fa/verify` | `server/routes/auth.js` |
| RIV-007 | MED | CSP (Report-Only) + X-Frame-Options/nosniff/Referrer-Policy/HSTS/Permissions-Policy | `client/vercel.json` |
| RIV-008 | MED | CSRF enforced when auth cookie present; bearer-only exempt; first-request bypass closed | `server/index.js` |
| RIV-009 | MED | mimeType allowlist + magic-byte check before forwarding files to Gemini | `supabase/functions/_shared/aiCore.mjs` |
| RIV-010 | MED | Require `email_verified` on Google/Apple OAuth | `server/routes/auth.js` |
| RIV-011 | MED | `SET search_path` on all SECURITY DEFINER functions (DO-block) | `supabase/migrations/20260610000000_*.sql` |
| RIV-012 | MED | Rate limiter fails closed when Upstash absent in a hosted environment | `supabase/functions/_shared/rateLimit.ts` |
| RIV-013 | MED | Implemented `verifySupabaseTokenHash` + `verify-email`/`send-verification` bridge routes | `server/routes/auth.js` |
| RIV-014 | MED | 404 handler + sanitizing error handler | `server/index.js` |
| RIV-015 | MED | Dropped `*.vercel.app` CORS wildcard (Express + edge) | `server/index.js`, `supabase/functions/_shared/http.ts` |
| RIV-016/017 | LOW | react-router-dom→7.17, vitest→4.1.8, vite→7.3.5; `npm audit fix` | `client/package.json` |
| RIV-018 | LOW | Mechanical mock + clear-drift test fixes (see residual debt below) | various `*.test.*` |
| RIV-020 | LOW | DB-authoritative "before" state + XP cap in study-session-complete | `supabase/functions/study-session-complete/index.ts` |
| RIV-021 | LOW | Strip `console.warn`/`console.error` in prod builds | `client/vite.config.js` |
| RIV-022 | LOW | Read `stripe_customer_id` from DB in portal endpoint | `server/routes/stripe.js` |
| RIV-023 | LOW | All 23 ESLint errors cleared | ~12 client files |
| RIV-024 | LOW | Removed tracked 900KB `garden-landing-trees.png` | repo root |
| RIV-025 | LOW | `authApi.js` modularization | `client/src/api/` |
| RIV-026 | LOW | GitHub Actions CI + this CLAUDE.md | `.github/workflows/ci.yml`, `CLAUDE.md` |
| RIV-027 | LOW | Stripe webhook claim-then-process idempotency (TOCTOU fixed) + parity table | `supabase/functions/stripe-webhook/index.ts`, migration |
| RIV-031 | INFO | Edge CORS returns no ACAO for disallowed origins (was `*`) | `supabase/functions/_shared/http.ts` |

### Documented, not changed (by design)

- **RIV-028** (referral sybil): already requires the referred user to create a deck and
  complete N sessions before a referral qualifies. Accepted risk; revisit if abused.
- **RIV-030** (`config.toml` email confirmations / MFA off): product/ops decision, not
  flipped here.
- **RIV-032** (stale root `vercel.json` `builds`): the server runs on Render; the SPA
  uses `client/vercel.json`. Left as-is to avoid changing the deploy topology mid-fix.
- **RIV-019/029, S/B/C "killed" items**: see the original review's "Investigated and
  dismissed" section.

## Net-new findings (discovered during remediation)

- **N1 — Google OAuth access-token audience bypass (HIGH-ish).** The access-token
  fallback in `/api/auth/oauth/google` called `userinfo` with no audience check, so an
  access token minted for *any* Google app would log its holder in. **Fixed:** validate
  `aud === GOOGLE_CLIENT_ID` via `tokeninfo` before trusting the token.
- **N2 — Shared legacy guide data loss (MED).** Accepting a shared **v2** study guide
  ran it through a normalizer that returns `null` for the legacy `sections` shape,
  silently dropping `guide_data`. **Fixed:** preserve legacy guides verbatim with a
  reset progress state (`supabase/functions/_shared/acceptSharedDeckCore.mjs`).

## Residual client-test debt (pre-existing, out of scope)

The client suite improved from 508 → 524 passing. The remaining ~31 failures predate
this work and are **not security-related**; they fall into three buckets:

1. **Missing/renamed client API functions** the tests expect but that don't exist:
   `verifyEmail`, `acceptSharedDeck`, `checkReferralQualification`, `migrateGuestData`,
   `warmupAiFunctions`. These need feature implementation or test removal — a product
   decision, not a fix. (Note: the **server-side** `verify-email`/`send-verification`
   bridge *was* implemented under RIV-013; the missing piece is the client `verifyEmail`
   wrapper + a `verify-email` edge function.)
2. **Response-shape drift:** several endpoints now return more fields than the tests'
   `toEqual` fixtures assert (`authApi.userdata`, `authApi.auth-bridge`).
3. **UI-render drift:** `Onboarding`, `Messages` conversation list, and a few page tests
   assert against older copy/markup.

CI runs the client suite as **non-blocking** until this debt is cleared; server tests,
lint, and build are required.
