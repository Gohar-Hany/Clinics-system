"""
Queue endpoints — Real-time queue operations (Redis SSOT).
"""

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import QueuePositionResponse, QueueStateResponse
from app.services.redis_client import redis_service
from app.services.appointment_service import appointment_service, format_date_ar, format_time_ar
from app.core.clock import clinic_today_str
from app.core.security import verify_clinic_token

router = APIRouter()


async def _find_appointment(identifier: str) -> dict | None:
    """Resolve a phone number, reference code (REF-C433 / C433) or appointment UUID."""
    ident = identifier.strip()

    appt = await appointment_service.get_appointment(ident)
    if appt:
        return appt

    clean_ref = ident.upper().replace("REF-", "").replace("REF", "").replace("#", "").strip()
    if clean_ref:
        ref_id = await redis_service.client.get(f"ref_code:{clean_ref}") or await redis_service.client.get(f"ref_code:REF-{clean_ref}")
        if ref_id:
            appt = await appointment_service.get_appointment(ref_id.decode() if isinstance(ref_id, bytes) else str(ref_id))
            if appt:
                return appt

    clean_phone = ident.replace(" ", "").replace("-", "")
    appts = await appointment_service.get_patient_appointments(clean_phone)
    if appts:
        today = clinic_today_str()
        live = [a for a in appts if a.get("status") in ("scheduled", "checked_in", "in_progress")]
        # Prefer today's visit, then the nearest upcoming one, then the latest past one
        todays = [a for a in live if a.get("date") == today]
        upcoming = [a for a in live if a.get("date", "") > today]
        if todays or upcoming:
            return (todays or upcoming)[0]
        return appts[-1]

    return None


@router.get("/position/{clinic_id}/{doctor_id}/{identifier}")
async def get_patient_queue_position(
    clinic_id: str,
    doctor_id: str,
    identifier: str,
) -> QueuePositionResponse:
    """
    Get patient's current position in the queue.
    Universal Search: Supports:
    1. Phone Number (e.g. 01284709314)
    2. Reference Code (e.g. REF-C433 or C433)
    3. Appointment UUID (e.g. c43345fa-f1c9-418c-8bed-6e3aedd9d1d2)
    """
    appt = await _find_appointment(identifier)
    if not appt:
        raise HTTPException(status_code=404, detail="لم يتم العثور على أي حجز مسجل بهذا الرقم أو الكود")

    today = clinic_today_str()
    appt_date = appt.get("date", today)
    status = appt.get("status", "scheduled")
    base = {
        "status": status,
        "appointment_id": appt["id"],
        "reference_code": appt.get("reference_code"),
        "patient_name": appt.get("patient_name") or None,
        "scheduled_date": appt_date,
        "scheduled_time": appt.get("time"),
        "day_label": format_date_ar(appt_date),
        "time_label": format_time_ar(appt.get("time", "")),
        "is_today": appt_date == today,
        "queue_number": appt.get("queue_number", 1),
    }

    meta = await redis_service.get_full_queue(clinic_id, doctor_id, appt_date)
    avg = meta["avg_consultation_minutes"]

    if appt_date != today or status not in ("scheduled", "checked_in", "in_progress"):
        return QueuePositionResponse(
            **base,
            current_serving=meta["current_serving"] if appt_date == today else 0,
            patients_ahead=0,
            total_in_queue=meta["total"],
            avg_consultation_minutes=avg,
            estimated_wait_minutes=0,
        )

    result = await redis_service.get_queue_position(clinic_id, doctor_id, appt_date, appt["id"])
    if "error" in result:
        result = {
            "current_serving": meta["current_serving"],
            "patients_ahead": 0,
            "total_in_queue": meta["total"],
            "avg_consultation_minutes": avg,
            "estimated_wait_minutes": 0,
        }
    result.pop("queue_number", None)
    if status == "in_progress":
        result["patients_ahead"] = 0
        result["estimated_wait_minutes"] = 0
    return QueuePositionResponse(**base, **result)


@router.get("/display/{clinic_id}/{doctor_id}")
async def get_public_queue_display(clinic_id: str, doctor_id: str) -> dict:
    """
    Waiting-room screen data — ticket numbers only, no names or phone numbers,
    so it is safe to show publicly without the clinic token.
    """
    today = clinic_today_str()
    appts = await appointment_service.list_appointments(today, doctor_id=doctor_id)
    serving = next((a for a in appts if a["status"] == "in_progress"), None)
    waiting = [a for a in appts if a["status"] in ("checked_in", "scheduled")]
    meta = await redis_service.get_full_queue(clinic_id, doctor_id, today)
    return {
        "date": today,
        "now_serving": serving["queue_number"] if serving else None,
        "waiting": [
            {"queue_number": a["queue_number"], "time": a["time"], "arrived": a["status"] == "checked_in"}
            for a in waiting
        ],
        "completed_count": sum(1 for a in appts if a["status"] == "completed"),
        "avg_consultation_minutes": meta["avg_consultation_minutes"],
    }


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
    result = await redis_service.get_full_queue(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=queue_date or clinic_today_str(),
    )
    return QueueStateResponse(**result)


async def _transition(appointment_id: str, action: str) -> dict:
    result = await appointment_service.update_status(appointment_id, action)
    if not result.get("success"):
        raise HTTPException(status_code=404 if result.get("error") == "not_found" else 409, detail=result.get("message"))
    return result


# Legacy reception actions — kept for Postman / older clients, now backed by the
# appointment lifecycle so the dashboard and the queue never disagree.

@router.post("/check-in/{appointment_id}")
async def check_in_patient(
    appointment_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    result = await _transition(appointment_id, "check_in")
    return {"message": "تم تسجيل الوصول ✅", "queue_number": result["appointment"]["queue_number"], "appointment_id": appointment_id}


@router.post("/start/{appointment_id}")
async def start_consultation(
    appointment_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    result = await _transition(appointment_id, "start")
    return {"message": "الكشف بدأ ▶️", "queue_number": result["appointment"]["queue_number"]}


@router.post("/complete/{appointment_id}")
async def complete_consultation(
    appointment_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    result = await _transition(appointment_id, "complete")
    return {"message": "الكشف انتهى ⏹️", "duration_minutes": result["appointment"].get("duration_minutes")}


@router.post("/cancel/{appointment_id}")
async def cancel_from_queue(
    appointment_id: str,
    _: bool = Depends(verify_clinic_token),
) -> dict:
    """Mark a patient as no-show and remove them from the queue."""
    await _transition(appointment_id, "no_show")
    return {"message": "تم الإزالة من الطابور ❌"}
