#!/usr/bin/env bash
# Run every journey against a running instance (launch.sh first). Exit 1 if any fail.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/doctor.sh" >/dev/null || { "$DIR/doctor.sh"; exit 1; }
fail=0
for j in "$DIR"/journeys/*.mjs; do node "$j" || fail=1; done
exit $fail
