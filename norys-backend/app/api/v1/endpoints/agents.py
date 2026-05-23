"""Agent CRUD endpoints. Every query is scoped to the caller's tenant."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_permissions
from app.models.agent import Agent
from app.models.role import Permission
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


async def _get_owned_agent(db: AsyncSession, agent_id: uuid.UUID, tenant_id: uuid.UUID) -> Agent:
    agent = await db.scalar(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == tenant_id)
    )
    if agent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
    return agent


@router.get("", response_model=list[AgentOut])
async def list_agents(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Agent]:
    result = await db.scalars(
        select(Agent).where(Agent.tenant_id == current_user.tenant_id).order_by(Agent.name)
    )
    return list(result)


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def create_agent(
    payload: AgentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.AGENT_CREATE))],
) -> Agent:
    agent = Agent(tenant_id=current_user.tenant_id, **payload.model_dump())
    db.add(agent)
    await db.flush()
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Agent:
    return await _get_owned_agent(db, agent_id, current_user.tenant_id)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.AGENT_UPDATE))],
) -> Agent:
    agent = await _get_owned_agent(db, agent_id, current_user.tenant_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.flush()
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_agent(
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.AGENT_DELETE))],
) -> None:
    agent = await _get_owned_agent(db, agent_id, current_user.tenant_id)
    await db.delete(agent)
