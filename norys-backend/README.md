# Norys Core — Backend API

The orchestration core of **Norys**, the sovereign, self-hosted enterprise AI platform.
This service is layer 3 of the product architecture (**Norys Core**): it handles
multi-tenancy, authentication, RBAC, the agent system, LLM routing, conversations,
private documents (RAG-ready) and audit logging. The OpenUI frontend and the
OpenClaw conversational layer consume this API.

## Stack

FastAPI · PostgreSQL (async SQLAlchemy) · Redis · JWT auth · structlog ·
pluggable LLM providers (OpenAI / OpenRouter / Ollama).

## Key capabilities (MVP CORE)

- **Multi-tenant**: every row is scoped to a `tenant_id`; tokens carry the tenant
  claim and queries filter by it — isolation by design.
- **RBAC**: built-in roles (owner / admin / member / viewer) with a central
  permission catalogue (`app/models/role.py`) enforced via FastAPI dependencies.
- **Auth**: registration provisions a tenant + owner and seeds a ready-to-use
  agent library (IT helpdesk, HR, support, documents, general). JWT access +
  refresh tokens.
- **Agents**: CRUD over per-tenant agents; each agent has its own system prompt,
  LLM provider/model, temperature and RAG/approval flags.
- **Chat**: conversations + messages, synchronous or **SSE streaming** replies.
- **LLM routing**: one OpenAI-compatible client drives OpenAI, OpenRouter and
  local Ollama; agents pick a provider/model or fall back to tenant/global defaults.
- **Documents**: upload + metadata, with a clearly marked extension point for
  Qdrant vector indexing (private RAG).
- **Audit logs**: immutable security events (auth, user/agent/document changes)
  queryable by admins.

## Project layout

```
app/
  core/        config, database, redis, security (JWT/hash), logging, deps (RBAC)
  models/      SQLAlchemy models (tenant, user, role, agent, conversation, message, document, audit_log)
  schemas/     Pydantic request/response models
  services/    audit, tenant_bootstrap, llm/ (router + providers), agents/ (engine + presets)
  middleware/  request-context (request id + client IP)
  api/v1/      endpoints: auth, agents, chat, documents, admin, system
  main.py      app factory
alembic/       async migrations
```

## Run locally (Docker — recommended)

```bash
cp .env.example .env          # then set NORYS_SECRET_KEY
docker compose up --build
```

Apply migrations once the stack is up:

```bash
docker compose exec api alembic revision --autogenerate -m "initial schema"
docker compose exec api alembic upgrade head
```

API docs: http://localhost:8000/docs

## Run locally (bare metal)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # configure Postgres / Redis / providers
alembic revision --autogenerate -m "initial schema" && alembic upgrade head
uvicorn app.main:app --reload
```

## First requests

```bash
# 1. Create a tenant + owner
curl -X POST localhost:8000/api/v1/auth/register -H 'Content-Type: application/json' -d '{
  "tenant_name": "Acme", "tenant_slug": "acme",
  "email": "admin@acme.com", "password": "supersecret", "full_name": "Admin"
}'

# 2. Use the returned access_token
TOKEN=...
curl localhost:8000/api/v1/agents -H "Authorization: Bearer $TOKEN"

# 3. Create a conversation and chat with the IT helpdesk agent
curl -X POST localhost:8000/api/v1/chat/conversations -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"Test"}'
```

## Configuration

All settings are environment variables prefixed `NORYS_` — see `.env.example`.
Pick the default LLM provider with `NORYS_DEFAULT_LLM_PROVIDER` (`ollama` keeps
everything on-premise; `openai`/`openrouter` require their API keys).

## Extension points (next iterations)

- **RAG**: wire `documents` upload to a chunk+embed worker → Qdrant; inject
  retrieved context in `AgentEngine._build_context` (already plumbed via `use_rag`).
- **MCP / tools**: add tool execution inside the agent engine, gated by
  `requires_human_approval` for sensitive actions.
- **Rate limiting / sessions**: Redis client is already available via `get_redis`.
- **Kubernetes**: the image is stateless and ships a `/api/v1/health` probe.
