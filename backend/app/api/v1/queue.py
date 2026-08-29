"""
Queue endpoints — Real-time queue operations (Redis SSOT).
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import date as date_type

from app.models.schemas import QueuePositionResponse, QueueStateResponse
from app.services.redis_client import redis_service
from app.core.security import verify_clinic_token

router = APIRouter()


@router.get("/position/{clinic_id}/{doctor_id}/{appointment_id}")
async def get_patient_queue_position(
    clinic_id: str,
    doctor_id: str,
    appointment_id: str,
    queue_date: str | None = None,
) -> QueuePositionResponse:
    """
    Get patient's current position in the queue.
    Reads directly from Redis SSOT — no database query needed.
    """
    today = queue_date or str(date_type.today())

    result = await redis_service.get_queue_position(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
        appointment_id=appointment_id,
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail="المريض مش في الطابور")

    return QueuePositionResponse(**result)


@router.get("/state/{clinic_id}/{doctor_id}")
async def get_queue_state(
    clinic_id: str,
    doctor_id: str,
    queue_date: str | None = None,
    _: bool = Depends(verify_clinic_token),
) -> QueueStateResponse:
    """
    Get full queue state for the reception dashboard.
    Protected: Requires clinic token.
    """
    today = queue_date or str(date_type.today())

    result = await redis_service.get_full_queue(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
    )

    return QueueStateResponse(**result)


@router.post("/check-in/{appointment_id}")
async def check_in_patient(
    appointment_id: str,
    clinic_id: str,
    doctor_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    Check in a patient — updates queue in Redis.
    Protected: Requires clinic token.
    """
    today = str(date_type.today())

    # Get next queue number
    queue_number = await redis_service.get_next_queue_number(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
    )

    # Add to queue
    await redis_service.add_to_queue(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
        appointment_id=appointment_id,
        queue_number=queue_number,
    )

    # TODO: Update appointment status in Supabase (checked_in)

    return {
        "message": "تم تسجيل الوصول ✅",
        "queue_number": queue_number,
        "appointment_id": appointment_id,
    }


@router.post("/start/{appointment_id}")
async def start_consultation(
    appointment_id: str,
    clinic_id: str,
    doctor_id: str,
    queue_number: int,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Start a consultation — update current serving in Redis."""
    today = str(date_type.today())

    await redis_service.update_current_serving(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
        queue_number=queue_number,
    )

    # TODO: Update appointment status in Supabase (in_progress)

    return {
        "message": "الكشف بدأ ▶️",
        "queue_number": queue_number,
    }


@router.post("/complete/{appointment_id}")
async def complete_consultation(
    appointment_id: str,
    clinic_id: str,
    doctor_id: str,
    duration_minutes: int,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Complete a consultation — update queue and rolling average."""
    today = str(date_type.today())

    # Update rolling average
    await redis_service.update_avg_time(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        consultation_duration_minutes=duration_minutes,
    )

    # Remove from queue
    await redis_service.remove_from_queue(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
        appointment_id=appointment_id,
    )

    # TODO: Update appointment status in Supabase (completed)
    # TODO: Sync queue state to PostgreSQL

    return {
        "message": "الكشف انتهى ⏹️",
        "duration_minutes": duration_minutes,
    }


@router.post("/cancel/{appointment_id}")
async def cancel_from_queue(
    appointment_id: str,
    clinic_id: str,
    doctor_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Remove a cancelled/no-show patient from the queue."""
    today = str(date_type.today())

    await redis_service.remove_from_queue(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=today,
        appointment_id=appointment_id,
    )

    return {"message": "تم الإزالة من الطابور ❌"}
