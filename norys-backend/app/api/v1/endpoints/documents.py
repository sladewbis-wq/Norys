"""Document endpoints — upload, list, delete + Qdrant RAG indexing.

Upload flow:
  1. Write raw bytes to disk (STORAGE_ROOT / tenant_id / uuid_filename)
  2. Persist Document row with status=PROCESSING
  3. Spawn a background task: extract → chunk → embed → upsert Qdrant → INDEXED
     (or FAILED on error)

The background task runs inside FastAPI's BackgroundTasks so it doesn't block
the response to the client.
"""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import CurrentUser, require_permissions
from app.core.logging import get_logger
from app.models.document import Document, DocumentStatus
from app.models.role import Permission
from app.schemas.common import ORMModel
from app.services.rag import delete_document_vectors, index_document

logger = get_logger("documents")

router = APIRouter(prefix="/documents", tags=["documents"])

# In production this should be object storage (S3/MinIO). Local disk for the MVP.
STORAGE_ROOT = Path("/data/norys/documents")


class DocumentOut(ORMModel):
    id: uuid.UUID
    filename: str
    content_type: str | None
    size_bytes: int | None
    status: DocumentStatus


# ---------------------------------------------------------------------------
# Background task: index a document into Qdrant
# ---------------------------------------------------------------------------

async def _run_indexing(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
    filename: str,
    content: bytes,
) -> None:
    """Index *content* into Qdrant and update the Document status row."""
    async with AsyncSessionLocal() as session:
        doc = await session.scalar(
            select(Document).where(Document.id == document_id)
        )
        if doc is None:
            return

        try:
            await index_document(
                tenant_id=tenant_id,
                document_id=document_id,
                filename=filename,
                content=content,
            )
            doc.status = DocumentStatus.INDEXED
            logger.info("document_indexed", document_id=str(document_id))
        except Exception as exc:
            doc.status = DocumentStatus.FAILED
            logger.error("document_index_failed", document_id=str(document_id), error=str(exc))

        await session.commit()


def _start_indexing(
    tenant_id: uuid.UUID,
    document_id: uuid.UUID,
    filename: str,
    content: bytes,
) -> None:
    """Fire-and-forget wrapper compatible with FastAPI BackgroundTasks."""
    asyncio.create_task(
        _run_indexing(tenant_id, document_id, filename, content)
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[DocumentOut])
async def list_documents(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[Document]:
    result = await db.scalars(
        select(Document)
        .where(Document.tenant_id == current_user.tenant_id)
        .order_by(Document.created_at.desc())
    )
    return list(result)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.DOCUMENT_UPLOAD))],
    file: UploadFile = File(...),
) -> Document:
    tenant_dir = STORAGE_ROOT / str(current_user.tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)

    doc_id = uuid.uuid4()
    dest = tenant_dir / f"{doc_id}_{file.filename}"
    contents = await file.read()
    dest.write_bytes(contents)

    document = Document(
        id=doc_id,
        tenant_id=current_user.tenant_id,
        filename=file.filename or "untitled",
        content_type=file.content_type,
        size_bytes=len(contents),
        storage_path=str(dest),
        status=DocumentStatus.PROCESSING,   # will become INDEXED when done
        uploaded_by=current_user.id,
        vector_collection=f"norys_{current_user.tenant_id.hex}",
    )
    db.add(document)
    await db.flush()

    # Kick off RAG indexing in the background (non-blocking)
    background_tasks.add_task(
        _run_indexing,
        current_user.tenant_id,
        doc_id,
        file.filename or "untitled",
        contents,
    )

    logger.info(
        "document_uploaded",
        document_id=str(doc_id),
        filename=file.filename,
        bytes=len(contents),
    )
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_document(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[object, Depends(require_permissions(Permission.DOCUMENT_DELETE))],
) -> None:
    document = await db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == current_user.tenant_id,
        )
    )
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    # Remove from disk
    if document.storage_path:
        Path(document.storage_path).unlink(missing_ok=True)

    # Remove from Qdrant (best-effort, don't block the response)
    try:
        await delete_document_vectors(
            tenant_id=current_user.tenant_id,
            document_id=document_id,
        )
    except Exception as exc:
        logger.warning("qdrant_delete_failed", document_id=str(document_id), error=str(exc))

    await db.delete(document)
