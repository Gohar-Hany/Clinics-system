"""
Booking Agent Tools — LangGraph tool definitions for appointment booking.
Uses appointment_service for strict slot isolation, locking, and concurrency protection.
The clinic has a single doctor, so doctor/clinic ids are fixed here rather than
exposed to the LLM (where it could invent wrong values).
"""

import json
import re
from langchain_core.tools import tool
from typing import Optional

from app.core.clock import clinic_today_str
from app.core.arabic_nlp import normalize_arabic_digits
from app.services.appointment_service import (
    appointment_service,
    calculate_slot_queue_number,
    format_date_ar,
    format_time_ar,
    normalize_time,
)
from app.services.redis_client import redis_service

DOCTOR_ID = "default-doctor"
CLINIC_ID = "default-clinic"


def _public_view(appt: dict) -> dict:
    """What the agent may tell the patient about a booking (no internal UUIDs)."""
    return {
        "reference_code": appt.get("reference_code") or f"REF-{appt.get('id', '')[:4].upper()}",
        "patient_name": appt.get("patient_name") or None,
        "date": appt.get("date"),
        "time": appt.get("time"),
        "day_label": format_date_ar(appt.get("date", "")),
        "time_label": format_time_ar(appt.get("time", "")),
        "status": appt.get("status"),
        "queue_number": appt.get("queue_number"),
    }


