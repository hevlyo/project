#!/usr/bin/env bash
set -euo pipefail

# Deploy script based on the method documented in progress.md:
# 1) rsync workspace to remote host
# 2) npm install on remote
# 3) restart app with detached nohup node server.js
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

log "Starting deploy to ${REMOTE_HOST}:${REMOTE_APP_DIR}"

log "Syncing files with rsync"
rsync -az --delete "${EXCLUDES[@]}" "${REPO_ROOT}/" "${REMOTE_HOST}:${REMOTE_APP_DIR}/"

log "Installing dependencies on remote"
ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && npm install"

log "Restarting remote app with nohup"
REMOTE_PID="$(ssh "${REMOTE_HOST}" "cd ${REMOTE_APP_DIR} && PIDS=\$(pgrep -f '^${REMOTE_NODE_BIN}[[:space:]]+server\\.js$' || true) && if [ -n \"\$PIDS\" ]; then kill \$PIDS >/dev/null 2>&1 || true; fi; nohup ${REMOTE_NODE_BIN} server.js > server.log 2>&1 < /dev/null & echo \$!" | tr -d '\r' | tail -n 1)"

if [[ -z "${REMOTE_PID}" ]]; then
  printf 'Failed to start remote process (empty pid).\n' >&2
  exit 1
fi

log "Remote app pid: ${REMOTE_PID}"

log "Checking remote local health endpoint"
LOCAL_STATUS="$(ssh "${REMOTE_HOST}" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${REMOTE_PORT}" | tr -d '\r')"
if [[ "${LOCAL_STATUS}" != "200" ]]; then
  printf 'Remote local health check failed: %s\n' "${LOCAL_STATUS}" >&2
  exit 1
fi

log "Checking public URL health endpoint"
PUBLIC_STATUS="$(ssh "${REMOTE_HOST}" "curl -s -o /dev/null -w '%{http_code}' ${PUBLIC_URL}" | tr -d '\r')"
if [[ "${PUBLIC_STATUS}" != "200" ]]; then
  printf 'Public health check failed: %s\n' "${PUBLIC_STATUS}" >&2
  exit 1
fi

log "Deploy completed successfully"
log "Remote local status: ${LOCAL_STATUS}"
log "Public status: ${PUBLIC_STATUS}"
