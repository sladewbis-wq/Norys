"""LLM router — resolves and caches providers, picks defaults.

Agents (or requests) may specify a provider + model; otherwise the tenant or
global default is used. The router lazily instantiates each configured provider
and exposes a uniform ``chat`` / ``stream_chat`` surface.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from fastapi import HTTPException, status

from app.core.config import settings
from app.services.llm.base import ChatMessage, LLMProvider, LLMResponse
from app.services.llm.openai_compatible import OpenAICompatibleProvider


class LLMRouter:
    def __init__(self) -> None:
        self._providers: dict[str, LLMProvider] = {}
        self._build_providers()

    def _build_providers(self) -> None:
        # OpenAI
        if settings.openai_api_key:
            self._providers["openai"] = OpenAICompatibleProvider(
                "openai", settings.openai_base_url, settings.openai_api_key
            )
        # OpenRouter (recommends identifying headers)
        if settings.openrouter_api_key:
            self._providers["openrouter"] = OpenAICompatibleProvider(
                "openrouter",
                settings.openrouter_base_url,
                settings.openrouter_api_key,
                extra_headers={"X-Title": settings.project_name},
            )
        # Ollama is always available locally; use its OpenAI-compatible endpoint.
        self._providers["ollama"] = OpenAICompatibleProvider(
            "ollama", f"{settings.ollama_base_url.rstrip('/')}/v1", api_key="ollama"
        )

    @property
    def available_providers(self) -> list[str]:
        return sorted(self._providers.keys())

    def get_provider(self, name: str | None = None) -> LLMProvider:
        provider_name = name or settings.default_llm_provider
        provider = self._providers.get(provider_name)
        if provider is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"LLM provider '{provider_name}' is not configured. "
                    f"Available: {', '.join(self.available_providers) or 'none'}"
                ),
            )
        return provider

    def resolve(
        self, provider: str | None, model: str | None
    ) -> tuple[LLMProvider, str]:
        prov = self.get_provider(provider)
        return prov, (model or settings.default_llm_model)

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        provider: str | None = None,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        prov, resolved_model = self.resolve(provider, model)
        return await prov.chat(
            messages, model=resolved_model,
            temperature=temperature, max_tokens=max_tokens,
        )

    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        provider: str | None = None,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        prov, resolved_model = self.resolve(provider, model)
        return prov.stream_chat(
            messages, model=resolved_model,
            temperature=temperature, max_tokens=max_tokens,
        )


@lru_cache
def get_llm_router() -> LLMRouter:
    return LLMRouter()
