"""
Appointments endpoints — reception desk operations and day lists.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.clock import clinic_today_str
from app.core.security import verify_clinic_token
from app.services import demo_seed
from app.services.appointment_service import appointment_service

router = APIRouter()


class WalkInBookingRequest(BaseModel):
    """Booking entered by the reception desk (walk-in or phone call)."""
    patient_name: str = Field(..., min_length=2, max_length=100)
    patient_phone: str = Field(..., pattern=r"^01[0125][0-9]{8}$")
    date: str = Field(..., description="YYYY-MM-DD")
    time: str = Field(..., description="HH:MM")
    notes: Optional[str] = Field(None, max_length=500)
    doctor_id: str = "default-doctor"
    clinic_id: str = "default-clinic"


class StatusUpdateRequest(BaseModel):
    action: Literal["check_in", "start", "complete", "no_show", "cancel"]


@router.post("/admin/clear-all-data")
@router.delete("/admin/clear-all-data")
async def clear_all_clinic_data(
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    🧹 Admin Data Reset: Clears all past appointments, slots, locks, and queues.
    Protected: Requires X-Clinic-Token header.
    """
    return await appointment_service.clear_all_data()


@router.post("/admin/seed-demo")
async def seed_demo_data(
    as_of: Optional[str] = Query(None, pattern=r"^\d{2}:\d{2}$", description="Lay out today as if it were HH:MM"),
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    🧪 Replace ALL data with a realistic demo day (for demos / UI development).
    Protected: Requires X-Clinic-Token header.
    """
    return await demo_seed.seed_demo_data(as_of)


@router.get("/slots")
async def get_available_slots(
    date: str,
    doctor_id: str = "default-doctor",
) -> dict:
    """Free slots for a day (used by the reception booking form)."""
    return await appointment_service.get_available_slots(doctor_id=doctor_id, date_str=date)


@router.get("")
async def list_appointments(
    date: Optional[str] = None,
    doctor_id: str = "default-doctor",
    status: Optional[str] = None,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """
    List a day's appointments (defaults to today), ordered by slot time.
    Protected: Requires clinic token.
    """
    day = date or clinic_today_str()
    appts = await appointment_service.list_appointments(day, doctor_id=doctor_id, status=status)
    return {"date": day, "appointments": appts, "total": len(appts)}


@router.post("")
async def create_walk_in_appointment(
    request: WalkInBookingRequest,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Book an appointment from the reception desk."""
    result = await appointment_service.book_appointment(
        patient_phone=request.patient_phone,
        patient_name=request.patient_name,
        date_str=request.date,
        time_str=request.time,
        doctor_id=request.doctor_id,
        clinic_id=request.clinic_id,
        notes=request.notes,
        source="reception",
    )
    if not result.get("success"):
        raise HTTPException(status_code=409, detail=result.get("message", "تعذر الحجز"))
    return result


@router.post("/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    request: StatusUpdateRequest,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Move a visit through check-in → consultation → done (or no-show / cancel)."""
    result = await appointment_service.update_status(appointment_id, request.action)
    if not result.get("success"):
        code = 404 if result.get("error") == "not_found" else 409
        raise HTTPException(status_code=code, detail=result.get("message"))
    return result


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Get a single appointment by ID."""
    appt = await appointment_service.get_appointment(appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="الحجز غير موجود")
    return appt
