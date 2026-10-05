#!/usr/bin/env bash
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv/bin"
PIDS=()
STARTED_KEYCLOAK=0

stack_init() {
  local name="$1"
  RUN_ID="$(date +%s)$$"
  LOG_DIR="$ROOT/.run/$name-$RUN_ID"
  mkdir -p "$LOG_DIR"
  export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-1}"
  export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
  export KB_DATABASE_URL="postgresql+asyncpg://${PGUSER:-asnh}@127.0.0.1:5432/kb_test_${name}_${RUN_ID}"
  export KB_S3_BUCKET="kb-test-${name}-${RUN_ID}"
  export KB_REDIS_PREFIX="kb${name}${RUN_ID}"
  export KB_REDIS_URL="redis://127.0.0.1:6379/4"
  export KB_BROKER_URL="redis://127.0.0.1:6379/4"
  export KB_S3_ENDPOINT=127.0.0.1:9002 KB_S3_PUBLIC_ENDPOINT=127.0.0.1:9002
  export KB_OIDC_ISSUER="http://127.0.0.1:4480/realms/northwind"
  export KB_MODELS_URL="http://127.0.0.1:${MODELS_PORT}"
  export KB_API_PORT="$API_PORT"
  export KB_PUBLIC_URL="http://127.0.0.1:$API_PORT"
  export KB_CORS_ORIGINS="[\"http://127.0.0.1:$WEB_PORT\",\"http://localhost:$WEB_PORT\"]"
  export KB_LLM_PROVIDER=fake KB_FAKE_LLM_DELAY_MS="${KB_FAKE_LLM_DELAY_MS:-15}"
  export KB_CHAT_RATE_LIMIT_PER_MINUTE=1000
  export KB_VISIBILITY_TIMEOUT=60
}

stack_cleanup() {
  local code=$?
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" >/dev/null 2>&1 || true
  done
  sleep 2
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && pkill -9 -P "$pid" >/dev/null 2>&1 || true
    [ -n "$pid" ] && kill -9 "$pid" >/dev/null 2>&1 || true
  done
  if [ "$STARTED_KEYCLOAK" = 1 ]; then "$ROOT/scripts/keycloak.sh" stop >/dev/null 2>&1 || true; fi
  psql -h 127.0.0.1 postgres -qc "DROP DATABASE IF EXISTS \"${KB_DATABASE_URL##*/}\" WITH (FORCE)" >/dev/null 2>&1 || true
  "$VENV/python" - <<PY >/dev/null 2>&1 || true
from minio import Minio
c = Minio("127.0.0.1:9002", access_key="minioadmin", secret_key="minioadmin", secure=False)
if c.bucket_exists("$KB_S3_BUCKET"):
    for o in c.list_objects("$KB_S3_BUCKET", recursive=True):
        c.remove_object("$KB_S3_BUCKET", o.object_name)
    c.remove_bucket("$KB_S3_BUCKET")
PY
  redis-cli -n 4 --scan --pattern "${KB_REDIS_PREFIX}:*" 2>/dev/null | xargs -r redis-cli -n 4 del >/dev/null 2>&1 || true
  return $code
}

wait_for() {
  local url="$1" name="$2" tries="${3:-180}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then echo "$STACK_NAME: $name is up"; return 0; fi
    sleep 1
  done
  echo "$STACK_NAME: $name did not start" >&2
  return 1
}

check_ports() {
  for port in "$@"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "$STACK_NAME: port $port is already in use" >&2
      return 1
    fi
  done
}

start_keycloak() {
  if "$ROOT/scripts/keycloak.sh" status >/dev/null 2>&1; then
    echo "$STACK_NAME: reusing running Keycloak"
  else
    "$ROOT/scripts/keycloak.sh" start
    STARTED_KEYCLOAK=1
  fi
}

start_models() {
  (cd "$BACKEND" && KB_MODELS_PORT="$MODELS_PORT" exec "$VENV/kb-models" >"$LOG_DIR/models.log" 2>&1) &
  PIDS+=($!)
  wait_for "http://127.0.0.1:$MODELS_PORT/health" models 240
}

start_workers() {
  (cd "$BACKEND" && exec "$VENV/celery" -A kb.workers.celery_app worker -Q ingest,embed,sync,eval,maintenance \
    -c 2 --loglevel=INFO -n "$STACK_NAME-$RUN_ID@%h" >"$LOG_DIR/worker.log" 2>&1) &
  PIDS+=($!)
  (cd "$BACKEND" && exec "$VENV/celery" -A kb.workers.celery_app beat --loglevel=INFO \
    --schedule "$LOG_DIR/celerybeat-schedule" >"$LOG_DIR/beat.log" 2>&1) &
  PIDS+=($!)
}

start_api() {
  (cd "$BACKEND" && exec "$VENV/kb-api" >"$LOG_DIR/api.log" 2>&1) &
  PIDS+=($!)
  wait_for "http://127.0.0.1:$API_PORT/health/ready" api 120
}

build_frontend() {
  if [ "${SKIP_FRONTEND_BUILD:-0}" != 1 ]; then
    (cd "$FRONTEND" && npm run build >"$LOG_DIR/frontend-build.log" 2>&1)
  fi
}

start_web() {
  (cd "$FRONTEND" && PORT="$WEB_PORT" API_URL="http://127.0.0.1:$API_PORT" \
    OIDC_AUTHORITY="http://127.0.0.1:4480/realms/northwind" OIDC_CLIENT_ID=kb-web exec node scripts/serve.mjs \
    >"$LOG_DIR/web.log" 2>&1) &
  PIDS+=($!)
  wait_for "http://127.0.0.1:$WEB_PORT/" web 60
}
