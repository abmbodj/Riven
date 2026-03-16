---
status: investigating
trigger: "Here is a screenshot of an error. Hearts also dont load so I thibk this issue effects multiple diffrent things."
created: 2026-03-16T17:53:00Z
updated: 2026-03-16T18:03:00Z
---

## Current Focus

hypothesis: `getHeartsStatus` always calls Supabase edge function and sends legacy app JWT when no Supabase session is present, producing "Invalid JWT" and breaking hearts load
test: run hearts API unit tests that assert legacy-token fallback behavior; inspect failure pattern
expecting: failing test(s) should indicate missing fallback to legacy hearts route
next_action: execute targeted hearts auth API test file in client workspace

## Symptoms

expected: hearts and related deck/study data should load normally
actual: hearts request returns 401 and UI sections depending on that data do not load
errors: API response contains message "Invalid JWT" with code 401 on hearts action endpoint
reproduction: open deck/study view where hearts are fetched; network shows hearts?action=status failing with 401
started: unknown

## Eliminated

## Evidence

- timestamp: 2026-03-16T17:54:00Z
	checked: user-provided screenshot network panel
	found: GET hearts?action=status returns 401 with message "Invalid JWT" while some other requests return 200
	implication: authentication token handling is at least partially broken for this request path and may impact multiple features

- timestamp: 2026-03-16T17:56:00Z
	checked: local debug knowledge base
	found: no `.planning/debug/knowledge-base.md` present
	implication: no prior pattern match available; proceed with fresh hypothesis testing

- timestamp: 2026-03-16T17:56:00Z
	checked: repository search for auth/hearts references
	found: hearts/auth logic is concentrated in `client/src/api/authApi.js` with dedicated tests including `authApi.hearts.test.js`
	implication: likely reproducible and diagnosable in client auth API layer

- timestamp: 2026-03-16T18:00:00Z
	checked: `client/src/api/authApi.js` hearts section
	found: hearts calls (`getHeartsStatus`, `getSessionHearts`, `decrementHeart`, `refillHearts`, `practiceRefill`) always use `edgeFunctionFetch('hearts', ...)` with no explicit legacy fallback
	implication: users authenticated with legacy app JWT (without Supabase session) will call the edge endpoint with a token Supabase rejects

- timestamp: 2026-03-16T18:00:00Z
	checked: server and edge hearts implementations
	found: legacy Express hearts routes exist at `/api/users/hearts/*`, while edge function requires valid Supabase bearer auth via `resolveSupabaseUser`
	implication: compatibility fallback path is required to support accounts still on legacy token flow

- timestamp: 2026-03-16T18:03:00Z
	checked: test execution setup
	found: initial attempts failed due wrong package-level script usage and unsupported vitest flag; one rerun was user-cancelled
	implication: rerun correct command (`client` package, no `--runInBand`) to gather definitive evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
