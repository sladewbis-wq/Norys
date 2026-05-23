"""Agent execution engine.

Turns an Agent definition + conversation history into an LLM call and persists
the result. This is the seam where the RAG retriever and MCP/tool calls plug in
later: ``_build_context`` is the single place that assembles the prompt.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from app.core.logging import get_logger
from app.models.agent import Agent
from app.models.message import Message, MessageRole
from app.services.llm import ChatMessage, LLMResponse, get_llm_router

logger = get_logger("agent")

# Library of ready-to-use agent presets matching the product vision. These seed
# a new tenant so it has useful agents on day one (helpdesk IT, HR, support...).
AGENT_PRESETS: list[dict] = [
    {
        "name": "Assistant Helpdesk IT",
        "category": "helpdesk",
        "description": "Diagnostique les incidents IT, génère des procédures et aide à la résolution de tickets.",
        "system_prompt": (
            "Tu es l'assistant helpdesk IT interne de l'entreprise. Tu aides les "
            "employés à résoudre leurs problèmes informatiques de façon claire et "
            "pédagogique. Tu proposes des étapes numérotées, tu demandes les "
            "informations manquantes, et tu signales quand une action nécessite "
            "l'intervention d'un administrateur. Réponds toujours dans la langue de "
            "l'utilisateur."
        ),
        "use_rag": True,
    },
    {
        "name": "Assistant RH",
        "category": "hr",
        "description": "Répond aux questions RH courantes en s'appuyant sur les politiques internes.",
        "system_prompt": (
            "Tu es l'assistant RH interne. Tu réponds aux questions sur les congés, "
            "notes de frais, politiques internes et procédures RH en t'appuyant "
            "uniquement sur les documents officiels de l'entreprise. Si tu n'es pas "
            "certain, tu invites l'employé à contacter le service RH."
        ),
        "use_rag": True,
    },
    {
        "name": "Assistant Support Client",
        "category": "support",
        "description": "Aide les équipes support à répondre aux clients de façon cohérente.",
        "system_prompt": (
            "Tu es un assistant de support client. Tu rédiges des réponses "
            "professionnelles, empathiques et précises, dans le ton de la marque."
        ),
        "use_rag": True,
    },
    {
        "name": "Assistant Documents",
        "category": "documents",
        "description": "Recherche, résume et explique les documents internes.",
        "system_prompt": (
            "Tu es un assistant documentaire. Tu réponds aux questions en citant les "
            "documents internes pertinents et tu indiques clairement tes sources."
        ),
        "use_rag": True,
    },
    {
        "name": "Assistant Général",
        "category": "general",
        "description": "Assistant conversationnel polyvalent pour les tâches du quotidien.",
        "system_prompt": (
            "Tu es un assistant IA d'entreprise utile, fiable et concis."
        ),
        "use_rag": False,
    },
]


class AgentEngine:
    def __init__(self) -> None:
        self._router = get_llm_router()

    def _build_context(
        self,
        agent: Agent,
        history: list[Message],
        rag_context: str | None = None,
    ) -> list[ChatMessage]:
        system = agent.system_prompt or "You are a helpful enterprise AI assistant."
        if agent.use_rag and rag_context:
            system += (
                "\n\n# Contexte documentaire privé\n"
                "Utilise en priorité les extraits ci-dessous pour répondre. "
                "Si l'information n'y figure pas, dis-le clairement.\n\n"
                f"{rag_context}"
            )
        messages: list[ChatMessage] = [ChatMessage(role="system", content=system)]
        for msg in history:
            if msg.role in (MessageRole.USER, MessageRole.ASSISTANT):
                messages.append(ChatMessage(role=msg.role.value, content=msg.content))
        return messages

    async def run(
        self,
        agent: Agent,
        history: list[Message],
        *,
        rag_context: str | None = None,
    ) -> LLMResponse:
        messages = self._build_context(agent, history, rag_context)
        logger.info(
            "agent_run",
            agent=agent.name,
            provider=agent.provider or "default",
            model=agent.model or "default",
            history_len=len(history),
        )
        return await self._router.chat(
            messages,
            provider=agent.provider,
            model=agent.model,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
        )

    def stream(
        self,
        agent: Agent,
        history: list[Message],
        *,
        rag_context: str | None = None,
    ) -> AsyncIterator[str]:
        messages = self._build_context(agent, history, rag_context)
        return self._router.stream_chat(
            messages,
            provider=agent.provider,
            model=agent.model,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
        )


@lru_cache
def get_agent_engine() -> AgentEngine:
    return AgentEngine()
