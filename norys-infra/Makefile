# Norys stack — operator commands.
# Usage: make <target>

COMPOSE = docker compose
DEV     = -f docker-compose.yml -f docker-compose.dev.yml
DEFAULT_MODEL ?= llama3.1

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: init
init: ## Create .env from the example and generate a secret key
	@test -f .env || cp .env.example .env
	@python3 -c "import secrets,re,pathlib; p=pathlib.Path('.env'); s=p.read_text(); \
		s=re.sub(r'^NORYS_SECRET_KEY=.*$$', 'NORYS_SECRET_KEY='+secrets.token_urlsafe(48), s, flags=re.M); \
		p.write_text(s)" 2>/dev/null || true
	@echo "→ .env ready. Set NORYS_POSTGRES_PASSWORD before going to production."

.PHONY: up
up: ## Build and start the full stack (production mode)
	$(COMPOSE) up -d --build

.PHONY: dev
dev: ## Start the stack in dev mode (ports exposed, debug on)
	$(COMPOSE) $(DEV) up -d --build

.PHONY: down
down: ## Stop the stack
	$(COMPOSE) down

.PHONY: clean
clean: ## Stop the stack and DELETE all data volumes (destructive!)
	$(COMPOSE) down -v

.PHONY: logs
logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=100

.PHONY: ps
ps: ## Show running services
	$(COMPOSE) ps

.PHONY: migrate
migrate: ## Run database migrations
	$(COMPOSE) run --rm migrate

.PHONY: pull-model
pull-model: ## Pull the default Ollama model (override with DEFAULT_MODEL=...)
	$(COMPOSE) exec ollama ollama pull $(DEFAULT_MODEL)

.PHONY: shell-api
shell-api: ## Open a shell in the api container
	$(COMPOSE) exec api sh

.PHONY: config
config: ## Validate and render the merged compose configuration
	$(COMPOSE) config
