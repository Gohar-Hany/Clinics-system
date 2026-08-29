"""
Redis client service — With in-memory fallback for local dev without Docker.
"""

import redis.asyncio as aioredis
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class InMemoryRedis:
    """In-memory Redis-like store for local dev without Redis server."""

    def __init__(self):
        self._store: dict[str, str] = {}
        self._sorted_sets: dict[str, list[tuple[str, float]]] = {}
        self._hashes: dict[str, dict[str, str]] = {}
        self._lists: dict[str, list[str]] = {}
        self._sets: dict[str, set[str]] = {}

    async def sadd(self, key, *members):
        if key not in self._sets:
            self._sets[key] = set()
        for m in members:
            self._sets[key].add(str(m))
        return len(members)

    async def srem(self, key, *members):
        if key in self._sets:
            for m in members:
                self._sets[key].discard(str(m))

    async def smembers(self, key):
        return set(self._sets.get(key, set()))

    async def sismember(self, key, member):
        return str(member) in self._sets.get(key, set())

    async def ping(self):
        return True

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self._store:
            return None
        self._store[key] = str(value)
        return True

    async def get(self, key):
        return self._store.get(key)

    async def delete(self, *keys):
        for key in keys:
            self._store.pop(key, None)

    async def exists(self, key):
        return 1 if key in self._store else 0

    async def zadd(self, key, mapping):
        if key not in self._sorted_sets:
            self._sorted_sets[key] = []
        for member, score in mapping.items():
            # Remove existing
            self._sorted_sets[key] = [(m, s) for m, s in self._sorted_sets[key] if m != member]
            self._sorted_sets[key].append((member, score))
        self._sorted_sets[key].sort(key=lambda x: x[1])

    async def zrem(self, key, *members):
        if key in self._sorted_sets:
            self._sorted_sets[key] = [(m, s) for m, s in self._sorted_sets[key] if m not in members]

    async def zscore(self, key, member):
        if key in self._sorted_sets:
            for m, s in self._sorted_sets[key]:
                if m == member:
                    return s
        return None

    async def zrevrange(self, key, start, stop, withscores=False):
        if key not in self._sorted_sets:
            return []
        sorted_list = sorted(self._sorted_sets[key], key=lambda x: x[1], reverse=True)
        result = sorted_list[start:stop + 1 if stop >= 0 else None]
        if withscores:
            return result
        return [m for m, s in result]

    async def zrange(self, key, start, stop, withscores=False):
        if key not in self._sorted_sets:
            return []
        sorted_list = sorted(self._sorted_sets[key], key=lambda x: x[1])
        result = sorted_list[start:stop + 1 if stop >= 0 else None]
        if withscores:
            return result
        return [m for m, s in result]

    async def hset(self, key, field_or_mapping=None, value=None, **kwargs):
        if key not in self._hashes:
            self._hashes[key] = {}
        if isinstance(field_or_mapping, str):
            self._hashes[key][field_or_mapping] = str(value)
        elif isinstance(field_or_mapping, dict):
            self._hashes[key].update({k: str(v) for k, v in field_or_mapping.items()})

    async def hget(self, key, field):
        return self._hashes.get(key, {}).get(field)

    async def hgetall(self, key):
        return self._hashes.get(key, {})

    async def hexists(self, key, field):
        return field in self._hashes.get(key, {})

    async def hincrby(self, key, field, amount=1):
        if key not in self._hashes:
            self._hashes[key] = {}
        current = int(self._hashes[key].get(field, 0))
        self._hashes[key][field] = str(current + amount)
        return current + amount

    async def lpush(self, key, *values):
        if key not in self._lists:
            self._lists[key] = []
        for v in values:
            self._lists[key].insert(0, str(v))

    async def ltrim(self, key, start, stop):
        if key in self._lists:
            self._lists[key] = self._lists[key][start:stop + 1]

    async def lrange(self, key, start, stop):
        if key not in self._lists:
            return []
        return self._lists[key][start:stop + 1 if stop >= 0 else None]

    def pipeline(self):
        return InMemoryPipeline(self)

    async def close(self):
        pass


class InMemoryPipeline:
    """Fake pipeline that executes commands immediately."""

    def __init__(self, store: InMemoryRedis):
        self._store = store
        self._commands: list = []

    def zadd(self, key, mapping):
        self._commands.append(("zadd", key, mapping))
        return self

    def zrem(self, key, *members):
        self._commands.append(("zrem", key, members))
        return self

    def hset(self, key, field=None, value=None):
        self._commands.append(("hset", key, field, value))
        return self

    def hincrby(self, key, field, amount=1):
        self._commands.append(("hincrby", key, field, amount))
        return self

    async def execute(self):
        for cmd in self._commands:
            if cmd[0] == "zadd":
                await self._store.zadd(cmd[1], cmd[2])
            elif cmd[0] == "zrem":
                await self._store.zrem(cmd[1], *cmd[2])
            elif cmd[0] == "hset":
                await self._store.hset(cmd[1], cmd[2], cmd[3])
            elif cmd[0] == "hincrby":
                await self._store.hincrby(cmd[1], cmd[2], cmd[3])
        self._commands.clear()


