"""Embedding generation via the configured LLM provider.

Supports:
  - Ollama  : POST /api/embeddings  (model: nomic-embed-text)
  - OpenAI  : POST /embeddings       (model: text-embedding-3-small)
  - OpenRouter: delegates to OpenAI SDK with their base URL

Usage:
    embedder = get_embedder()
    vectors = await embedder.embed(["chunk 1", "chunk 2"])
"""
from __future__ import annotations

from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("rag.embedder")

Vector = list[float]


class Embedder(Protocol):
    async def embed(self, texts: list[str]) -> list[Vector]:
        ...


# ---------------------------------------------------------------------------
# Ollama embedder
# ---------------------------------------------------------------------------

class OllamaEmbedder:
    """Uses Ollama's /api/embed endpoint (batch).

    Ollama ≥ 0.1.26 supports the batched endpoint:
      POST /api/embed  { "model": "...", "input": ["text1", ...] }
    Older versions only support single-text /api/embeddings.
    """

    def __init__(self, base_url: str, model: str) -> None:
        self._base = base_url.rstrip("/")
        self._model = model

    async def embed(self, texts: list[str]) -> list[Vector]:
        if not texts:
            return []
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self._base}/api/embed",
                    json={"model": self._model, "input": texts},
                )
                resp.raise_for_status()
                data = resp.json()
                return data["embeddings"]
        except Exception:
            # Fallback: one-by-one via /api/embeddings (older Ollama)
            return await self._embed_one_by_one(texts)

    async def _embed_one_by_one(self, texts: list[str]) -> list[Vector]:
        results: list[Vector] = []
        async with httpx.AsyncClient(timeout=60.0) as client:
            for text in texts:
                resp = await client.post(
                    f"{self._base}/api/embeddings",
                    json={"model": self._model, "prompt": text},
                )
                resp.raise_for_status()
                results.append(resp.json()["embedding"])
        return results


# ---------------------------------------------------------------------------
# OpenAI-compatible embedder  (OpenAI + OpenRouter)
# ---------------------------------------------------------------------------

class OpenAIEmbedder:
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def embed(self, texts: list[str]) -> list[Vector]:
        if not texts:
            return []
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {"model": self._model, "input": texts}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self._base_url}/embeddings",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            # Sort by index to preserve order
            items = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in items]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    provider = settings.embedding_provider
    model = settings.embedding_model

    if provider == "ollama":
        logger.info("embedder_init", provider="ollama", model=model)
        return OllamaEmbedder(settings.ollama_base_url, model)

    if provider == "openrouter":
        logger.info("embedder_init", provider="openrouter", model=model)
        return OpenAIEmbedder(
            settings.openrouter_api_key,
            settings.openrouter_base_url,
            model,
        )

    # Default: OpenAI
    logger.info("embedder_init", provider="openai", model=model)
    return OpenAIEmbedder(
        settings.openai_api_key,
        settings.openai_base_url,
        model,
    )
