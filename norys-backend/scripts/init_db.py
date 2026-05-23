"""
init_db.py — Create all database tables from SQLAlchemy models.

Usage (inside the container or with the right env vars):
    python scripts/init_db.py

This replaces Alembic for the initial setup. It is idempotent: running it
multiple times won't drop or truncate existing data (checkfirst=True).
"""
from __future__ import annotations

import asyncio
import sys

# Import all models so they register themselves on Base.metadata.
import app.models  # noqa: F401 — side-effect import

from app.core.database import Base, engine


async def create_tables() -> None:
    print("[init_db] Connecting to database…")
    async with engine.begin() as conn:
        print("[init_db] Creating tables (checkfirst=True — safe to re-run)…")
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("[init_db] Done. All tables are ready.")


if __name__ == "__main__":
    try:
        asyncio.run(create_tables())
    except Exception as exc:
        print(f"[init_db] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
