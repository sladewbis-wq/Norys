"""Shared FastAPI dependencies: current user resolution and RBAC guards.

The authentication flow:
  1. ``get_current_user`` decodes the JWT, loads the user, and verifies the
     token's tenant claim matches the user's tenant (defense in depth).
  2. ``require_permissions`` builds a dependency that checks the user's role
     grants the requested permissions.

Tenant isolation is doubly enforced: the token carries the tenant id, and
every tenant-scoped query filters by ``current_user.tenant_id``.
"""
from __future__ import annotations

import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import JWTError, decode_token
from app.models.role import ROLE_PERMISSIONS, Permission, RoleName
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise CREDENTIALS_EXC
        user_id = payload.get("sub")
        tenant_id = payload.get("tid")
        if user_id is None or tenant_id is None:
            raise CREDENTIALS_EXC
    except JWTError as exc:
        raise CREDENTIALS_EXC from exc

    user = await db.scalar(select(User).where(User.id == uuid.UUID(user_id)))
    if user is None or not user.is_active:
        raise CREDENTIALS_EXC
    # Token's tenant claim must match the stored tenant — blocks token reuse
    # across tenants even if a key were leaked.
    if str(user.tenant_id) != str(tenant_id):
        raise CREDENTIALS_EXC
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def user_permissions(user: User) -> set[Permission]:
    return ROLE_PERMISSIONS.get(RoleName(user.role), set())


def require_permissions(
    *required: Permission,
) -> Callable[..., Coroutine[Any, Any, User]]:
    """Return a dependency that allows the request only if the current user's
    role grants every one of the required permissions."""

    async def _guard(current_user: CurrentUser) -> User:
        granted = user_permissions(current_user)
        missing = set(required) - granted
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission(s): {', '.join(p.value for p in missing)}",
            )
        return current_user

    return _guard


def require_role(*allowed: RoleName) -> Callable[..., Coroutine[Any, Any, User]]:
    async def _guard(current_user: CurrentUser) -> User:
        if RoleName(current_user.role) not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return current_user

    return _guard
