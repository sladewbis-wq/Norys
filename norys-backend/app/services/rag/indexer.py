"""Document indexing pipeline: file → chunks → embeddings → Qdrant.

Entry points
------------
index_document(tenant_id, document_id, filename, content)
    Full pipeline: extract text, chunk, embed, upsert.

delete_document_vectors(tenant_id, document_id)
    Remove all Qdrant points for a document (call when deleting a doc).
"""
from __future__ import annotations

import uuid

from app.core.logging import get_logger
from app.services.rag.chunker import chunk_text, extract_text
from app.services.rag.embedder import get_embedder
from app.services.rag.store import delete_document, upsert_chunks

logger = get_logger("rag.indexer")

# Embed in batches to respect provider rate limits / payload limits
_EMBED_BATCH = 32


async def index_document(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
    filename: str,
    content: bytes,
) -> int:
    """Index *content* into Qdrant. Returns the number of chunks stored."""
    logger.info(
        "index_start",
        document_id=str(document_id),
        filename=filename,
        bytes=len(content),
    )

    # 1. Extract text from raw bytes
    text = extract_text(content, filename)
    if not text.strip():
        logger.warning("index_empty_text", document_id=str(document_id))
        return 0

    # 2. Split into overlapping chunks
    chunks = chunk_text(text)
    if not chunks:
        return 0

    chunk_texts = [c.text for c in chunks]

    # 3. Generate embeddings in batches
    embedder = get_embedder()
    all_vectors: list[list[float]] = []
    for i in range(0, len(chunk_texts), _EMBED_BATCH):
        batch = chunk_texts[i : i + _EMBED_BATCH]
        vectors = await embedder.embed(batch)
        all_vectors.extend(vectors)

    # 4. Upsert into Qdrant
    await upsert_chunks(
        tenant_id=tenant_id,
        document_id=document_id,
        filename=filename,
        chunks=chunk_texts,
        vectors=all_vectors,
    )

    logger.info(
        "index_done",
        document_id=str(document_id),
        n_chunks=len(chunks),
    )
    return len(chunks)


async def delete_document_vectors(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
) -> None:
    """Remove all vectors for a document (called when a doc is deleted)."""
    await delete_document(tenant_id, document_id)
