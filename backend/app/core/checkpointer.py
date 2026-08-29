"""
LangGraph Checkpointer — With in-memory fallback for local dev.
"""

from langgraph.checkpoint.memory import MemorySaver
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)

_checkpointer: Any = None


async def init_checkpointer(database_url: str) -> None:
    """Initialize checkpointer — PostgresSaver or MemorySaver fallback."""
    global _checkpointer

    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool

        pool = ConnectionPool(conninfo=database_url, min_size=2, max_size=10)
        _checkpointer = PostgresSaver(pool)
        _checkpointer.setup()
        logger.info("LangGraph PostgresSaver initialized")
    except Exception as e:
        logger.warning(f"PostgresSaver unavailable ({e}), using MemorySaver")
        _checkpointer = MemorySaver()
        logger.info("LangGraph: using MemorySaver (no Docker/PostgreSQL)")


def get_checkpointer():
    """Get the initialized checkpointer instance."""
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = MemorySaver()
        logger.info("LangGraph: using MemorySaver (auto-init)")
    return _checkpointer
