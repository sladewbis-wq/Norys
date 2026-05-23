"""Audit logging service — writes immutable security event records."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.audit_log import AuditLog

logger = get_logger("audit")


async def record_event(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    action: str,
    user_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    detail: dict | None = None,
) -> AuditLog:
    """Persist an audit event. Always flushed within the caller's session so it
    commits atomically with the action it describes."""
    event = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        detail=detail or {},
    )
    db.add(event)
    await db.flush()
    logger.info(
        "audit_event",
        action=action,
        tenant_id=str(tenant_id),
        user_id=str(user_id) if user_id else None,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    return event
