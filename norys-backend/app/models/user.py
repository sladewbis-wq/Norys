"""User model — belongs to exactly one tenant and carries a role."""
from __future__ import annotations

from sqlalchemy import Boolean, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.role import RoleName


class User(UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Simple role enum on the user keeps the MVP lean; the Role table allows
    # custom permission sets later without breaking this.
    role: Mapped[RoleName] = mapped_column(
        SAEnum(RoleName, name="role_name"),
        default=RoleName.MEMBER,
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(back_populates="users")  # noqa: F821

    __table_args__ = ()  # email uniqueness is enforced per-tenant in code/migration
