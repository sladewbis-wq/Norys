"""Tenant provisioning: create a tenant, its owner user, and seed agents."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.agent import Agent
from app.models.role import RoleName
from app.models.tenant import Tenant
from app.models.user import User
from app.services.agents.engine import AGENT_PRESETS


async def provision_tenant(
    db: AsyncSession,
    *,
    tenant_name: str,
    tenant_slug: str,
    owner_email: str,
    owner_password: str,
    owner_full_name: str | None = None,
) -> tuple[Tenant, User]:
    """Create a new tenant with an owner and the default agent library.

    Raises ValueError if the slug or owner email is already taken.
    """
    existing = await db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
    if existing is not None:
        raise ValueError("tenant slug already exists")

    tenant = Tenant(name=tenant_name, slug=tenant_slug)
    db.add(tenant)
    await db.flush()  # assign tenant.id

    owner = User(
        tenant_id=tenant.id,
        email=owner_email.lower(),
        full_name=owner_full_name,
        hashed_password=hash_password(owner_password),
        role=RoleName.OWNER,
    )
    db.add(owner)

    # Seed the ready-to-use agent library for this tenant.
    for preset in AGENT_PRESETS:
        db.add(Agent(tenant_id=tenant.id, **preset))

    await db.flush()
    return tenant, owner
