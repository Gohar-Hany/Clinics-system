"""
Booking Agent Tools — LangGraph tool definitions for appointment booking.
Uses appointment_service for strict slot isolation, locking, and concurrency protection.
"""

from langchain_core.tools import tool
from datetime import datetime
from typing import Optional

from app.services.appointment_service import appointment_service
from app.services.redis_client import redis_service


@tool
async def check_availability(
    date_str: str,
    doctor_id: str = "default-doctor",
    clinic_id: str = "default-clinic",
    time_range: Optional[str] = None,
) -> dict:
    """Check available appointment slots for a doctor on a specific date.
    Strictly filters out any slots that are already booked, in the past, or on clinic off-days (e.g. Friday).

    Args:
        date_str: Date in YYYY-MM-DD format (e.g. '2026-10-31')
        doctor_id: UUID of the doctor (defaults to default-doctor)
        clinic_id: UUID of the clinic (defaults to default-clinic)
        time_range: Optional filter - "morning" (9-12), "afternoon" (12-17), or "all"

    Returns:
        Dict with available_slots list (only unbooked slots) and total_available count
    """
    res = await appointment_service.get_available_slots(
        doctor_id=doctor_id,
        date_str=date_str,
        clinic_id=clinic_id,
        time_range=time_range,
    )
    return res


@tool
async def create_appointment(
    patient_phone: str,
    date_str: str,
    time_str: str,
    doctor_id: str = "default-doctor",
    clinic_id: str = "default-clinic",
    patient_id: str = "default-patient",
    notes: Optional[str] = None,
) -> dict:
    """Book a new appointment slot for a patient.
    Guarantees that a slot can ONLY be booked by ONE patient. Rejects double booking, past dates/times, and off-days.

    Args:
        patient_phone: Patient's phone number
        date_str: Date in YYYY-MM-DD format
        time_str: Time in HH:MM format (e.g. '12:00', '14:30')
        doctor_id: UUID of the doctor (defaults to default-doctor)
        clinic_id: UUID of the clinic (defaults to default-clinic)
        patient_id: UUID of the patient (defaults to default-patient)
        notes: Optional notes about the appointment

    Returns:
        Dict with success status, appointment_id, queue_number, or slot_taken error message
    """
    return await appointment_service.book_appointment(
        patient_phone=patient_phone,
        date_str=date_str,
        time_str=time_str,
        doctor_id=doctor_id,
        clinic_id=clinic_id,
        patient_id=patient_id,
        notes=notes,
    )


@tool
async def get_my_appointments(
    patient_phone: str,
) -> dict:
    """Retrieve all current and upcoming appointments booked for a patient's phone number.

    Args:
        patient_phone: Patient's phone number

    Returns:
        Dict with list of appointments (date, time, status, queue_number)
    """
    appts = await appointment_service.get_patient_appointments(patient_phone)
    if not appts:
        return {
            "success": True,
            "patient_phone": patient_phone,
            "appointments": [],
            "message": f"لا توجد أي حجوزات مسجلة برقم الهاتف {patient_phone} حالياً."
        }

    return {
        "success": True,
        "patient_phone": patient_phone,
        "appointments": appts,
        "total": len(appts),
        "message": f"تم العثور على {len(appts)} حجز مسجل برقمك."
    }


@tool
async def cancel_appointment(
    patient_phone: Optional[str] = None,
    appointment_id: Optional[str] = None,
    date_str: Optional[str] = None,
    doctor_id: str = "default-doctor",
    clinic_id: str = "default-clinic",
    reason: Optional[str] = None,
) -> dict:
    """Cancel an existing appointment and free up the time slot for other patients.

    Args:
        patient_phone: Patient's phone number
        appointment_id: UUID of the appointment to cancel
        date_str: Optional appointment date
        doctor_id: UUID of the doctor
        clinic_id: UUID of the clinic
        reason: Optional cancellation reason

    Returns:
        Dict with cancellation confirmation
    """
    return await appointment_service.cancel_appointment(
        appointment_id=appointment_id,
        patient_phone=patient_phone,
        date_str=date_str,
        doctor_id=doctor_id,
        clinic_id=clinic_id,
        reason=reason,
    )


