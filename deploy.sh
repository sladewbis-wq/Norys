#!/usr/bin/env bash
# =============================================================================
# Norys — deploy.sh
# Push the latest code to the VM and restart the stack.
#
# Usage:
#   ./deploy.sh [user@host] [--branch main] [--no-build] [--model llama3.1]
#
# Examples:
#   ./deploy.sh deploy@192.168.1.10
#   ./deploy.sh admin@norys.example.com --branch main
#   ./deploy.sh deploy@10.0.0.5 --model mistral
#
# Prerequisites (local machine):
#   - SSH key already added to authorized_keys on the VM
#   - git remote "origin" pointing to your repo
#
# Prerequisites (VM):
#   - Docker + Docker Compose V2 installed
#   - Run vm-setup.sh once before the first deploy
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[deploy]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} ⚠ $*"; }
die()  { echo -e "${RED}[deploy]${NC} ✗ $*" >&2; exit 1; }

# ── Argument parsing ─────────────────────────────────────────────────────────
SSH_TARGET="${1:-}"
BRANCH="main"
NO_BUILD=false
OLLAMA_MODEL="llama3.1"
REMOTE_DIR="/opt/norys"

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)   BRANCH="$2";       shift 2 ;;
    --no-build) NO_BUILD=true;     shift   ;;
    --model)    OLLAMA_MODEL="$2"; shift 2 ;;
    --dir)      REMOTE_DIR="$2";   shift 2 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

[[ -z "$SSH_TARGET" ]] && die "Usage: ./deploy.sh user@host [options]"

# ── Sanity checks ─────────────────────────────────────────────────────────────
log "Target  : ${BOLD}${SSH_TARGET}${NC}"
log "Branch  : ${BOLD}${BRANCH}${NC}"
log "Remote  : ${BOLD}${REMOTE_DIR}${NC}"
echo ""

# Ensure we're in the project root
[[ -f "norys-infra/docker-compose.yml" ]] || \
  die "Run this script from the project root (where norys-infra/ lives)"

# Confirm local branch is up to date
LOCAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Local branch: ${LOCAL_BRANCH}"

if [[ "$LOCAL_BRANCH" != "$BRANCH" ]]; then
  warn "You are on '${LOCAL_BRANCH}', deploying branch '${BRANCH}'. Continuing in 5s…"
  sleep 5
fi

# Push latest commits
log "Pushing to origin/${BRANCH}…"
git push origin "${LOCAL_BRANCH}:${BRANCH}" || die "git push failed"
ok "Pushed"

# ── SSH command block ─────────────────────────────────────────────────────────
log "Connecting to ${SSH_TARGET}…"

ssh -T "$SSH_TARGET" bash <<REMOTE_SCRIPT
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "\${BLUE}[vm]  \${NC} \$*"; }
ok()   { echo -e "\${GREEN}[vm]  \${NC} ✓ \$*"; }
die()  { echo -e "\${RED}[vm]  \${NC} ✗ \$*" >&2; exit 1; }

REMOTE_DIR="${REMOTE_DIR}"
BRANCH="${BRANCH}"
NO_BUILD="${NO_BUILD}"
OLLAMA_MODEL="${OLLAMA_MODEL}"

# ── Pull latest code ──────────────────────────────────────────────────────────
if [[ ! -d "\${REMOTE_DIR}/.git" ]]; then
  die "Repo not found at \${REMOTE_DIR}. Run vm-setup.sh first."
fi

cd "\${REMOTE_DIR}"
log "Pulling \${BRANCH}…"
git fetch --all
git checkout "\${BRANCH}"
git pull origin "\${BRANCH}"
ok "Code updated (branch: \${BRANCH})"

# ── Ensure .env exists ────────────────────────────────────────────────────────
cd "\${REMOTE_DIR}/norys-infra"
if [[ ! -f .env ]]; then
  die ".env not found in \${REMOTE_DIR}/norys-infra. Run vm-setup.sh first."
fi

# ── Docker build + deploy ─────────────────────────────────────────────────────
if [[ "\${NO_BUILD}" == "true" ]]; then
  log "Restarting services (no rebuild)…"
  docker compose up -d
else
  log "Building images (this may take a few minutes)…"
  docker compose build --parallel
  log "Starting services…"
  docker compose up -d
fi

# ── Database migrations ───────────────────────────────────────────────────────
log "Running migrations…"
docker compose run --rm migrate 2>&1 | tail -20 || log "Migrations already up to date"
ok "Migrations done"

# ── Health check ──────────────────────────────────────────────────────────────
log "Waiting for API to be healthy…"
for i in \$(seq 1 24); do
  if docker compose exec -T api curl -fs http://localhost:8000/api/v1/health >/dev/null 2>&1; then
    ok "API is healthy"
    break
  fi
  [[ \$i -eq 24 ]] && { log "API not responding after 120s — check logs: docker compose logs api"; break; }
  sleep 5
done

# ── Print status ──────────────────────────────────────────────────────────────
echo ""
docker compose ps
echo ""
ok "Deploy complete!"
log "Stack running at: http://\$(hostname -I | awk '{print \$1}')"
REMOTE_SCRIPT

echo ""
ok "Deploy finished successfully."
