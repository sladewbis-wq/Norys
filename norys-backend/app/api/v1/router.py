"""Aggregate every v1 endpoint router under a single APIRouter."""
from fastapi import APIRouter

from app.api.v1.endpoints import admin, agents, auth, chat, documents, settings, system

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(agents.router)
api_router.include_router(chat.router)
api_router.include_router(documents.router)
api_router.include_router(admin.router)
api_router.include_router(settings.router)
