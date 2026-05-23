"""Authentication and registration schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.role import RoleName
from app.schemas.common import ORMModel


class TenantRegister(BaseModel):
    """Self-service signup: creates a tenant + its first owner user."""

    tenant_name: str = Field(min_length=2, max_length=255)
    tenant_slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    full_name: str | None
    role: RoleName
    is_active: bool
