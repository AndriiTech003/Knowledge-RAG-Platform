#!/usr/bin/env bash
set -euo pipefail
STACK_NAME=lighthouse
API_PORT="${API_PORT:-4442}" WEB_PORT="${WEB_PORT:-4444}" MODELS_PORT="${MODELS_PORT:-4443}"
source "$(dirname "$0")/stack.sh"
stack_init lighthouse

finish() {
  local code=$?
  set +e
  stack_cleanup
  if [ "$code" -eq 0 ]; then echo "lighthouse: PASSED (logs in $LOG_DIR)"; else echo "lighthouse: FAILED ($code), logs in $LOG_DIR"; fi
  exit "$code"
}
trap finish EXIT INT TERM

check_ports "$API_PORT" "$WEB_PORT" "$MODELS_PORT"
build_frontend
start_keycloak
start_models
(cd "$BACKEND" && "$VENV/kb-seed" --mode inline >"$LOG_DIR/seed.log" 2>&1)
tail -n 1 "$LOG_DIR/seed.log"
start_api
start_web
(cd "$FRONTEND" && BASE_URL="http://127.0.0.1:$WEB_PORT" node scripts/lighthouse.mjs "$@")
