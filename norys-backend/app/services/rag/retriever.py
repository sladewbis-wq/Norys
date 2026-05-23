"""Semantic retrieval: query → embedding → Qdrant search → formatted context.

Usage in the agent engine:
    context = await retrieve_context(tenant_id, query, top_k=5)
    # context is a string ready to inject into the system prompt.
"""
from __future__ import annotations

import uuid

from app.core.logging import get_logger
from app.services.rag.embedder import get_embedder
from app.services.rag.store import search

logger = get_logger("rag.retriever")


async def retrieve_context(
    tenant_id: uuid.UUID,
    query: str,
    top_k: int = 5,
    score_threshold: float = 0.35,
) -> str:
    """Return a formatted string of relevant document excerpts for *query*.

    Returns an empty string if nothing relevant is found.
    """
    if not query.strip():
        return ""

    embedder = get_embedder()
    try:
        vectors = await embedder.embed([query])
    except Exception as exc:
        logger.warning("embed_query_failed", error=str(exc))
        return ""

    if not vectors:
        return ""

    results = await search(
        tenant_id=tenant_id,
        query_vector=vectors[0],
        top_k=top_k,
        score_threshold=score_threshold,
    )

    if not results:
        logger.debug("no_rag_results", query=query[:80])
        return ""

    lines: list[str] = []
    for i, r in enumerate(results, start=1):
        source = r.get("filename", "document")
        text = r.get("text", "").strip()
        score = r.get("score", 0.0)
        lines.append(f"[{i}] Source : {source} (pertinence {score:.0%})\n{text}")

    context = "\n\n---\n\n".join(lines)
    logger.debug("rag_retrieved", n=len(results), query=query[:80])
    return context
