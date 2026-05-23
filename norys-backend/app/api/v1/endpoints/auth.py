"""Authentication endpoints: register, login, refresh, me."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.security import (
    JWTError,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TenantRegister,
    Token,
    UserOut,
)
from app.services import audit
from app.services.tenant_bootstrap import provision_tenant

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens_for(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id), str(user.tenant_id), user.role.value),
        refresh_token=create_refresh_token(str(user.id), str(user.tenant_id), user.role.value),
    )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    payload: TenantRegister,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Self-service: create a new tenant and its owner account."""
    try:
        _tenant, owner = await provision_tenant(
            db,
            tenant_name=payload.tenant_name,
            tenant_slug=payload.tenant_slug,
            owner_email=payload.email,
            owner_password=payload.password,
            owner_full_name=payload.full_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    await audit.record_event(
        db, tenant_id=owner.tenant_id, user_id=owner.id,
        action="tenant.register", resource_type="tenant",
        resource_id=str(owner.tenant_id),
        ip_address=getattr(request.state, "client_ip", None),
    )
    return _tokens_for(owner)


@router.post("/login", response_model=Token)
async def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    tenant = await db.scalar(select(Tenant).where(Tenant.slug == payload.tenant_slug))
    user: User | None = None
    if tenant is not None:
        user = await db.scalar(
            select(User).where(
                User.tenant_id == tenant.id,
                User.email == payload.email.lower(),
            )
        )

    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.hashed_password)
    ):
        # Record failed attempts when we can attribute them to a tenant.
        if tenant is not None:
            await audit.record_event(
                db, tenant_id=tenant.id, action="auth.login_failed",
                ip_address=getattr(request.state, "client_ip", None),
                detail={"email": payload.email},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email, password or tenant",
        )

    await audit.record_event(
        db, tenant_id=user.tenant_id, user_id=user.id, action="auth.login",
        ip_address=getattr(request.state, "client_ip", None),
    )
    return _tokens_for(user)


@router.post("/refresh", response_model=Token)
async def refresh(
    payload: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    try:
        claims = decode_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
        user = await db.scalar(select(User).where(User.id == uuid.UUID(claims["sub"])))
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc

    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return _tokens_for(user)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> User:
    return current_user
