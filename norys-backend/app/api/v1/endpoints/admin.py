"""Admin endpoints: tenant user management and audit log access.

All operations are tenant-scoped and gated by RBAC permissions.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permissions
from app.core.security import hash_password
from app.models.audit_log import AuditLog
from app.models.role import Permission
from app.models.user import User
from app.schemas.admin import AuditLogOut, UserCreate, UserUpdate
from app.schemas.auth import UserOut
from app.services import audit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.USER_READ))],
) -> list[User]:
    result = await db.scalars(
        select(User).where(User.tenant_id == current_user.tenant_id).order_by(User.email)
    )
    return list(result)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.USER_CREATE))],
) -> User:
    existing = await db.scalar(
        select(User).where(
            User.tenant_id == current_user.tenant_id,
            User.email == payload.email.lower(),
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "User already exists")

    user = User(
        tenant_id=current_user.tenant_id,
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await audit.record_event(
        db, tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="user.create", resource_type="user", resource_id=str(user.id),
        ip_address=getattr(request.state, "client_ip", None),
        detail={"email": user.email, "role": user.role.value},
    )
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.USER_UPDATE))],
) -> User:
    user = await db.scalar(
        select(User).where(
            User.id == user_id, User.tenant_id == current_user.tenant_id
        )
    )
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    await audit.record_event(
        db, tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="user.update", resource_type="user", resource_id=str(user.id),
        ip_address=getattr(request.state, "client_ip", None),
        detail=payload.model_dump(exclude_unset=True),
    )
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.USER_DELETE))],
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")
    user = await db.scalar(
        select(User).where(
            User.id == user_id, User.tenant_id == current_user.tenant_id
        )
    )
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    await db.delete(user)
    await audit.record_event(
        db, tenant_id=current_user.tenant_id, user_id=current_user.id,
        action="user.delete", resource_type="user", resource_id=str(user_id),
        ip_address=getattr(request.state, "client_ip", None),
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.AUDIT_READ))],
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    result = await db.scalars(
        select(AuditLog)
        .where(AuditLog.tenant_id == current_user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 500))
        .offset(offset)
    )
    return list(result)
