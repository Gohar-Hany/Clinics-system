"""
Dashboard & clinic profile endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.core.clock import clinic_today_str
from app.core.security import verify_clinic_token
from app.services.appointment_service import (
    appointment_service,
    CLINIC_OPEN_HOUR,
    CLINIC_CLOSE_HOUR,
    LAST_SLOT_HOUR,
    LAST_SLOT_MINUTE,
    SLOT_DURATION_MINUTES,
)

router = APIRouter()


@router.get("/clinic/info", tags=["Clinic"])
async def get_clinic_info() -> dict:
    """Public clinic profile (name, doctor, hours) for the UI header and booking page."""
    s = get_settings()
    return {
        "clinic_name": s.CLINIC_NAME,
        "doctor_name": s.DOCTOR_NAME,
        "doctor_specialty": s.DOCTOR_SPECIALTY,
        "address": s.CLINIC_ADDRESS,
        "phone": s.CLINIC_PHONE,
        "consultation_fee": s.CONSULTATION_FEE,
        "hours": {
            "open": f"{CLINIC_OPEN_HOUR:02d}:00",
            "close": f"{CLINIC_CLOSE_HOUR:02d}:00",
            "last_slot": f"{LAST_SLOT_HOUR:02d}:{LAST_SLOT_MINUTE:02d}",
            "slot_minutes": SLOT_DURATION_MINUTES,
            "off_days": ["الجمعة"],
        },
    }


@router.get("/dashboard/overview", tags=["Dashboard"])
async def get_dashboard_overview(
    date: Optional[str] = None,
    doctor_id: str = "default-doctor",
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """KPIs, today's flow, upcoming load and recent bookings in one payload."""
    return await appointment_service.get_dashboard_overview(date or clinic_today_str(), doctor_id=doctor_id)