class RedisService:
    """Async Redis client wrapper — falls back to in-memory if Redis unavailable."""

    def __init__(self):
        self._client = None
        self._is_memory = False

    async def connect(self, url: str) -> None:
        """Initialize Redis connection, fallback to in-memory."""
        try:
            self._client = aioredis.from_url(url, decode_responses=True, max_connections=20)
            await self._client.ping()
            self._is_memory = False
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}), using in-memory fallback")
            self._client = InMemoryRedis()
            self._is_memory = True
            logger.info("Redis: using in-memory fallback (no Docker)")

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            logger.info("Redis disconnected")

    @property
    def client(self):
        if not self._client:
            self._client = InMemoryRedis()
            self._is_memory = True
        return self._client

    # ╔══════════════════════════════════════════╗
    # ║        Distributed Locking               ║
    # ╚══════════════════════════════════════════╝

    async def acquire_lock(self, key: str, ttl_seconds: int = 30) -> bool:
        result = await self.client.set(f"lock:{key}", "locked", nx=True, ex=ttl_seconds)
        return result is not None

    async def release_lock(self, key: str) -> None:
        await self.client.delete(f"lock:{key}")

    # ╔══════════════════════════════════════════╗
    # ║        Queue Operations (SSOT)           ║
    # ╚══════════════════════════════════════════╝

    def _queue_key(self, clinic_id: str, doctor_id: str, date: str) -> str:
        return f"queue:{clinic_id}:{doctor_id}:{date}"

    def _queue_meta_key(self, clinic_id: str, doctor_id: str, date: str) -> str:
        return f"queue_meta:{clinic_id}:{doctor_id}:{date}"

    def _avg_time_key(self, clinic_id: str, doctor_id: str) -> str:
        return f"avg_time:{clinic_id}:{doctor_id}"

    async def add_to_queue(self, clinic_id, doctor_id, date, appointment_id, queue_number):
        queue_key = self._queue_key(clinic_id, doctor_id, date)
        meta_key = self._queue_meta_key(clinic_id, doctor_id, date)
        pipe = self.client.pipeline()
        pipe.zadd(queue_key, {appointment_id: queue_number})
        pipe.hincrby(meta_key, "total", 1)
        if not await self.client.hexists(meta_key, "current_serving"):
            pipe.hset(meta_key, "current_serving", 0)
        await pipe.execute()

    async def remove_from_queue(self, clinic_id, doctor_id, date, appointment_id):
        queue_key = self._queue_key(clinic_id, doctor_id, date)
        meta_key = self._queue_meta_key(clinic_id, doctor_id, date)
        pipe = self.client.pipeline()
        pipe.zrem(queue_key, appointment_id)
        pipe.hincrby(meta_key, "total", -1)
        await pipe.execute()

    async def update_current_serving(self, clinic_id, doctor_id, date, queue_number):
        meta_key = self._queue_meta_key(clinic_id, doctor_id, date)
        await self.client.hset(meta_key, "current_serving", queue_number)

    async def get_queue_position(self, clinic_id, doctor_id, date, appointment_id):
        queue_key = self._queue_key(clinic_id, doctor_id, date)
        meta_key = self._queue_meta_key(clinic_id, doctor_id, date)
        avg_key = self._avg_time_key(clinic_id, doctor_id)

        score = await self.client.zscore(queue_key, appointment_id)
        if score is None:
            return {"error": "not_in_queue"}

        patient_number = int(score)
        meta = await self.client.hgetall(meta_key)
        current_serving = int(meta.get("current_serving", 0))
        total = int(meta.get("total", 0))
        avg_time = await self.client.get(avg_key)
        avg_minutes = int(avg_time) if avg_time else 20

        patients_ahead = max(0, patient_number - current_serving)
        estimated_wait = patients_ahead * avg_minutes

        return {
            "queue_number": patient_number,
            "current_serving": current_serving,
            "patients_ahead": patients_ahead,
            "total_in_queue": total,
            "avg_consultation_minutes": avg_minutes,
            "estimated_wait_minutes": estimated_wait,
        }

    async def get_next_queue_number(self, clinic_id, doctor_id, date):
        queue_key = self._queue_key(clinic_id, doctor_id, date)
        result = await self.client.zrevrange(queue_key, 0, 0, withscores=True)
        if not result:
            return 1
        return int(result[0][1]) + 1

    async def update_avg_time(self, clinic_id, doctor_id, consultation_duration_minutes):
        avg_key = self._avg_time_key(clinic_id, doctor_id)
        history_key = f"time_history:{clinic_id}:{doctor_id}"

        # Push to duration history list
        await self.client.lpush(history_key, consultation_duration_minutes)
        await self.client.ltrim(history_key, 0, 19) # Keep rolling window of last 20 consultations

        past_times = await self.client.lrange(history_key, 0, 19)
        if past_times:
            durations = [int(x) for x in past_times if str(x).isdigit()]
            if durations:
                new_avg = max(5, int(sum(durations) / len(durations)))
                await self.client.set(avg_key, new_avg)
                return new_avg
        await self.client.set(avg_key, consultation_duration_minutes)
        return consultation_duration_minutes

    async def get_full_queue(self, clinic_id, doctor_id, date):
        queue_key = self._queue_key(clinic_id, doctor_id, date)
        meta_key = self._queue_meta_key(clinic_id, doctor_id, date)
        avg_key = self._avg_time_key(clinic_id, doctor_id)

        entries = await self.client.zrange(queue_key, 0, -1, withscores=True)
        meta = await self.client.hgetall(meta_key)
        avg_time = await self.client.get(avg_key)

        return {
            "entries": [{"appointment_id": aid, "queue_number": int(score)} for aid, score in entries],
            "current_serving": int(meta.get("current_serving", 0)),
            "total": int(meta.get("total", 0)),
            "avg_consultation_minutes": int(avg_time) if avg_time else 20,
        }


redis_service = RedisService()
