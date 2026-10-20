"""
LangGraph Checkpointer.

- PostgresSaver when SYNC_DATABASE_URL is reachable and the postgres extra is installed.
- Otherwise an in-memory saver. On serverless hosts (Vercel) the process is recycled between
  requests, so when a real Redis is available each conversation is saved to / restored
  from Redis around every turn (`load_thread` / `save_thread`).
"""

import base64
import logging
import pickle
from collections import defaultdict
from typing import Any

from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)

THREAD_TTL_SECONDS = 7 * 24 * 3600

_checkpointer: Any = None


class RedisBackedMemorySaver(MemorySaver):
    """MemorySaver whose per-thread state can be persisted to Redis between requests."""

    @staticmethod
    def _key(thread_id: str) -> str:
        return f"lg_thread:{thread_id}"

    async def load_thread(self, redis, thread_id: str) -> None:
        raw = await redis.get(self._key(thread_id))
        if not raw:
            return
        try:
            state = pickle.loads(base64.b64decode(raw))
        except Exception:
            logger.warning("Could not restore conversation %s; starting fresh", thread_id)
            return
        self.storage[thread_id] = defaultdict(dict, state["storage"])
        for k, v in state["writes"].items():
            self.writes[k] = v
        for k, v in state["blobs"].items():
            self.blobs[k] = v

    async def save_thread(self, redis, thread_id: str) -> None:
        state = {
            "storage": {ns: dict(cps) for ns, cps in self.storage.get(thread_id, {}).items()},
            "writes": {k: v for k, v in self.writes.items() if k[0] == thread_id},
            "blobs": {k: v for k, v in self.blobs.items() if k[0] == thread_id},
        }
        payload = base64.b64encode(pickle.dumps(state)).decode("ascii")
        await redis.set(self._key(thread_id), payload, ex=THREAD_TTL_SECONDS)


async def init_checkpointer(database_url: str) -> None:
    """Initialize checkpointer — PostgresSaver or in-memory fallback."""
    global _checkpointer

    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from psycopg_pool import ConnectionPool

        pool = ConnectionPool(conninfo=database_url, min_size=2, max_size=10)
        _checkpointer = PostgresSaver(pool)
        _checkpointer.setup()
        logger.info("LangGraph PostgresSaver initialized")
    except Exception as e:
        logger.warning(f"PostgresSaver unavailable ({e}), using in-memory saver")
        _checkpointer = RedisBackedMemorySaver()


def get_checkpointer():
    """Get the initialized checkpointer instance."""
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = RedisBackedMemorySaver()
        logger.info("LangGraph: using in-memory saver (auto-init)")
    return _checkpointer
