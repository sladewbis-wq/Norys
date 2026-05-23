"""Common types and the abstract interface every LLM provider implements.

A provider only needs to know how to take a normalized list of messages and
return (or stream) a completion. The router decides which provider/model to
use for a given agent or request.
"""
from __future__ import annotations

import abc
from collections.abc import AsyncIterator
from dataclasses import dataclass, field


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: str

    def as_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass
class LLMResponse:
    content: str
    model: str
    provider: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    raw: dict = field(default_factory=dict)


class LLMProvider(abc.ABC):
    """Abstract base for chat-completion providers."""

    name: str

    @abc.abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """Return a single completion."""

    @abc.abstractmethod
    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Yield completion text chunks as they arrive."""

    async def health(self) -> bool:
        """Best-effort availability check. Providers may override."""
        return True
