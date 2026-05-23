"""RAG (Retrieval-Augmented Generation) pipeline for Norys.

Three steps:
  1. Ingest  – parse → chunk → embed → store in Qdrant   (indexer.py)
  2. Retrieve – embed query → search Qdrant → format context (retriever.py)
  3. Generate – agent engine injects context into LLM prompt

Public surface used by the rest of the app:
  from app.services.rag import index_document, retrieve_context, delete_document
"""
from app.services.rag.indexer import index_document, delete_document_vectors
from app.services.rag.retriever import retrieve_context

__all__ = ["index_document", "delete_document_vectors", "retrieve_context"]
