#!/usr/bin/env bash
# Read-only: is the verify-riven instance worth driving? Exit 0 = yes.
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
CLIENT="$ROOT/client"
RUN="$CLIENT/test-results/verify-riven/.run"
fail=0
ok()  { echo "ok    $*"; }
bad() { echo "FAIL  $*"; fail=1; }
warn(){ echo "warn  $*"; }

[ -f "$RUN/preview.pid" ] || { echo "FAIL  no instance (run launch.sh)"; exit 1; }
PID="$(cat "$RUN/preview.pid")"; PORT="$(cat "$RUN/port" 2>/dev/null || echo 4174)"

if kill -0 "$PID" 2>/dev/null && tr '\0' ' ' < "/proc/$PID/cmdline" | grep -q "vite.js preview.*--port $PORT"; then
  ok "preview pid $PID is ours, port $PORT"
else
  bad "pid $PID is not our vite preview (stale .run? run cleanup.sh then launch.sh)"
fi

if curl -s "http://127.0.0.1:$PORT/" | grep -q 'id="root"'; then ok "serves the SPA at http://127.0.0.1:$PORT"; else bad "http://127.0.0.1:$PORT/ does not serve the SPA"; fi

if grep -rqs 'example.supabase.co' "$RUN/dist/assets"; then ok "bundle points at the fake Supabase (example.supabase.co)"; else bad "bundle is not a fixture build"; fi

if [ -f "$RUN/build.stamp" ]; then
  built_commit="$(sed -n 's/^commit=//p' "$RUN/build.stamp")"
  [ "$built_commit" = "$(git -C "$ROOT" rev-parse HEAD)" ] || warn "built at ${built_commit:0:9}, HEAD moved"
  newer="$(find "$CLIENT/src" "$CLIENT/index.html" -newer "$RUN/build.stamp" -type f 2>/dev/null | head -3)"
  if [ -n "$newer" ]; then bad "client source changed since build (e.g. ${newer%%$'\n'*}); rerun launch.sh after cleanup.sh"; else ok "build is fresh against client/src"; fi
fi

exit $fail
