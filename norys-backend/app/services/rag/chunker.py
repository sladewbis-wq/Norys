"""Text extraction and chunking utilities.

Supports plain text, PDF (via pypdf) and DOCX (via python-docx).
Falls back gracefully if optional libraries are missing.
"""
from __future__ import annotations

import io
import pathlib
from dataclasses import dataclass

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("rag.chunker")


@dataclass
class TextChunk:
    text: str
    chunk_index: int
    char_start: int
    char_end: int


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text(content: bytes, filename: str) -> str:
    """Return raw text from document bytes. Dispatches on file extension."""
    suffix = pathlib.Path(filename).suffix.lower()
    if suffix == ".pdf":
        return _extract_pdf(content)
    if suffix in (".docx", ".doc"):
        return _extract_docx(content)
    # Treat everything else as UTF-8 text (txt, md, csv, …)
    return content.decode("utf-8", errors="replace")


def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(io.BytesIO(content))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        return "\n\n".join(parts)
    except Exception as exc:
        logger.warning("pdf_extraction_failed", error=str(exc))
        return ""


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document  # type: ignore

        doc = Document(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as exc:
        logger.warning("docx_extraction_failed", error=str(exc))
        return ""


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(
    text: str,
    size: int | None = None,
    overlap: int | None = None,
) -> list[TextChunk]:
    """Split *text* into overlapping character-level chunks.

    Returns an empty list if the text is blank after stripping.
    """
    size = size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap
    text = text.strip()
    if not text:
        return []

    chunks: list[TextChunk] = []
    start = 0
    idx = 0

    while start < len(text):
        end = min(start + size, len(text))
        # Try to break at a sentence boundary within the last 20% of the chunk.
        if end < len(text):
            search_from = start + int(size * 0.8)
            boundary = max(
                text.rfind(". ", search_from, end),
                text.rfind("\n", search_from, end),
            )
            if boundary > search_from:
                end = boundary + 1  # include the delimiter

        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append(TextChunk(
                text=chunk_text,
                chunk_index=idx,
                char_start=start,
                char_end=end,
            ))
            idx += 1

        # Advance with overlap
        start = end - overlap if end < len(text) else end

    logger.debug("chunked", total_chars=len(text), n_chunks=len(chunks))
    return chunks
