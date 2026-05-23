"""Agent model — a configured, reusable AI assistant within a tenant.

Agents back both the generic chat assistants and the specialized business
agents (IT helpdesk, HR, support...) described in the product vision.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Agent(UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "agents"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Free-form category, e.g. "helpdesk", "hr", "support", "general".
    category: Mapped[str] = mapped_column(String(64), default="general", nullable=False)

    system_prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # LLM configuration (overrides tenant/global defaults when set).
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    temperature: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    max_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Whether this agent may use the tenant's private document RAG context.
    use_rag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Sensitive actions require human validation before execution.
    requires_human_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    tenant: Mapped["Tenant"] = relationship(back_populates="agents")  # noqa: F821
