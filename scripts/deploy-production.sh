#!/usr/bin/env bash
set -euo pipefail

# Deploy script
# 1) rsync workspace to remote host
# 2) bun install on remote
# 3) build apps and restart app with detached nohup node apps/server/dist/server.js
# 4) verify local and public HTTP health checks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-server}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/hevlyo/pegabola3000}"
REMOTE_NODE_BIN="${REMOTE_NODE_BIN:-/usr/bin/node}"
REMOTE_PORT="${REMOTE_PORT:-25565}"
PUBLIC_URL="${PUBLIC_URL:-https://pegabola.goathub.space}"

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

log "Starting deploy to ${REMOTE_HOST}:${REMOTE_APP_DIR}"

log "Syncing files with rsync"
rsync -az --delete "${EXCLUDES[@]}" "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_APP_DIR}/"

log "Ensuring bun exists on remote"
ssh "${REMOTE_HOST}" "if ! command -v bun >/dev/null 2>&1; then curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1; fi"

log "Installing dependencies on remote"
ssh "${REMOTE_HOST}" 'export PATH="$HOME/.bun/bin:$PATH"; cd '"${REMOTE_APP_DIR}"' && bun install'

log "Building TypeScript on remote"
ssh "${REMOTE_HOST}" 'export PATH="$HOME/.bun/bin:$PATH"; cd '"${REMOTE_APP_DIR}"' && bun run build'

log "Restarting remote app with nohup"
REMOTE_PID="$(ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && PIDS=\$(pgrep -f '^${REMOTE_NODE_BIN}[[:space:]]+.*server\\.js$' || true) && if [ -n \"\$PIDS\" ]; then kill \$PIDS >/dev/null 2>&1 || true; fi; nohup ${REMOTE_NODE_BIN} apps/server/dist/server.js > server.log 2>&1 < /dev/null & echo \$!" | tr -d '\r' | tail -n 1)"

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

log "Deploy completed successfully"
log "Remote local status: ${LOCAL_STATUS}"
log "Public status: ${PUBLIC_STATUS}"
