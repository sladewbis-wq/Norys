"""Chat endpoints: conversations + sending messages to agents.

Supports both a simple JSON request/response and Server-Sent Events streaming
so the OpenUI frontend can render tokens as they arrive.
"""
from __future__ import annotations

import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import CurrentUser, require_permissions
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.role import Permission
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationOut,
    MessageOut,
)
from app.services.agents import get_agent_engine
from app.services.rag import retrieve_context

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, tenant_id: uuid.UUID
) -> Conversation:
    convo = await db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
        )
    )
    if convo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return convo


async def _resolve_agent(
    db: AsyncSession, agent_id: uuid.UUID | None, tenant_id: uuid.UUID
) -> Agent:
    """Return the requested agent, or the tenant's default 'general' agent."""
    stmt = select(Agent).where(Agent.tenant_id == tenant_id, Agent.is_active.is_(True))
    if agent_id is not None:
        agent = await db.scalar(stmt.where(Agent.id == agent_id))
        if agent is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
        return agent
    agent = await db.scalar(stmt.where(Agent.category == "general"))
    if agent is None:
        agent = await db.scalar(stmt)  # any active agent
    if agent is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active agent available")
    return agent


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Conversation]:
    result = await db.scalars(
        select(Conversation)
        .where(
            Conversation.tenant_id == current_user.tenant_id,
            Conversation.user_id == current_user.id,
        )
        .order_by(Conversation.updated_at.desc())
    )
    return list(result)


@router.post(
    "/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED
)
async def create_conversation(
    payload: ConversationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.CHAT_USE))],
) -> Conversation:
    if payload.agent_id is not None:
        await _resolve_agent(db, payload.agent_id, current_user.tenant_id)
    convo = Conversation(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        agent_id=payload.agent_id,
        title=payload.title or "Nouvelle conversation",
    )
    db.add(convo)
    await db.flush()
    return convo


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Message]:
    convo = await _get_conversation(db, conversation_id, current_user.tenant_id)
    result = await db.scalars(
        select(Message)
        .where(Message.conversation_id == convo.id)
        .order_by(Message.created_at)
    )
    return list(result)


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    payload: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.CHAT_USE))],
):
    """Append a user message, run the agent, persist and return the reply."""
    convo = await _get_conversation(db, conversation_id, current_user.tenant_id)
    agent = await _resolve_agent(db, convo.agent_id, current_user.tenant_id)

    # Persist the user's message.
    user_msg = Message(
        tenant_id=current_user.tenant_id,
        conversation_id=convo.id,
        role=MessageRole.USER,
        content=payload.content,
    )
    db.add(user_msg)
    await db.flush()

    # Load full history (now includes the new user message).
    history = list(
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == convo.id)
            .order_by(Message.created_at)
        )
    )

    engine = get_agent_engine()

    # Retrieve RAG context for agents that use private documents
    rag_ctx: str | None = None
    if agent.use_rag and payload.content:
        try:
            rag_ctx = await retrieve_context(
                tenant_id=current_user.tenant_id,
                query=payload.content,
            ) or None
        except Exception:
            pass  # RAG failure must never block the conversation

    if payload.stream:
        return StreamingResponse(
            _stream_and_persist(
                engine, agent, history, convo.id, current_user.tenant_id,
                rag_context=rag_ctx,
            ),
            media_type="text/event-stream",
        )

    response = await engine.run(agent, history, rag_context=rag_ctx)
    assistant_msg = Message(
        tenant_id=current_user.tenant_id,
        conversation_id=convo.id,
        role=MessageRole.ASSISTANT,
        content=response.content,
        tokens=response.completion_tokens,
    )
    db.add(assistant_msg)
    await db.flush()
    return ChatResponse(
        conversation_id=convo.id,
        message=MessageOut.model_validate(assistant_msg),
    )


async def _stream_and_persist(
    engine, agent, history, conversation_id, tenant_id, *, rag_context: str | None = None
):
    """SSE generator. Uses its own DB session because the request-scoped session
    is committed once the endpoint returns the StreamingResponse."""
    chunks: list[str] = []
    async for delta in engine.stream(agent, history, rag_context=rag_context):
        chunks.append(delta)
        yield f"data: {json.dumps({'delta': delta})}\n\n"

    full = "".join(chunks)
    async with AsyncSessionLocal() as session:
        session.add(
            Message(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=full,
            )
        )
        await session.commit()
    yield f"data: {json.dumps({'done': True})}\n\n"
