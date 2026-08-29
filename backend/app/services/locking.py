"""
Distributed Locking Service — Prevents concurrent booking conflicts.
Uses Redis SETNX as fast-fail + PostgreSQL FOR UPDATE as ACID guarantee.
"""

from app.services.redis_client import redis_service
from app.core.exceptions import LockAcquisitionFailedException


class LockService:
    """
    Two-layer distributed locking for appointment booking:
    1. Redis SETNX — Fast fail for concurrent requests
    2. PostgreSQL SELECT ... FOR UPDATE — ACID guarantee
    """

    @staticmethod
    async def acquire_slot_lock(
        doctor_id: str,
        date: str,
        time: str,
        ttl_seconds: int = 30,
    ) -> bool:
        """
        Acquire a Redis lock for a specific appointment slot.

        Args:
            doctor_id: Doctor UUID
            date: Date string (YYYY-MM-DD)
            time: Time string (HH:MM)
            ttl_seconds: Lock TTL (auto-release after this)

        Returns:
            True if lock acquired, False if slot is being booked
        """
        lock_key = f"slot:{doctor_id}:{date}:{time}"
        return await redis_service.acquire_lock(lock_key, ttl_seconds)

    @staticmethod
    async def release_slot_lock(
        doctor_id: str,
        date: str,
        time: str,
    ) -> None:
        """Release the Redis lock for a specific appointment slot."""
        lock_key = f"slot:{doctor_id}:{date}:{time}"
        await redis_service.release_lock(lock_key)

    @staticmethod
    async def acquire_or_fail(
        doctor_id: str,
        date: str,
        time: str,
        ttl_seconds: int = 30,
    ) -> None:
        """
        Acquire lock or raise exception immediately.
        Use this in the booking flow for fast-fail behavior.
        """
        acquired = await LockService.acquire_slot_lock(
            doctor_id, date, time, ttl_seconds
        )
        if not acquired:
            raise LockAcquisitionFailedException(
                f"slot:{doctor_id}:{date}:{time}"
            )


# Singleton instance
lock_service = LockService()
