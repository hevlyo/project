#!/usr/bin/env bash
set -euo pipefail

# Deploy script
# 1) rsync workspace to remote host
# 2) bun install on remote
# 3) build apps and restart app (prefer systemd service when configured)
# 4) verify local and public HTTP health checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-server}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/hevlyo/pegabola3000}"
REMOTE_NODE_BIN="${REMOTE_NODE_BIN:-/usr/bin/node}"
REMOTE_PORT="${REMOTE_PORT:-25565}"
PUBLIC_URL="${PUBLIC_URL:-https://pegabola.goathub.space}"
REMOTE_APP_SERVICE="${REMOTE_APP_SERVICE:-}"
REMOTE_APP_SERVICE_SCOPE="${REMOTE_APP_SERVICE_SCOPE:-system}"
LOCAL_DEPLOY_REV="${LOCAL_DEPLOY_REV:-$(git -C "${REPO_ROOT}" rev-parse --short=12 HEAD 2>/dev/null || echo 'unknown')}"
DEPLOYED_AT_UTC="${DEPLOYED_AT_UTC:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

EXCLUDES=(
  "--exclude" ".git"
  "--exclude" "node_modules"
  "--exclude" "output"
  "--exclude" ".codex"
)

log() {
  printf '[deploy] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd rsync
require_cmd ssh
require_cmd curl

wait_for_remote_http_200() {
  local url="$1"
  local attempts="${2:-20}"
  local delay_seconds="${3:-1}"
  local status="000"

  for _ in $(seq 1 "${attempts}"); do
    status="$(ssh "${REMOTE_HOST}" "curl -s -o /dev/null -w '%{http_code}' ${url}" | tr -d '\r')"
    if [[ "${status}" == "200" ]]; then
      printf '%s' "${status}"
      return 0
    fi
    sleep "${delay_seconds}"
  done

  printf '%s' "${status}"
  return 1
}

fetch_remote_body() {
  local url="$1"
  ssh "${REMOTE_HOST}" "curl -sS ${url}" | tr -d '\r'
}

log "Starting deploy to ${REMOTE_HOST}:${REMOTE_APP_DIR}"

log "Syncing files with rsync"
rsync -az --delete "${EXCLUDES[@]}" "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_APP_DIR}/"

log "Ensuring bun exists on remote"
ssh "${REMOTE_HOST}" "if ! command -v bun >/dev/null 2>&1; then curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1; fi"

log "Installing dependencies on remote"
ssh "${REMOTE_HOST}" 'export PATH="$HOME/.bun/bin:$PATH"; cd '"${REMOTE_APP_DIR}"' && bun install'

log "Building TypeScript on remote"
ssh "${REMOTE_HOST}" 'export PATH="$HOME/.bun/bin:$PATH"; cd '"${REMOTE_APP_DIR}"' && bun run build'

log "Stamping deployed revision"
ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && printf '{\"revision\":\"%s\",\"deployedAt\":\"%s\"}\n' '${LOCAL_DEPLOY_REV}' '${DEPLOYED_AT_UTC}' > apps/game/dist/deploy-version.json"

if [[ -z "${REMOTE_APP_SERVICE}" ]]; then
  DETECTED_SERVICE="$(ssh "${REMOTE_HOST}" 'if systemctl --user list-unit-files 2>/dev/null | grep -q "^pegabola-app.service"; then echo "user:pegabola-app.service"; elif systemctl list-unit-files 2>/dev/null | grep -q "^pegabola-app.service"; then echo "system:pegabola-app.service"; fi' | tr -d '\r' | tail -n 1)"
  if [[ -n "${DETECTED_SERVICE}" ]]; then
    REMOTE_APP_SERVICE_SCOPE="${DETECTED_SERVICE%%:*}"
    REMOTE_APP_SERVICE="${DETECTED_SERVICE#*:}"
    log "Auto-detected systemd service: ${REMOTE_APP_SERVICE} (${REMOTE_APP_SERVICE_SCOPE})"
  fi
fi

if [[ -n "${REMOTE_APP_SERVICE}" ]]; then
  log "Restarting remote app via systemd service: ${REMOTE_APP_SERVICE} (${REMOTE_APP_SERVICE_SCOPE})"
  if [[ "${REMOTE_APP_SERVICE_SCOPE}" == "user" ]]; then
    REMOTE_PID="$(ssh "${REMOTE_HOST}" "systemctl --user daemon-reload && systemctl --user restart ${REMOTE_APP_SERVICE} && systemctl --user is-active --quiet ${REMOTE_APP_SERVICE} && systemctl --user show -p MainPID --value ${REMOTE_APP_SERVICE}" | tr -d '\r' | tail -n 1)"
  else
    REMOTE_PID="$(ssh "${REMOTE_HOST}" "(sudo -n systemctl daemon-reload && sudo -n systemctl restart ${REMOTE_APP_SERVICE} && sudo -n systemctl is-active --quiet ${REMOTE_APP_SERVICE} && sudo -n systemctl show -p MainPID --value ${REMOTE_APP_SERVICE}) || (systemctl daemon-reload && systemctl restart ${REMOTE_APP_SERVICE} && systemctl is-active --quiet ${REMOTE_APP_SERVICE} && systemctl show -p MainPID --value ${REMOTE_APP_SERVICE})" | tr -d '\r' | tail -n 1)"
  fi
else
  log "Restarting remote app with nohup (no systemd service configured)"
  REMOTE_PID="$(ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && PID_FILE=apps/server/server.pid && if [ -f \"\$PID_FILE\" ]; then OLD_PID=\$(cat \"\$PID_FILE\" 2>/dev/null || true); if [ -n \"\$OLD_PID\" ] && kill -0 \"\$OLD_PID\" >/dev/null 2>&1; then kill \"\$OLD_PID\" >/dev/null 2>&1 || true; fi; fi; PIDS=\$(pgrep -f '^${REMOTE_NODE_BIN}[[:space:]]+apps/server/dist/server\\.js$' || true); if [ -n \"\$PIDS\" ]; then kill \$PIDS >/dev/null 2>&1 || true; fi; nohup ${REMOTE_NODE_BIN} apps/server/dist/server.js > server.log 2>&1 < /dev/null & echo \$! | tee \"\$PID_FILE\"" | tr -d '\r' | tail -n 1)"
