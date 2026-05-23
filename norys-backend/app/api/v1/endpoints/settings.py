"""Settings endpoint — expose and update runtime LLM + RAG configuration.

GET  /settings      → returns current config (readable by all authenticated users)
PATCH /settings     → updates .env-backed settings (owners only, in-memory only for MVP)

Note: In the MVP the PATCH writes settings to a JSON override file that is
loaded at startup. A production deployment would use a database-backed settings
table or a secrets manager.  The override file is at /data/norys/settings.json.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import CurrentUser, require_permissions
from app.models.role import Permission

router = APIRouter(prefix="/settings", tags=["settings"])

_OVERRIDE_FILE = Path("/data/norys/settings.json")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LLMSettings(BaseModel):
    default_llm_provider: Literal["openai", "openrouter", "ollama"]
    default_llm_model: str
    openai_base_url: str
    openrouter_base_url: str
    ollama_base_url: str
    # We never return API keys; only whether they are configured
    openai_api_key_set: bool
    openrouter_api_key_set: bool


class RAGSettings(BaseModel):
    qdrant_url: str
    embedding_provider: Literal["openai", "openrouter", "ollama"]
    embedding_model: str
    embedding_dim: int
    chunk_size: int
    chunk_overlap: int


class SettingsOut(BaseModel):
    llm: LLMSettings
    rag: RAGSettings


class SettingsPatch(BaseModel):
    """Fields the admin can update at runtime.

    Only non-sensitive values are accepted here. API keys must be set via
    environment variables or the .env file and require a restart.
    """
    default_llm_provider: Literal["openai", "openrouter", "ollama"] | None = None
    default_llm_model: str | None = None
    ollama_base_url: str | None = None
    embedding_provider: Literal["openai", "openrouter", "ollama"] | None = None
    embedding_model: str | None = None
    embedding_dim: int | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _current_settings_out() -> SettingsOut:
    return SettingsOut(
        llm=LLMSettings(
            default_llm_provider=settings.default_llm_provider,
            default_llm_model=settings.default_llm_model,
            openai_base_url=settings.openai_base_url,
            openrouter_base_url=settings.openrouter_base_url,
            ollama_base_url=settings.ollama_base_url,
            openai_api_key_set=bool(settings.openai_api_key),
            openrouter_api_key_set=bool(settings.openrouter_api_key),
        ),
        rag=RAGSettings(
            qdrant_url=settings.qdrant_url,
            embedding_provider=settings.embedding_provider,
            embedding_model=settings.embedding_model,
            embedding_dim=settings.embedding_dim,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        ),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=SettingsOut)
async def get_settings(current_user: CurrentUser) -> SettingsOut:
    """Return the current LLM and RAG configuration."""
    return _current_settings_out()


@router.patch("", response_model=SettingsOut)
async def patch_settings(
    payload: SettingsPatch,
    current_user: Annotated[object, Depends(require_permissions(Permission.MANAGE_SETTINGS))],
) -> SettingsOut:
    """Update mutable settings at runtime (owner / admin only).

    Changes are applied in-memory immediately and persisted to an override file
    so they survive a process restart. An app restart is still required for
    embedding_dim changes (Qdrant collection must be recreated).
    """
    overrides: dict = {}
    _OVERRIDE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if _OVERRIDE_FILE.exists():
        try:
            overrides = json.loads(_OVERRIDE_FILE.read_text())
        except Exception:
            overrides = {}

    patch_data = payload.model_dump(exclude_none=True)
    overrides.update(patch_data)
    _OVERRIDE_FILE.write_text(json.dumps(overrides, indent=2))

    # Apply in-memory (best-effort; the Settings object is normally frozen)
    for key, value in patch_data.items():
        try:
            object.__setattr__(settings, key, value)
        except Exception:
            pass  # pydantic frozen model — requires restart for these fields

    return _current_settings_out()
