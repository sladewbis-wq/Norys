"""Admin schemas: user management and audit logs."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.role import RoleName
from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: RoleName = RoleName.MEMBER


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: RoleName | None = None
    is_active: bool | None = None


class AuditLogOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    detail: dict
    created_at: datetime
