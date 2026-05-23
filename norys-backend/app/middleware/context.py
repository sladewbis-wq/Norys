"""Request context middleware.

Attaches a per-request id and binds it (plus client IP) into structlog's
contextvars so every log line for a request is correlated. The resolved tenant
and user ids are bound later by the auth dependency chain when available.
"""
from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        client_ip = request.client.host if request.client else None

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            client_ip=client_ip,
            path=request.url.path,
            method=request.method,
        )
        # Make the IP available to handlers (e.g. audit logging).
        request.state.client_ip = client_ip
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