@tool
async def reschedule_appointment(
    patient_phone: str,
    new_date: str,
    new_time: str,
    appointment_id: Optional[str] = None,
    old_date: Optional[str] = None,
    doctor_id: str = "default-doctor",
    clinic_id: str = "default-clinic",
) -> dict:
    """Reschedule an existing appointment to a new date and time slot.
    Frees the old slot and books the new slot atomically.

    Args:
        patient_phone: Patient's phone number
        new_date: New date in YYYY-MM-DD format
        new_time: New time in HH:MM format
        appointment_id: UUID of the appointment to reschedule
        old_date: Original appointment date
        doctor_id: UUID of the doctor
        clinic_id: UUID of the clinic

    Returns:
        Dict with new appointment details and confirmation
    """
    return await appointment_service.reschedule_appointment(
        patient_phone=patient_phone,
        new_date=new_date,
        new_time=new_time,
        appointment_id=appointment_id,
        old_date=old_date,
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )


@tool
async def get_queue_position(
    patient_phone: str,
    date_str: Optional[str] = None,
    appointment_id: Optional[str] = None,
    doctor_id: str = "default-doctor",
    clinic_id: str = "default-clinic",
) -> dict:
    """Get patient's current position and estimated waiting time in the live queue.
    If the appointment is for a future date (not today), explains that the live queue is for today only.

    Args:
        patient_phone: Patient's phone number
        date_str: Optional Date in YYYY-MM-DD format (defaults to today)
        appointment_id: Optional UUID of the appointment
        doctor_id: UUID of the doctor
        clinic_id: UUID of the clinic

    Returns:
        Dict with queue_number, current_serving, patients_ahead, estimated_wait_minutes
    """
    target_appt_id = appointment_id
    today_str = datetime.now().strftime("%Y-%m-%d")
    target_date = date_str or today_str
    appt_details = None

    if not target_appt_id:
        appts = await appointment_service.get_patient_appointments(patient_phone)
        active = [a for a in appts if a.get("status") == "scheduled"]
        if active:
            # Check if there is an appointment today
            today_appts = [a for a in active if a.get("date") == today_str]
            if today_appts:
                target_appt_id = today_appts[-1]["id"]
                target_date = today_str
                appt_details = today_appts[-1]
            else:
                # Active appointment is on a future date!
                next_appt = active[0]
                return {
                    "success": True,
                    "is_today": False,
                    "appointment_date": next_appt.get("date"),
                    "appointment_time": next_appt.get("time"),
                    "queue_number": next_appt.get("queue_number"),
                    "message": f"موعدك القادم مسجل ليوم {next_appt.get('date')} الساعة {next_appt.get('time')} ورقمك في الطابور هو {next_appt.get('queue_number')}. سيبدأ الطابور المباشر لحجزك في يوم الكشف المحدد وليس اليوم.",
                }

    if not target_appt_id:
        return {
            "success": False,
            "message": f"مش لاقي حجز نشط برقم التليفون {patient_phone}. تأكد إن عندك حجز اليوم أو اطلب حجز موعد جديد.",
        }

    # If target_date is not today, inform clearly
    if target_date != today_str:
        return {
            "success": True,
            "is_today": False,
            "appointment_date": target_date,
            "message": f"موعدك مسجل ليوم {target_date} (وليس اليوم). الطابور المباشر يعمل فقط في يوم الكشف المحدد.",
        }

    result = await redis_service.get_queue_position(
        clinic_id=clinic_id,
        doctor_id=doctor_id,
        date=target_date,
        appointment_id=target_appt_id,
    )

    if "error" in result:
        return {
            "success": False,
            "message": "مش لاقي حجزك في الطابور حالياً. تأكد من موعدك.",
        }

    patients_ahead = result.get("patients_ahead", 0)
    if patients_ahead == 0:
        message = f"🎉 دورك دلوقتي (رقم {result.get('queue_number')})! تفضل بالدخول للطبيب."
    elif patients_ahead == 1:
        message = f"أنت رقم {result.get('queue_number')} في الطابور، وفاضلك مريض واحد فقط. متوقع الانتظار حوالي {result.get('estimated_wait_minutes')} دقيقة."
    else:
        message = (
            f"أنت رقم {result.get('queue_number')} في الطابور.\n"
            f"دلوقتي الطبيب مع المريض رقم {result.get('current_serving')}.\n"
            f"فاضل قبلك {patients_ahead} مرضى.\n"
            f"الوقت المتوقع للانتظار: حوالي {result.get('estimated_wait_minutes')} دقيقة (بناءً على متوسط الكشف الفعلي {result.get('avg_consultation_minutes')} دقيقة)."
        )

    return {
        "success": True,
        **result,
        "message": message,
    }


BOOKING_TOOLS = [
    check_availability,
    create_appointment,
    get_my_appointments,
    cancel_appointment,
    reschedule_appointment,
    get_queue_position,
]
