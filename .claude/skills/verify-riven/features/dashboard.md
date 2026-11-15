# Dashboard (Home)

After sign-in the student lands on Home at `/dashboard`. It shows due assignments, recent decks and study items, the weekly study summary (cards studied, accuracy, minutes), the streak, and a study-coach recommendation. All of it comes from one bootstrap payload.

## Sub-features

- `dash-ready` renders and sets `data-dashboard-ready="true"` once the bootstrap resolves.
- `dash-weekly` weekly summary: accuracy percent and daily breakdown.
- `dash-recent` recent decks and study items link to their deck or guide.
- `dash-nav` primary navigation (Today, Study, Classes, Groups) routes correctly.
- `dash-cached` paints from the session cache while revalidating (covered by `client/e2e/dashboard-performance.spec.js`, not by this skill).

## How to get to it (user POV)

- Sign in. The app routes to `/dashboard`.
- Choose `Today` in the sidebar.
- Open `/dashboard` directly while signed in.

## Driving it with verify-riven

Preconditions:

- Default seed. The bootstrap comes from `seed.fixtures.dashboard`, which the client reads through `window.__RIVEN_E2E_FIXTURES__` rather than the `get_dashboard_bootstrap` RPC.

- **Ready.** `page.goto('/dashboard')`. Then `[data-dashboard-ready="true"]` is visible, along with the heading `Home`.
- **Weekly.** The text `86%` is visible. It comes from `weeklySummary.accuracy: 0.86`.
- **Recent.** The text `Cell Biology` is visible.
- **Nav.** Click `getByRole('link', { name: 'Classes', exact: true }).first()`. The URL ends in `/classes` and shows `Calculus`.
- **No writes.** `writes` contains no insert, update or delete.
- Run it: `node .claude/skills/verify-riven/scripts/journeys/dashboard.mjs`.

## Gotchas

- Dashboard data comes from fixtures, not from `seed.tables`. To change what Home shows, edit `seed.fixtures.dashboard`.
- A theme overlay animates in. Screenshots taken immediately after `goto` may still be fading.
