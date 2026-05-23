"""Redis client used for caching, sessions, and rate limiting."""
from __future__ import annotations

import redis.asyncio as redis

from app.core.config import settings

redis_client: redis.Redis = redis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis() -> redis.Redis:
    """FastAPI dependency returning the shared Redis client."""
    return redis_client
