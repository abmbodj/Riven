# Verification stack: failed approaches and why

Logged so they are not retried. Context: building `scripts/verify/` (Phase 1 of the
2026-11 quality pass) in a Claude Code cloud container (Docker available, egress through
a TLS-intercepting proxy, open-file hard limit 20000).

| # | Tried | What happened | What works instead |
|---|---|---|---|
| 1 | `npx supabase@2.58.5 start` | `config.toml` has keys this CLI does not know (`db.health_timeout`, `storage.analytics`…) | CLI `2.99.0` (pinned in `lib/config.mjs`) |
| 2 | Default image registry `public.ecr.aws` | Blob downloads (CloudFront) refused by the egress proxy | `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` |
| 3 | Letting `supabase start` apply `supabase/migrations/` | Fails on the first migration: production's base tables predate the migration history | Migrations disabled at start; `lib/schema.mjs` replays legacy `initDb` → gap file → migrations |
| 4 | Supabase `edge-runtime` container (`supabase start` / `functions serve`) | `error setting rlimits … type 7: operation not permitted` (asks for more open files than the sandbox allows) | — |
| 5 | Running the edge-runtime image by hand with a lower `--ulimit` and a custom main service | Starts, but user workers ignore `DENO_CERT`/system CA for npm fetches (`UnknownIssuer`) behind the TLS proxy | Host Deno (`edge/host.ts`) honors `DENO_CERT` |
| 6 | Forwarding the host's egress proxy into containers | Denied by the session's permission policy | Do not retry; containers do not need egress with approach 5's replacement |
| 7 | `deno.land` / `esm.sh` imports from the default environment | `unsuccessful tunnel` (hosts not allowed) | Personal cloud environment "Riven" allowing exactly those two hosts |
| 8 | Capturing handlers by patching `Deno.serve` only | Functions use std@0.224 `serve`, which opens its own listener | Import-map shim `edge/std-serve-shim.ts` |
| 9 | `nodeModulesDir: "auto"` for the host | Deno's CJS resolution walked up into the repo-root `node_modules` (`supports-color`), `require is not defined`, host crashed | `nodeModulesDir: "none"` (global npm cache) + `unhandledrejection` guard |
| 10 | Excluding Realtime from the stack | YouTube import never finishes: the page listens to `ai_jobs` over Realtime only | Realtime enabled |
| 11 | `SUPABASE_URL=http://127.0.0.1:54321` for edge functions | `note_enhancement` fails with `DEEPGRAM_CALLBACK_INVALID` (callback must be https) | Project URL `https://supabase.riven.local`, rewritten to Kong by the fetch fake |
| 12 | Concurrent first requests to one function | Second request saw another module's handler (`did not call Deno.serve`) | Serialized imports, one load promise per function |
| 13 | Asserting a study session after `page.goto` away | Study mode saves on unmount; a hard reload never saves | Leave through the app's **Back to Deck** link |

## Schema drift found while rebuilding locally

Production differs from what the repo can build. The local stack patches these in
`scripts/verify/db/10-baseline-gaps.sql` (local only, never a migration):

- `users.supabase_auth_id` exists in production but in neither `initDb` nor a migration
  (`get_app_user_id()` depends on it).
- `users.password` must be nullable in production (sign-up inserts none); `initDb` says
  `NOT NULL`.
- `public.user_internal_id()` exists only in production (a migration alters it; nothing
  calls it).
- Storage buckets `avatars` and `group-files` are used by the app but created by no
  migration.

A `supabase db dump --schema public` from production would replace this guesswork with a
real baseline; it needs project credentials.
