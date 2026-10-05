#!/usr/bin/env bash
set -euo pipefail
STACK_NAME=smoke
API_PORT="${API_PORT:-4460}" WEB_PORT="${WEB_PORT:-4461}" MODELS_PORT="${MODELS_PORT:-4462}"
source "$(dirname "$0")/stack.sh"
stack_init smoke

finish() {
  local code=$?
  set +e
  stack_cleanup
  if [ "$code" -eq 0 ]; then
    echo "smoke: PASSED (logs in $LOG_DIR)"
  else
    echo "smoke: FAILED with exit code $code (logs in $LOG_DIR)"
    tail -n 25 "$LOG_DIR"/*.log 2>/dev/null || true
  fi
  exit "$code"
}
trap finish EXIT INT TERM

"$ROOT/../devinfra/status.sh" | grep -E "postgres|redis|minio"
check_ports "$API_PORT" "$WEB_PORT" "$MODELS_PORT"

echo "smoke: building frontend"
build_frontend
start_keycloak
start_models
echo "smoke: creating ${KB_DATABASE_URL##*/} and migrating"
(cd "$BACKEND" && "$VENV/kb-seed" --migrate-only >"$LOG_DIR/migrate.log" 2>&1)
start_workers
start_api
start_web
echo "smoke: seeding the Northwind corpus through Celery"
(cd "$BACKEND" && "$VENV/kb-seed" --mode celery --wait 900 >"$LOG_DIR/seed.log" 2>&1)
tail -n 1 "$LOG_DIR/seed.log"
"$VENV/python" "$BACKEND/scripts/smoke_checks.py" \
  --api "http://127.0.0.1:$API_PORT" --web "http://127.0.0.1:$WEB_PORT" \
  --keycloak "http://127.0.0.1:4480" --worker-log "$LOG_DIR/worker.log" --beat-log "$LOG_DIR/beat.log" \
  --fixture "$ROOT/backend/tests/fixtures/hard.pdf"
