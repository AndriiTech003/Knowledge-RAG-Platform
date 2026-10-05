#!/usr/bin/env bash
set -euo pipefail
STACK_NAME=load
API_PORT="${API_PORT:-4470}" WEB_PORT="${WEB_PORT:-4471}" MODELS_PORT="${MODELS_PORT:-4472}"
USERS="${USERS:-50}" SPAWN_RATE="${SPAWN_RATE:-10}" DURATION="${DURATION:-60s}" LABEL="${LABEL:-default}"
source "$(dirname "$0")/stack.sh"
stack_init load
OUT="$ROOT/docs/benchmarks/locust-$LABEL"
mkdir -p "$ROOT/docs/benchmarks"
trap 'stack_cleanup' EXIT INT TERM

check_ports "$API_PORT" "$MODELS_PORT"
start_keycloak
start_models
(cd "$BACKEND" && "$VENV/kb-seed" --mode inline >"$LOG_DIR/seed.log" 2>&1)
start_api
(cd "$BACKEND" && KC_URL="http://127.0.0.1:4480" "$VENV/locust" -f loadtest/locustfile.py --headless \
  -u "$USERS" -r "$SPAWN_RATE" -t "$DURATION" --host "http://127.0.0.1:$API_PORT" \
  --csv "$OUT" --html "$OUT.html" --only-summary) | tee "$LOG_DIR/locust.log"
curl -s "http://127.0.0.1:$API_PORT/metrics" | grep -E '^kb_rag_step_duration_seconds_(sum|count)' > "$OUT-rag-steps.txt"
echo "loadtest: results in $OUT*"
