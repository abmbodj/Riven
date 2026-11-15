#!/usr/bin/env bash
# Stop the preview this skill started and remove its build. Evidence in
# client/test-results/verify-riven/<run>/ is kept.
set -uo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
RUN="$ROOT/client/test-results/verify-riven/.run"

if [ -f "$RUN/preview.pid" ]; then
  PID="$(cat "$RUN/preview.pid")"
  if kill -0 "$PID" 2>/dev/null && tr '\0' ' ' < "/proc/$PID/cmdline" | grep -q "vite.js preview"; then
    kill "$PID" && echo "stopped preview pid $PID"
  else
    echo "pid $PID not running or not ours; nothing to stop"
  fi
fi
rm -rf "$RUN"
echo "evidence kept in $ROOT/client/test-results/verify-riven/"
ls -1 "$ROOT/client/test-results/verify-riven/" 2>/dev/null | tail -5
