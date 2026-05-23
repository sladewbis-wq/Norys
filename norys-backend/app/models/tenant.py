"""Tenant (organization) model — the unit of isolation in Norys."""
from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional per-tenant LLM overrides (fall back to global settings if null).
    default_llm_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    default_llm_model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    users: Mapped[list["User"]] = relationship(  # noqa: F821
        back_populates="tenant", cascade="all, delete-orphan"
    )
    agents: Mapped[list["Agent"]] = relationship(  # noqa: F821
        back_populates="tenant", cascade="all, delete-orphan"
    )
