"""Application configuration loaded from environment variables.

All settings are prefixed with ``NORYS_`` and can be provided via a ``.env``
file (see ``.env.example``). This is the single source of truth for runtime
configuration across the whole backend.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="NORYS_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    project_name: str = "Norys"
    api_prefix: str = "/api/v1"

    # --- Security ---
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    cors_origins: str = "http://localhost:3000"

    # --- PostgreSQL ---
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "norys"
    postgres_password: str = "norys"
    postgres_db: str = "norys"

    # --- Redis ---
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""

    # --- LLM providers ---
    default_llm_provider: Literal["openai", "openrouter", "ollama"] = "ollama"
    default_llm_model: str = "llama3.1"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    ollama_base_url: str = "http://localhost:11434"

    # --- RAG / Qdrant ---
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    # Model used for generating embeddings. With Ollama: "nomic-embed-text".
    # With OpenAI: "text-embedding-3-small".
    embedding_model: str = "nomic-embed-text"
    # Provider for embeddings: "ollama", "openai", or "openrouter"
    embedding_provider: Literal["openai", "openrouter", "ollama"] = "ollama"
    # Dimension of the embedding vectors produced by the chosen model.
    # nomic-embed-text → 768, text-embedding-3-small → 1536
    embedding_dim: int = 768
    # Document chunking parameters
    chunk_size: int = 800       # target characters per chunk
    chunk_overlap: int = 100    # character overlap between consecutive chunks

    # --- Derived values ---
    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read once per process)."""
    return Settings()


settings = get_settings()
