"""Agent CRUD schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ORMModel


class AgentBase(BaseModel):
    # ``model`` collides with Pydantic's protected ``model_`` namespace.
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    category: str = Field(default="general", max_length=64)
    system_prompt: str = ""
    provider: str | None = None
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)
    use_rag: bool = False
    requires_human_approval: bool = False


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)
    category: str | None = Field(default=None, max_length=64)
    system_prompt: str | None = None
    provider: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)
    use_rag: bool | None = None
    requires_human_approval: bool | None = None
    is_active: bool | None = None


class AgentOut(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    category: str
    system_prompt: str
    provider: str | None
    model: str | None
    temperature: float
    max_tokens: int | None
    use_rag: bool
    requires_human_approval: bool
    is_active: bool
