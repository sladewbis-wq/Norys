"""System endpoints: health checks and LLM provider discovery."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings
from app.core.deps import CurrentUser
from app.services.llm import get_llm_router

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    """Liveness probe (no auth) for load balancers / Kubernetes."""
    return {"status": "ok", "service": settings.project_name}


@router.get("/llm/providers")
async def llm_providers(_: CurrentUser) -> dict:
    """List configured LLM providers and current defaults."""
    router_ = get_llm_router()
    return {
        "available": router_.available_providers,
        "default_provider": settings.default_llm_provider,
        "default_model": settings.default_llm_model,
    }
