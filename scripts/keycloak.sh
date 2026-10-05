#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KC_VERSION="${KC_VERSION:-26.8.0}"
KC_HOME="${KC_HOME:-$ROOT/.tools/keycloak-$KC_VERSION}"
KC_PORT="${KC_PORT:-4480}"
KC_MGMT_PORT="${KC_MGMT_PORT:-4481}"
RUN_DIR="$ROOT/.run"
PID_FILE="$RUN_DIR/keycloak.pid"
LOG_FILE="$RUN_DIR/keycloak.log"
mkdir -p "$RUN_DIR"

if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in /opt/homebrew/opt/openjdk@21 /opt/homebrew/opt/openjdk /usr/local/opt/openjdk@21; do
    if [ -x "$candidate/bin/java" ]; then export JAVA_HOME="$candidate"; break; fi
  done
fi

install_kc() {
  if [ -x "$KC_HOME/bin/kc.sh" ]; then return 0; fi
  if command -v brew >/dev/null 2>&1 && brew info keycloak >/dev/null 2>&1; then
    brew install keycloak
    KC_HOME="$(brew --prefix keycloak)/libexec"
    return 0
  fi
  mkdir -p "$ROOT/.tools"
  curl -sSL -o "$ROOT/.tools/keycloak.tar.gz" "https://github.com/keycloak/keycloak/releases/download/$KC_VERSION/keycloak-$KC_VERSION.tar.gz"
  tar xzf "$ROOT/.tools/keycloak.tar.gz" -C "$ROOT/.tools"
}

is_up() { curl -sf "http://127.0.0.1:$KC_PORT/realms/northwind/.well-known/openid-configuration" >/dev/null 2>&1; }

start() {
  if is_up; then echo "keycloak: already running on :$KC_PORT"; return 0; fi
  install_kc
  rm -rf "$KC_HOME/data/h2"
  mkdir -p "$KC_HOME/data/import"
  cp "$ROOT/infra/keycloak/realm-northwind.json" "$KC_HOME/data/import/realm-northwind.json"
  JAVA_OPTS_KC_HEAP="${JAVA_OPTS_KC_HEAP:--Xms64m -Xmx448m -XX:MaxMetaspaceSize=256m}" \
  KC_BOOTSTRAP_ADMIN_USERNAME="${KC_BOOTSTRAP_ADMIN_USERNAME:-kcadmin}" \
  KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-kcadmin}" \
  nohup "$KC_HOME/bin/kc.sh" start-dev --http-host=127.0.0.1 --http-port="$KC_PORT" \
    --http-management-port="$KC_MGMT_PORT" --hostname-strict=false --import-realm --cache=local \
    >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 180); do
    if is_up; then echo "keycloak: up on http://127.0.0.1:$KC_PORT (realm northwind)"; return 0; fi
    sleep 1
  done
  echo "keycloak: failed to start, see $LOG_FILE" >&2
  tail -n 40 "$LOG_FILE" >&2 || true
  return 1
}

stop() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE")"
    kill "$pid" >/dev/null 2>&1 || true
    for _ in $(seq 1 30); do kill -0 "$pid" >/dev/null 2>&1 || break; sleep 1; done
    kill -9 "$pid" >/dev/null 2>&1 || true
    rm -f "$PID_FILE"
  fi
  pkill -f "keycloak-$KC_VERSION.*--http-port=$KC_PORT" >/dev/null 2>&1 || true
  echo "keycloak: stopped"
}

token() {
  local user="${1:-alice}" password="${2:-demo}"
  curl -sf -X POST "http://127.0.0.1:$KC_PORT/realms/northwind/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=kb-web -d username="$user" -d password="$password" -d scope=openid \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) if is_up; then echo "keycloak: up"; else echo "keycloak: down"; exit 1; fi ;;
  token) shift; token "$@" ;;
  *) echo "usage: $0 start|stop|status|token [user] [password]" >&2; exit 2 ;;
esac
