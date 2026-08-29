"""
Queue Engine — Manages the live queue with Redis as SSOT.
Handles periodic sync to PostgreSQL for durability.
"""

from datetime import datetime, date
from typing import Optional

from app.services.redis_client import redis_service


class QueueEngine:
    """
    Queue management engine.
    Redis is the Single Source of Truth for all real-time operations.
    PostgreSQL is synced periodically for durability and reporting.
    """

    async def check_in(
        self,
        clinic_id: str,
        doctor_id: str,
        appointment_id: str,
        queue_date: Optional[str] = None,
    ) -> dict:
        """Check in a patient and add to the queue."""
        today = queue_date or str(date.today())

        queue_number = await redis_service.get_next_queue_number(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
        )

        await redis_service.add_to_queue(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
            appointment_id=appointment_id,
            queue_number=queue_number,
        )

        return {
            "queue_number": queue_number,
            "appointment_id": appointment_id,
        }

    async def start_consultation(
        self,
        clinic_id: str,
        doctor_id: str,
        queue_number: int,
        queue_date: Optional[str] = None,
    ) -> None:
        """Mark a consultation as started — update current serving."""
        today = queue_date or str(date.today())

        await redis_service.update_current_serving(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
            queue_number=queue_number,
        )

    async def complete_consultation(
        self,
        clinic_id: str,
        doctor_id: str,
        appointment_id: str,
        duration_minutes: int,
        queue_date: Optional[str] = None,
    ) -> None:
        """Mark a consultation as complete — update averages and remove from queue."""
        today = queue_date or str(date.today())

        # Update rolling average consultation time
        await redis_service.update_avg_time(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            consultation_duration_minutes=duration_minutes,
        )

        # Remove from active queue
        await redis_service.remove_from_queue(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
            appointment_id=appointment_id,
        )

    async def mark_no_show(
        self,
        clinic_id: str,
        doctor_id: str,
        appointment_id: str,
        queue_date: Optional[str] = None,
    ) -> None:
        """Remove a no-show patient from the queue."""
        today = queue_date or str(date.today())

        await redis_service.remove_from_queue(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
            appointment_id=appointment_id,
        )

    async def get_position(
        self,
        clinic_id: str,
        doctor_id: str,
        appointment_id: str,
        queue_date: Optional[str] = None,
    ) -> dict:
        """Get patient's current queue position and ETA."""
        today = queue_date or str(date.today())

        return await redis_service.get_queue_position(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
            appointment_id=appointment_id,
        )

    async def get_dashboard_state(
        self,
        clinic_id: str,
        doctor_id: str,
        queue_date: Optional[str] = None,
    ) -> dict:
        """Get full queue state for the reception dashboard."""
        today = queue_date or str(date.today())

        return await redis_service.get_full_queue(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
        )

    async def sync_to_postgres(
        self,
        clinic_id: str,
        doctor_id: str,
        queue_date: Optional[str] = None,
    ) -> None:
        """
        Sync current Redis queue state to PostgreSQL.
        Called periodically or on key events.
        """
        today = queue_date or str(date.today())

        queue_data = await redis_service.get_full_queue(
            clinic_id=clinic_id,
            doctor_id=doctor_id,
            date=today,
        )

        # TODO: Upsert into queue_state table in Supabase
        # await supabase.table("queue_state").upsert({
        #     "clinic_id": clinic_id,
        #     "doctor_id": doctor_id,
        #     "queue_date": today,
        #     "current_number": queue_data["current_serving"],
        #     "total_in_queue": queue_data["total"],
        #     "queue_entries": queue_data["entries"],
        #     "last_synced_at": datetime.utcnow().isoformat(),
        # }).execute()

        pass


# Singleton
queue_engine = QueueEngine()
