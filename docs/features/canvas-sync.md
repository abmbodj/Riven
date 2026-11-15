# Canvas sync

Import courses and assignments from Canvas through the student's read-only Canvas
calendar feed (iCal). Re-syncs hourly via pg_cron for opted-in users.

## How to reach it (user)

Web: Classes → **Add class** → **Canvas Sync** → **Connect Calendar Feed** → paste the
`…/feeds/calendars/user_….ics` link → **Connect Calendar Feed**. iOS adds a school
search and an in-app browser to capture the link. Also under Settings → Integrations.

## What runs

- `canvas-lms` edge function: `validateCanvasFeedUrl` (https, allowed host, must contain
  `/feeds/calendars/`; SSRF guard) → fetch + parse iCal (`_shared/canvasLmsCore.mjs`) →
  upsert `classes` (by course) and `assignments` (by `canvas_assignment_id`), store
  `users.canvas_ical_url`, apply the free-tier sync quota (`lms_sync_count`).
- `canvas-lms-auto-sync` hourly via pg_cron.

## Drive it

```bash
node scripts/verify/riven-verify.mjs run canvas-sync
```

Feed URL `https://riven-test.instructure.com/feeds/calendars/user_verify123.ics` is
answered by the Canvas fake (two assignments for "BIO 101 Cell Biology", dated relative
to now). Asserts 2 assignments imported, feed URL stored, class visible on `/classes`.

## Gotchas

- The feed is fetched twice per connect (connect + immediate sync).
