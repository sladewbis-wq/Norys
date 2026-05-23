"""Role model and the permission catalogue for RBAC."""
from __future__ import annotations

import enum

from sqlalchemy import ARRAY, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class RoleName(str, enum.Enum):
    """Built-in roles, ordered from most to least privileged."""

    OWNER = "owner"          # full control of the tenant, including billing
    ADMIN = "admin"          # manage users, agents, settings, view audit logs
    MEMBER = "member"        # use chat & agents, upload documents
    VIEWER = "viewer"        # read-only access


# Permission constants used by the RBAC dependency. Keeping them centralized
# means a single place to audit "who can do what".
class Permission(str, enum.Enum):
    # Tenant administration
    TENANT_MANAGE = "tenant:manage"
    # User management
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    # Agents
    AGENT_CREATE = "agent:create"
    AGENT_READ = "agent:read"
    AGENT_UPDATE = "agent:update"
    AGENT_DELETE = "agent:delete"
    # Chat / conversations
    CHAT_USE = "chat:use"
    # Documents / RAG
    DOCUMENT_UPLOAD = "document:upload"
    DOCUMENT_READ = "document:read"
    DOCUMENT_DELETE = "document:delete"
    # Audit
    AUDIT_READ = "audit:read"
    # Platform settings
    MANAGE_SETTINGS = "settings:manage"


# Default permission sets per built-in role.
ROLE_PERMISSIONS: dict[RoleName, set[Permission]] = {
    RoleName.OWNER: set(Permission),  # everything
    RoleName.ADMIN: set(Permission) - {Permission.TENANT_MANAGE},
    RoleName.MEMBER: {
        Permission.AGENT_READ,
        Permission.CHAT_USE,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_READ,
        Permission.USER_READ,
    },
    RoleName.VIEWER: {
        Permission.AGENT_READ,
        Permission.DOCUMENT_READ,
        Permission.USER_READ,
    },
}


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A role assignable to users. Seeded with the built-in roles per tenant,
    but extensible with custom permission arrays for enterprise needs."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Stored permission strings; defaults derived from ROLE_PERMISSIONS.
    permissions: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False
    )

    @staticmethod
    def default_permissions(role_name: RoleName) -> list[str]:
        return sorted(p.value for p in ROLE_PERMISSIONS.get(role_name, set()))
