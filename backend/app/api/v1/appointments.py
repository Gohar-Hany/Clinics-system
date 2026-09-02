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


from app.services.appointment_service import appointment_service

@router.post("/admin/clear-all-data")
async def clear_all_clinic_data(
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    🧹 Admin Data Reset: Clears all past appointments, slots, locks, and queues.
    Protected: Requires X-Clinic-Token header.
    """
    return await appointment_service.clear_all_data()