@tool
async def check_availability(
    date_str: str,
    requested_time: Optional[str] = None,
    time_range: Optional[str] = None,
) -> dict:
    """Check the free appointment slots on a specific date.
    Call this as soon as the patient mentions a day — before asking for a time —
    so you can offer real free times. Already-booked, past and Friday slots are excluded.
    ALWAYS pass requested_time when the patient asked for a specific hour; the result
    then says explicitly whether that exact time is free (requested_time_available).

    Args:
        date_str: Date in YYYY-MM-DD format (e.g. '2026-10-31')
        requested_time: The exact time the patient asked for, 24h HH:MM (e.g. '10:00', '16:30')
        time_range: Optional filter - "morning" (9-12), "afternoon" (12-17), or "all"
    """
    res = await appointment_service.get_available_slots(
        doctor_id=DOCTOR_ID,
        date_str=date_str,
        clinic_id=CLINIC_ID,
        time_range=time_range,
    )
    if not res.get("success"):
        return res

    slots = res.pop("available_slots")
    label = lambda slot: f"{slot['time']} ({slot['formatted']})"

    if requested_time:
        wanted = normalize_time(requested_time)
        res["requested_time"] = wanted
        res["requested_time_available"] = any(slot["time"] == wanted for slot in slots)
        if res["requested_time_available"]:
            res["next_step"] = "Time is free. If you already know the patient's real name and phone, call propose_booking now in this same turn; otherwise ask only for what is missing."
        if not res["requested_time_available"]:
            def distance(slot):
                h, m = map(int, slot["time"].split(":"))
                try:
                    wh, wm = map(int, wanted.split(":"))
                except ValueError:
                    return 0
                return abs((h * 60 + m) - (wh * 60 + wm))
            res["nearest_alternatives"] = [label(slot) for slot in sorted(slots, key=distance)[:3]]
    elif slots:
        # Spread suggestions across the day; the UI shows every free slot as a button.
        picks = {0, len(slots) // 2, len(slots) - 1} if len(slots) > 3 else set(range(len(slots)))
        res["suggested_slots"] = [label(slots[i]) for i in sorted(picks)]

    res["note"] = "All free times are shown to the patient as buttons; mention at most 3."
    return res


PROPOSAL_TTL_SECONDS = 30 * 60
PLACEHOLDER_NAMES = {"الاسم", "اسم", "اسمك", "المريض", "مريض", "name", "patient", "unknown", "غير معروف", "حضرتك"}


def _proposal_key(phone: str, date_str: str, time_str: str) -> str:
    return f"proposal:{phone}:{date_str}:{time_str}"


def _clean_name(name: str | None) -> str | None:
    """A real patient name, or None for empty / placeholder / numeric input."""
    name = " ".join((name or "").split())
    if len(name) < 2 or any(ch.isdigit() for ch in name):
        return None
    if name.lower() in PLACEHOLDER_NAMES or name.strip("()[]<>{}") != name:
        return None
    return name


def _clean_phone(phone: str | None) -> str | None:
    digits = normalize_arabic_digits(phone or "").replace(" ", "").replace("-", "")
    if digits.startswith("+20"):
        digits = "0" + digits[3:]
    return digits if re.fullmatch(r"01[0125]\d{8}", digits) else None


@tool
async def propose_booking(
    patient_name: str,
    patient_phone: str,
    date_str: str,
    time_str: str,
    notes: Optional[str] = None,
) -> dict:
    """Validate a booking BEFORE asking the patient to confirm it.
    Checks the name, the phone, that the slot is free and that the patient has no
    other booking that day. Only after this succeeds may you show the summary and
    ask "أأكد الحجز؟". Never invent or use placeholder values — if the name or
    phone is unknown, ask the patient instead of calling this tool.

    Args:
        patient_name: Patient's real name exactly as they typed it
        patient_phone: Patient's Egyptian mobile number (01xxxxxxxxx)
        date_str: Date in YYYY-MM-DD format
        time_str: Time in 24h HH:MM format (e.g. '09:30', '14:00')
        notes: Optional short reason for the visit, if the patient mentioned one
    """
    name = _clean_name(patient_name)
    phone = _clean_phone(patient_phone)
    missing = [label for label, value in (("name", name), ("phone", phone)) if not value]
    if missing:
        return {
            "success": False,
            "error": "missing_patient_info",
            "missing": missing,
            "message": "لازم تطلب من المريض " + " و".join({"name": "اسمه", "phone": "رقم موبايله الصحيح (01xxxxxxxxx)"}[m] for m in missing) + " الأول.",
        }

    time_str = normalize_time(time_str)
    invalid = appointment_service._validate_slot(date_str.strip(), time_str)
    if invalid:
        return invalid
    if await redis_service.client.sismember(f"doctor_slots:{DOCTOR_ID}:{date_str}", time_str):
        return {"success": False, "error": "slot_taken", "message": f"الميعاد {time_str} يوم {date_str} اتحجز. اعرض مواعيد تانية."}
    for a in await appointment_service.get_patient_appointments(phone):
        if a.get("status") in ("scheduled", "checked_in", "in_progress") and a.get("date") == date_str:
            return {
                "success": False,
                "error": "already_booked_today",
                "existing_appointment": _public_view(a),
                "message": "المريض عنده حجز في نفس اليوم؛ اعرض عليه تعديل الحجز الحالي بدل حجز جديد.",
            }

    proposal = {"patient_name": name, "patient_phone": phone, "date": date_str, "time": time_str, "notes": notes or ""}
    await redis_service.client.set(_proposal_key(phone, date_str, time_str), json.dumps(proposal, ensure_ascii=False), ex=PROPOSAL_TTL_SECONDS)
    return {
        "success": True,
        **proposal,
        "day_label": format_date_ar(date_str),
        "time_label": format_time_ar(time_str),
        "queue_number": calculate_slot_queue_number(time_str),
        "next_step": "NOT booked yet. Ask the patient in one short line to confirm (the UI shows a card with the details). There is no booking code until confirm_booking succeeds. When they say yes, call confirm_booking with the same phone, date and time.",
    }


@tool
async def confirm_booking(patient_phone: str, date_str: str, time_str: str) -> dict:
    """Book the appointment the patient just confirmed. Only call this after the
    patient explicitly said yes to the details from propose_booking. It only books
    exactly what propose_booking validated.

    Args:
        patient_phone: Same phone passed to propose_booking
        date_str: Same date (YYYY-MM-DD) passed to propose_booking
        time_str: Same time (HH:MM) passed to propose_booking
    """
    key = _proposal_key(_clean_phone(patient_phone) or patient_phone, date_str.strip(), normalize_time(time_str))
    raw = await redis_service.client.get(key)
    if not raw:
        return {
            "success": False,
            "error": "no_valid_proposal",
            "message": "مفيش حجز مجهّز للتأكيد (أو انتهت صلاحيته). نادِ propose_booking الأول بالبيانات الحقيقية.",
        }
    proposal = json.loads(raw)
    res = await appointment_service.book_appointment(
        patient_phone=proposal["patient_phone"],
        patient_name=proposal["patient_name"],
        date_str=proposal["date"],
        time_str=proposal["time"],
        doctor_id=DOCTOR_ID,
        clinic_id=CLINIC_ID,
        notes=proposal.get("notes"),
        source="ai_chat",
    )
    if res.get("success"):
        await redis_service.client.delete(key)
    if res.get("existing_appointment"):
        res["existing_appointment"] = _public_view(res["existing_appointment"])
    return res


@tool
async def get_my_appointments(
    patient_phone: str,
) -> dict:
    """List the patient's current and upcoming appointments (by their phone number).

    Args:
        patient_phone: Patient's phone number
    """
    appts = await appointment_service.get_patient_appointments(patient_phone)
    if not appts:
        return {
            "success": True,
            "appointments": [],
            "message": f"لا توجد أي حجوزات مسجلة برقم الهاتف {patient_phone} حالياً.",
        }
    return {
        "success": True,
        "appointments": [_public_view(a) for a in appts],
        "total": len(appts),
    }


@tool
async def cancel_appointment(
    patient_phone: str,
    date_str: Optional[str] = None,
    reason: Optional[str] = None,
) -> dict:
    """Cancel the patient's appointment and free the slot.
    Only call after the patient confirmed they want to cancel.

    Args:
        patient_phone: Patient's phone number
        date_str: Date of the appointment to cancel (YYYY-MM-DD), if they have more than one
        reason: Optional cancellation reason
    """
    return await appointment_service.cancel_appointment(
        patient_phone=patient_phone,
        date_str=date_str,
        doctor_id=DOCTOR_ID,
        clinic_id=CLINIC_ID,
        reason=reason,
    )


@tool
async def reschedule_appointment(
    patient_phone: str,
    new_date: str,
    new_time: str,
    old_date: Optional[str] = None,
) -> dict:
    """Move the patient's existing appointment to a new date/time (frees the old slot).
    If the new slot is invalid or taken, the original booking is kept.

    Args:
        patient_phone: Patient's phone number
        new_date: New date in YYYY-MM-DD format
        new_time: New time in 24h HH:MM format
        old_date: Date of the appointment being moved, if they have more than one
    """
    if not any(a.get("status") == "scheduled" for a in await appointment_service.get_patient_appointments(patient_phone)):
        return {
            "success": False,
            "error": "no_existing_booking",
            "message": "مفيش حجز قائم للمريض ده، فده مش تعديل. لو كان بيغيّر ميعاد لسه ما اتأكدش، نادِ check_availability ثم propose_booking بالميعاد الجديد على طول، ومتقولش للمريض إن مفيش حجز.",
        }
    return await appointment_service.reschedule_appointment(
        patient_phone=patient_phone,
        new_date=new_date,
        new_time=new_time,
        old_date=old_date,
        doctor_id=DOCTOR_ID,
        clinic_id=CLINIC_ID,
    )


@tool
async def get_queue_position(
    patient_phone: str,
) -> dict:
    """Get the patient's live queue position and estimated wait for today's visit.
    For a future appointment it returns the booking details instead.

    Args:
        patient_phone: Patient's phone number
    """
    today = clinic_today_str()
    appts = await appointment_service.get_patient_appointments(patient_phone)
    active = [a for a in appts if a.get("status") in ("scheduled", "checked_in", "in_progress")]
    todays = [a for a in active if a.get("date") == today]
    upcoming = [a for a in active if a.get("date", "") > today]

    if not todays:
        if upcoming:
            nxt = upcoming[0]
            return {
                "success": True,
                "is_today": False,
                "next_appointment": _public_view(nxt),
                "message": f"الموعد يوم {nxt.get('date')} الساعة {nxt.get('time')} (مش النهارده)؛ الطابور المباشر بيشتغل يوم الكشف نفسه.",
            }
        return {
            "success": False,
            "message": f"مفيش حجز نشط برقم {patient_phone}.",
        }

    appt = todays[0]
    if appt.get("status") == "in_progress":
        return {"success": True, "is_today": True, "status": "in_progress", "message": "المريض داخل الكشف دلوقتي."}

    result = await redis_service.get_queue_position(
        clinic_id=CLINIC_ID,
        doctor_id=DOCTOR_ID,
        date=today,
        appointment_id=appt["id"],
    )
    if "error" in result:
        return {"success": False, "message": "الحجز مش ظاهر في طابور النهارده."}

    return {
        "success": True,
        "is_today": True,
        "appointment": _public_view(appt),
        "arrived": appt.get("status") == "checked_in",
        "patients_ahead": result["patients_ahead"],
        "estimated_wait_minutes": result["estimated_wait_minutes"],
        "avg_consultation_minutes": result["avg_consultation_minutes"],
    }


BOOKING_TOOLS = [
    check_availability,
    propose_booking,
    confirm_booking,
    get_my_appointments,
    cancel_appointment,
    reschedule_appointment,
    get_queue_position,
]
