#!/usr/bin/env bash
# Build the Riven SPA in E2E-fixture mode and serve it with `vite preview`.
# Usage: .claude/skills/verify-riven/scripts/launch.sh
# Env:   RIVEN_VERIFY_PORT (default 4174)  RIVEN_VERIFY_SKIP_BUILD=1 (reuse last build)
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
CLIENT="$ROOT/client"
RUN="$CLIENT/test-results/verify-riven/.run"
PORT="${RIVEN_VERIFY_PORT:-4174}"
URL="http://127.0.0.1:$PORT"

if curl -s -o /dev/null "$URL/"; then
  if [ -f "$RUN/preview.pid" ] && kill -0 "$(cat "$RUN/preview.pid")" 2>/dev/null; then
    echo "already running: $URL (pid $(cat "$RUN/preview.pid")). Run doctor.sh, or cleanup.sh first."
    exit 0
  fi
  echo "port $PORT is taken by a process this skill did not start. Pick another: RIVEN_VERIFY_PORT=4175 $0" >&2
  exit 1
fi

mkdir -p "$RUN"
cd "$CLIENT"
[ -d node_modules ] || npm ci --no-audit --no-fund

if [ "${RIVEN_VERIFY_SKIP_BUILD:-}" != "1" ] || [ ! -f "$RUN/dist/index.html" ]; then
  echo "building fixture bundle -> $RUN/dist"
  VITE_SUPABASE_URL=https://example.supabase.co \
  VITE_SUPABASE_ANON_KEY=e2e-anon-key \
  VITE_E2E_FIXTURES=true \
    node node_modules/vite/bin/vite.js build --outDir "$RUN/dist" --emptyOutDir > "$RUN/build.log" 2>&1 \
    || { tail -30 "$RUN/build.log" >&2; exit 1; }
  { echo "commit=$(git rev-parse HEAD)"; echo "dirty=$(git status --porcelain -- src index.html vite.config.js | wc -l)"; date -u +built=%FT%TZ; } > "$RUN/build.stamp"
fi

nohup node node_modules/vite/bin/vite.js preview --outDir "$RUN/dist" --host 127.0.0.1 --port "$PORT" --strictPort \
  > "$RUN/preview.log" 2>&1 &
echo $! > "$RUN/preview.pid"
echo "$PORT" > "$RUN/port"

for _ in $(seq 1 60); do
  if curl -s "$URL/" | grep -q 'id="root"'; then
    echo "ready: $URL (pid $(cat "$RUN/preview.pid"))"
    exit 0
  fi
  kill -0 "$(cat "$RUN/preview.pid")" 2>/dev/null || { cat "$RUN/preview.log" >&2; exit 1; }
  sleep 0.5
done
echo "preview did not become ready in 30s; see $RUN/preview.log" >&2
exit 1
