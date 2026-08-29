"""
Appointments CRUD endpoints.
"""

from fastapi import APIRouter, Depends

from app.models.schemas import AppointmentCreate, AppointmentResponse, AppointmentStatusUpdate
from app.core.security import verify_clinic_token

router = APIRouter()


@router.get("/{clinic_id}")
async def list_appointments(
    clinic_id: str,
    date: str | None = None,
    doctor_id: str | None = None,
    _: bool = Depends(verify_clinic_token),
) -> list[dict]:
    """
    List appointments for a clinic (filtered by date/doctor).
    Protected: Requires clinic token.
    """
    # TODO: Query Supabase
    return []


@router.get("/{clinic_id}/{appointment_id}")
async def get_appointment(
    clinic_id: str,
    appointment_id: str,
) -> dict:
    """Get a single appointment by ID."""
    # TODO: Query Supabase
    return {}


@router.patch("/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    update: AppointmentStatusUpdate,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    Update appointment status.
    Protected: Requires clinic token.
    """
    # TODO: Update in Supabase + sync with Redis queue
    return {"appointment_id": appointment_id, "status": update.status}
