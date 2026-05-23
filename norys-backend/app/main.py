"""Norys Core — FastAPI application factory and entrypoint.

Run locally with:
    uvicorn app.main:app --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.redis import redis_client

configure_logging()
logger = get_logger("norys")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("norys_starting", env=settings.env, debug=settings.debug)
    try:
        await redis_client.ping()
        logger.info("redis_connected")
    except Exception as exc:  # noqa: BLE001 - non-fatal at boot
        logger.warning("redis_unavailable", error=str(exc))
    yield
    await redis_client.aclose()
    logger.info("norys_stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.project_name} Core API",
        version="0.1.0",
        description="Sovereign self-hosted enterprise AI platform — orchestration core.",
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request-context (request id + IP binding) middleware.
    from app.middleware.context import RequestContextMiddleware

    app.add_middleware(RequestContextMiddleware)

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", tags=["system"])
    async def root() -> dict:
        return {
            "service": settings.project_name,
            "version": "0.1.0",
            "docs": "/docs",
        }

    return app


app = create_app()
