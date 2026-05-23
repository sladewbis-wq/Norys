"""Shared Pydantic base models."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for response schemas read from ORM objects."""

    # protected_namespaces=() silences Pydantic v2 warnings for fields named
    # ``model`` (used by agent schemas to denote the LLM model).
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class Message(BaseModel):
    """Generic message envelope for simple responses."""

    message: str
