#!/usr/bin/env bash
# =============================================================================
# Norys — vm-setup.sh
# First-time setup on the VM.  Run once, then use deploy.sh for updates.
#
# Usage (run directly on the VM, or pipe via SSH):
#   bash vm-setup.sh [GIT_REPO_URL] [--dir /opt/norys] [--model llama3.1]
#
# Example:
#   bash vm-setup.sh https://github.com/you/norys.git
#   bash vm-setup.sh git@github.com:you/norys.git --dir /opt/norys
#
# What this script does:
#   1. Checks Docker + Docker Compose V2 are available
#   2. Clones the repo (or reuses an existing clone)
#   3. Creates norys-infra/.env from .env.example and generates a secret key
#   4. Creates the /data/norys directory tree
#   5. Pulls the Ollama embedding model (nomic-embed-text)
#   6. Builds and starts the full stack
#   7. Runs database migrations
#   8. Prints the access URL
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BLUE}[setup]${NC} $*"; }
ok()   { echo -e "${GREEN}[setup]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[setup]${NC} ⚠ $*"; }
die()  { echo -e "${RED}[setup]${NC} ✗ $*" >&2; exit 1; }
ask()  { echo -e "${BOLD}$*${NC}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
GIT_REPO="${1:-}"
INSTALL_DIR="/opt/norys"
OLLAMA_MODEL="llama3.1"
EMBED_MODEL="nomic-embed-text"

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)   INSTALL_DIR="$2"; shift 2 ;;
    --model) OLLAMA_MODEL="$2"; shift 2 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Norys — First-time VM Setup        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Prerequisite checks ────────────────────────────────────────────────────
log "Checking prerequisites…"

command -v docker >/dev/null 2>&1      || die "Docker not found. Install Docker Engine first."
command -v git    >/dev/null 2>&1      || die "git not found. Run: sudo apt install git"

# Docker Compose V2 (docker compose, not docker-compose)
docker compose version >/dev/null 2>&1 || die "Docker Compose V2 not found. Update Docker or install the plugin."

ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
ok "Docker Compose $(docker compose version --short)"

# ── 2. Clone or reuse repo ────────────────────────────────────────────────────
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  warn "Repo already exists at ${INSTALL_DIR}. Skipping clone."
  cd "${INSTALL_DIR}"
  git pull origin "$(git rev-parse --abbrev-ref HEAD)" || true
else
  [[ -z "$GIT_REPO" ]] && die "No git repo URL provided.\nUsage: bash vm-setup.sh <GIT_REPO_URL>"
  log "Cloning ${GIT_REPO} → ${INSTALL_DIR}…"
  sudo mkdir -p "$(dirname "${INSTALL_DIR}")"
  sudo git clone "${GIT_REPO}" "${INSTALL_DIR}"
  sudo chown -R "${USER}:${USER}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
  ok "Cloned"
fi

# ── 3. Create .env ────────────────────────────────────────────────────────────
cd "${INSTALL_DIR}/norys-infra"

if [[ -f .env ]]; then
  warn ".env already exists — skipping creation. Edit it manually if needed."
else
  log "Creating .env from .env.example…"
  cp .env.example .env

  # Generate a cryptographically random secret key
  SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || \
           openssl rand -base64 48 | tr -d '/+=' | head -c 64)
  sed -i "s|^NORYS_SECRET_KEY=.*|NORYS_SECRET_KEY=${SECRET}|" .env
  ok "Generated NORYS_SECRET_KEY"

  echo ""
  warn "ACTION REQUIRED — open ${INSTALL_DIR}/norys-infra/.env and set:"
  echo "   NORYS_POSTGRES_PASSWORD=<strong-password>"
  echo "   NORYS_DOMAIN=<your-domain-or-ip>   (for TLS)"
  echo "   NORYS_TLS_EMAIL=<your-email>        (for Let's Encrypt)"
  echo ""
  ask "Press ENTER after editing .env to continue, or Ctrl+C to stop and edit first."
  read -r _

  # Validate required fields
  # shellcheck disable=SC1091
  source .env
  [[ -z "${NORYS_POSTGRES_PASSWORD:-}" ]] && die "NORYS_POSTGRES_PASSWORD is empty in .env"
  [[ -z "${NORYS_SECRET_KEY:-}" ]]        && die "NORYS_SECRET_KEY is empty in .env"
  ok ".env validated"
fi

# ── 4. Create data directories ────────────────────────────────────────────────
log "Creating data directories…"
sudo mkdir -p /data/norys/documents
sudo chown -R "${USER}:${USER}" /data/norys
ok "/data/norys ready"

# ── 5. Build and start the stack ─────────────────────────────────────────────
log "Building Docker images (first build takes a few minutes)…"
docker compose build --parallel
ok "Images built"

log "Starting services…"
docker compose up -d
ok "Stack started"

# ── 6. Database migrations ────────────────────────────────────────────────────
log "Waiting for PostgreSQL to be ready…"
for i in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U norys >/dev/null 2>&1 && break
  sleep 2
done

log "Running database migrations…"
docker compose run --rm migrate
ok "Migrations done"

# ── 7. Pull Ollama models ─────────────────────────────────────────────────────
log "Pulling Ollama LLM model: ${OLLAMA_MODEL}…"
docker compose exec ollama ollama pull "${OLLAMA_MODEL}" || \
  warn "Could not pull ${OLLAMA_MODEL} — pull it manually: docker compose exec ollama ollama pull ${OLLAMA_MODEL}"

log "Pulling Ollama embedding model: ${EMBED_MODEL}…"
docker compose exec ollama ollama pull "${EMBED_MODEL}" || \
  warn "Could not pull ${EMBED_MODEL} — pull manually: docker compose exec ollama ollama pull ${EMBED_MODEL}"

ok "Ollama models ready"

# ── 8. Final status ───────────────────────────────────────────────────────────
echo ""
docker compose ps
echo ""

VM_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           Norys is running! 🚀            ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Web UI  → ${BOLD}http://${VM_IP}${NC}"
echo -e "  API     → ${BOLD}http://${VM_IP}/api/v1/docs${NC}"
echo ""
echo -e "  Logs    : ${BOLD}cd ${INSTALL_DIR}/norys-infra && docker compose logs -f${NC}"
echo -e "  Updates : ${BOLD}./deploy.sh user@${VM_IP}${NC}  (from your local machine)"
echo ""
ok "Setup complete."
