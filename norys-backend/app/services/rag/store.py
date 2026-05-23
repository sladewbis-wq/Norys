"""Qdrant vector store operations.

Each tenant gets its own collection named ``norys_{tenant_id}``.
Points are stored with a payload containing:
  - document_id : str  (UUID of the Document row)
  - chunk_index : int
  - text        : str  (raw chunk text, returned on retrieval)
  - filename    : str  (human-readable source label)

Collection is created on first use with the configured vector dimension.
"""
from __future__ import annotations

import uuid
from functools import lru_cache

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("rag.store")


def _collection_name(tenant_id: uuid.UUID) -> str:
    return f"norys_{tenant_id.hex}"


@lru_cache(maxsize=1)
def get_qdrant_client() -> AsyncQdrantClient:
    kwargs: dict = {"url": settings.qdrant_url}
    if settings.qdrant_api_key:
        kwargs["api_key"] = settings.qdrant_api_key
    return AsyncQdrantClient(**kwargs)


async def ensure_collection(tenant_id: uuid.UUID) -> None:
    """Create the tenant collection if it does not yet exist."""
    client = get_qdrant_client()
    name = _collection_name(tenant_id)
    exists = await client.collection_exists(name)
    if not exists:
        await client.create_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(
                size=settings.embedding_dim,
                distance=qmodels.Distance.COSINE,
            ),
        )
        logger.info("qdrant_collection_created", collection=name)


async def upsert_chunks(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
    filename: str,
    chunks: list[str],
    vectors: list[list[float]],
) -> None:
    """Store chunk vectors in Qdrant, keyed by a deterministic point ID."""
    await ensure_collection(tenant_id)
    client = get_qdrant_client()
    name = _collection_name(tenant_id)

    points: list[qmodels.PointStruct] = []
    for idx, (text, vector) in enumerate(zip(chunks, vectors)):
        # Deterministic ID: namespace UUID from (document_id, chunk_index)
        point_id = str(
            uuid.uuid5(document_id, str(idx))
        )
        points.append(
            qmodels.PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "document_id": str(document_id),
                    "chunk_index": idx,
                    "text": text,
                    "filename": filename,
                },
            )
        )

    if points:
        await client.upsert(collection_name=name, points=points)
        logger.info("qdrant_upserted", collection=name, n_points=len(points))


async def delete_document(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
) -> None:
    """Remove all vectors for a given document."""
    client = get_qdrant_client()
    name = _collection_name(tenant_id)
    exists = await client.collection_exists(name)
    if not exists:
        return
    await client.delete(
        collection_name=name,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="document_id",
                        match=qmodels.MatchValue(value=str(document_id)),
                    )
                ]
            )
        ),
    )
    logger.info("qdrant_deleted", collection=name, document_id=str(document_id))


async def search(
    tenant_id: uuid.UUID,
    query_vector: list[float],
    top_k: int = 5,
    score_threshold: float = 0.35,
) -> list[dict]:
    """Return the top-k most relevant chunks for *query_vector*.

    Each result is a dict with keys: ``text``, ``filename``, ``score``.
    """
    client = get_qdrant_client()
    name = _collection_name(tenant_id)
    exists = await client.collection_exists(name)
    if not exists:
        return []

    results = await client.search(
        collection_name=name,
        query_vector=query_vector,
        limit=top_k,
        score_threshold=score_threshold,
        with_payload=True,
    )
    return [
        {
            "text": r.payload.get("text", ""),
            "filename": r.payload.get("filename", ""),
            "score": r.score,
        }
        for r in results
    ]