fi

if [[ -z "${REMOTE_PID}" ]]; then
  printf 'Failed to start remote process (empty pid).\n' >&2
  exit 1
fi

log "Remote app pid: ${REMOTE_PID}"

log "Checking remote local health endpoint"
LOCAL_STATUS="$(wait_for_remote_http_200 "http://127.0.0.1:${REMOTE_PORT}" 25 1 || true)"
if [[ "${LOCAL_STATUS}" != "200" ]]; then
  printf 'Remote local health check failed: %s\n' "${LOCAL_STATUS}" >&2
  exit 1
fi

log "Checking public URL health endpoint"
PUBLIC_STATUS="$(wait_for_remote_http_200 "${PUBLIC_URL}" 25 1 || true)"
if [[ "${PUBLIC_STATUS}" != "200" ]]; then
  printf 'Public health check failed: %s\n' "${PUBLIC_STATUS}" >&2
  exit 1
fi

log "Verifying deployed revision on local endpoint"
LOCAL_VERSION_BODY="$(fetch_remote_body "http://127.0.0.1:${REMOTE_PORT}/deploy-version.json?v=${LOCAL_DEPLOY_REV}" || true)"
if [[ "${LOCAL_VERSION_BODY}" != *"\"revision\":\"${LOCAL_DEPLOY_REV}\""* ]]; then
  printf 'Local deploy revision mismatch. Expected %s, got: %s\n' "${LOCAL_DEPLOY_REV}" "${LOCAL_VERSION_BODY}" >&2
  exit 1
fi

log "Verifying deployed revision on public endpoint"
PUBLIC_VERSION_BODY="$(fetch_remote_body "${PUBLIC_URL}/deploy-version.json?v=${LOCAL_DEPLOY_REV}" || true)"
if [[ "${PUBLIC_VERSION_BODY}" != *"\"revision\":\"${LOCAL_DEPLOY_REV}\""* ]]; then
  printf 'Public deploy revision mismatch. Expected %s, got: %s\n' "${LOCAL_DEPLOY_REV}" "${PUBLIC_VERSION_BODY}" >&2
  exit 1
fi

log "Deploy completed successfully"
log "Remote local status: ${LOCAL_STATUS}"
log "Public status: ${PUBLIC_STATUS}"
log "Revision: ${LOCAL_DEPLOY_REV}"
