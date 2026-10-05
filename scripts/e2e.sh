#!/usr/bin/env bash
set -euo pipefail
STACK_NAME=e2e
API_PORT="${API_PORT:-4450}" WEB_PORT="${WEB_PORT:-4451}" MODELS_PORT="${MODELS_PORT:-4452}"
source "$(dirname "$0")/stack.sh"
stack_init e2e

finish() {
  local code=$?
  set +e
  stack_cleanup
  if [ "$code" -eq 0 ]; then echo "e2e: PASSED (logs in $LOG_DIR)"; else echo "e2e: FAILED ($code), logs in $LOG_DIR"; fi
  exit "$code"
}
trap finish EXIT INT TERM

check_ports "$API_PORT" "$WEB_PORT" "$MODELS_PORT"
build_frontend
start_keycloak
start_models
(cd "$BACKEND" && "$VENV/kb-seed" --mode inline >"$LOG_DIR/seed.log" 2>&1)
tail -n 1 "$LOG_DIR/seed.log"
start_workers
start_api
start_web
(cd "$FRONTEND" && BASE_URL="http://127.0.0.1:$WEB_PORT" API_URL="http://127.0.0.1:$API_PORT" \
  KEYCLOAK_URL="http://127.0.0.1:4480" npx playwright test "$@")
