"""
Appointment Service — Manages scheduling, slot isolation, booking validation,
cancellation, and rescheduling. Enforces single-slot uniqueness and strict double-booking prevention.
"""

from datetime import datetime, timedelta
import json
import uuid
from typing import Optional
import logging

from app.services.redis_client import redis_service
from app.services.locking import lock_service
from app.core.arabic_nlp import parse_arabic_time

logger = logging.getLogger(__name__)

# Clinic Schedule Config
CLINIC_OPEN_HOUR = 9
CLINIC_CLOSE_HOUR = 17
WEEKLY_OFF_DAY = 4 # 4 = Friday (0=Monday, 6=Sunday)


def normalize_time(time_str: str) -> str:
    """Normalize input time string to HH:MM (24-hour format)."""
    t = time_str.strip().lower()
    # Try dialect parsing first
    parsed_dialect = parse_arabic_time(t)
    if parsed_dialect:
        return parsed_dialect

    for fmt in ("%H:%M", "%I:%M %p", "%I:%M%p", "%H:%M:%S", "%I %p", "%I%p", "%H"):
        try:
            dt = datetime.strptime(t, fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            pass
    return time_str


class AppointmentService:
    """Manages slot allocation, booking, cancellation, and prevents double-booking."""

    def _slot_key(self, doctor_id: str, date: str, time: str) -> str:
        return f"slot_booked:{doctor_id}:{date}:{time}"

    def _doctor_date_slots_key(self, doctor_id: str, date: str) -> str:
        return f"doctor_slots:{doctor_id}:{date}"

    def _patient_appointments_key(self, patient_phone: str) -> str:
        return f"patient_appts:{patient_phone}"

    def _appointment_key(self, appointment_id: str) -> str:
        return f"appointment:{appointment_id}"

    async def get_available_slots(
        self,
        doctor_id: str,
        date_str: str,
        clinic_id: str = "default-clinic",
        time_range: Optional[str] = None,
    ) -> dict:
        """
        Return available slots for a doctor on a specific date.
        Strictly excludes:
        - Past dates
        - Past times on today
        - Friday / Weekly Off-days
        - Already booked slots
        """
        date_str = date_str.strip()
        now = datetime.now()

        try:
            req_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return {
                "success": False,
                "error": "invalid_date",
                "message": f"صيغة التاريخ غير صحيحة ({date_str}). يرجى استخدام صيغة YYYY-MM-DD.",
                "available_slots": [],
            }

        # 1. Past Date Rejection
        if req_date < now.date():
            return {
                "success": False,
                "error": "past_date",
                "message": f"عفواً، لا يمكن فحص مواعيد في تاريخ ماضٍ ({date_str}). المواعيد متاحة ابتداءً من اليوم.",
                "available_slots": [],
            }

        # 2. Weekly Off-Day (Friday) Check
        if req_date.weekday() == WEEKLY_OFF_DAY:
            next_working_day = (req_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return {
                "success": False,
                "error": "off_day",
                "message": f"العيادة في إجازة أسبوعية رسمية يوم الجمعة ({date_str}). أول يوم عمل متاح هو السبت ({next_working_day}).",
                "available_slots": [],
            }

        # 3. Get already booked slots for this doctor & date
        booked_times_raw = await redis_service.client.smembers(self._doctor_date_slots_key(doctor_id, date_str))
        if isinstance(booked_times_raw, set):
            booked_times = booked_times_raw
        elif isinstance(booked_times_raw, (list, tuple)):
            booked_times = set(booked_times_raw)
        else:
            booked_times = set()

        # 4. Working hours filter
        start_hour = CLINIC_OPEN_HOUR
        end_hour = CLINIC_CLOSE_HOUR
        if time_range == "morning":
            end_hour = 12
        elif time_range == "afternoon":
            start_hour = 12

        all_slots = []
        current = datetime.strptime(f"{date_str} {start_hour:02d}:00", "%Y-%m-%d %H:%M")
        end = datetime.strptime(f"{date_str} {end_hour:02d}:00", "%Y-%m-%d %H:%M")

        while current < end:
            slot_time = current.strftime("%H:%M")
            is_locked = await redis_service.client.exists(f"lock:slot:{doctor_id}:{date_str}:{slot_time}")

            # If requesting today, exclude slots that have already passed
            is_past_today = False
            if req_date == now.date() and current.time() <= now.time():
                is_past_today = True

            if slot_time not in booked_times and not is_locked and not is_past_today:
                all_slots.append({
                    "time": slot_time,
                    "formatted": current.strftime("%I:%M %p"),
                    "available": True,
                })
            current += timedelta(minutes=30)

        return {
            "success": True,
            "doctor_id": doctor_id,
            "date": date_str,
            "available_slots": all_slots,
            "total_available": len(all_slots),
            "message": f"المتاح يوم {date_str} هو {len(all_slots)} موعد." if all_slots else f"للأسف كل المواعيد محجوزة يوم {date_str} بالكامل.",
        }

    async def book_appointment(
        self,
        patient_phone: str,
        date_str: str,
        time_str: str,
        doctor_id: str = "default-doctor",
        clinic_id: str = "default-clinic",
        patient_id: str = "default-patient",
        notes: Optional[str] = None,
    ) -> dict:
        """
        Atomically book an appointment slot with full enterprise validations:
        - Past date & past time rejection
        - Off-day rejection
        - Out-of-hours rejection
        - Double-booking prevention
        """
        # Clean & normalize inputs
        time_str = normalize_time(time_str)
        date_str = date_str.strip()
        now = datetime.now()

        # 1. Parse date and validate
        try:
            req_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return {
                "success": False,
                "error": "invalid_date",
                "message": f"صيغة التاريخ غير صحيحة ({date_str}). يرجى استخدام صيغة YYYY-MM-DD.",
            }

        if req_date < now.date():
            return {
                "success": False,
                "error": "past_date",
                "message": f"عفواً، لا يمكن حجز موعد في تاريخ ماضٍ ({date_str}). يرجى اختيار موعد قادم ابتداءً من اليوم.",
            }

        # 2. Check Friday / Off-day
        if req_date.weekday() == WEEKLY_OFF_DAY:
            next_working_day = (req_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return {
                "success": False,
                "error": "off_day",
                "message": f"العيادة في إجازة أسبوعية رسمية يوم الجمعة ({date_str}). أقرب يوم عمل متاح هو السبت ({next_working_day}).",
            }

        # 3. Validate working hours
        try:
            hour = int(time_str.split(":")[0])
            minute = int(time_str.split(":")[1]) if ":" in time_str else 0
            if hour < CLINIC_OPEN_HOUR or (hour >= CLINIC_CLOSE_HOUR and minute > 0) or hour > CLINIC_CLOSE_HOUR:
                return {
                    "success": False,
                    "error": "outside_working_hours",
                    "message": f"عفواً، مواعيد العمل بالعيادة من 09:00 صباحاً حتى 05:00 مساءً فقط. الموعد {time_str} خارج أوقات العمل الرسمية.",
                }
        except Exception:
            pass

        # 4. Check if past time on today
        if req_date == now.date():
            try:
                req_time = datetime.strptime(time_str, "%H:%M").time()
                if req_time <= now.time():
                    return {
                        "success": False,
                        "error": "past_time",
                        "message": f"عفواً، الموعد الساعة {time_str} قد فات بالفعل اليوم ({now.strftime('%I:%M %p')}). يرجى اختيار موعد قادم.",
                    }
            except Exception:
                pass

        # 5. Anti-Abuse / Spam Prevention: Single active appointment per patient per day
        existing_appts = await self.get_patient_appointments(patient_phone)
        for a in existing_appts:
            if a.get("status") == "scheduled" and a.get("date") == date_str and a.get("doctor_id") == doctor_id:
                return {
                    "success": False,
                    "error": "already_booked_today",
                    "message": f"لديك حجز نشط بالفعل يوم {date_str} الساعة {a.get('time')}. لا يمكن حجز أكثر من موعد في نفس اليوم لنفس المريض. يمكنك تعديل موعدك الحالي إذا أردت.",
                    "existing_appointment": a,
                }

        # 6. Acquire distributed lock (fast-fail for concurrent race conditions)
        lock_acquired = await lock_service.acquire_slot_lock(doctor_id, date_str, time_str, ttl_seconds=15)
        if not lock_acquired:
            return {
                "success": False,
                "error": "slot_taken",
                "message": f"عفواً، الموعد الساعة {time_str} يوم {date_str} جاري حجزه حالياً من مريض آخر. يرجى اختيار موعد آخر.",
            }

        try:
            # 6. Strict Check: Is this slot already booked?
            is_booked = await redis_service.client.sismember(
                self._doctor_date_slots_key(doctor_id, date_str),
                time_str
            )
            if is_booked:
                return {
                    "success": False,
                    "error": "slot_taken",
                    "message": f"عفواً، الموعد الساعة {time_str} يوم {date_str} محجوز بالفعل! يرجى اختيار موعد متاح آخر.",
                }

            # 7. Create appointment record
            appointment_id = str(uuid.uuid4())
            queue_number = await redis_service.get_next_queue_number(clinic_id, doctor_id, date_str)

            appt_data = {
                "id": appointment_id,
                "patient_phone": patient_phone,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "clinic_id": clinic_id,
                "date": date_str,
                "time": time_str,
                "status": "scheduled",
                "queue_number": queue_number,
                "notes": notes or "",
                "created_at": datetime.now().isoformat(),
            }

            # 8. Save appointment & mark slot as permanently booked
            await redis_service.client.set(self._appointment_key(appointment_id), json.dumps(appt_data))
            await redis_service.client.sadd(self._doctor_date_slots_key(doctor_id, date_str), time_str)
            await redis_service.client.set(self._slot_key(doctor_id, date_str, time_str), appointment_id)
            await redis_service.client.sadd(self._patient_appointments_key(patient_phone), appointment_id)

            # 9. Add to live queue
            await redis_service.add_to_queue(clinic_id, doctor_id, date_str, appointment_id, queue_number)

            logger.info(f"Appointment booked: {appointment_id} for {patient_phone} at {date_str} {time_str} (Queue #{queue_number})")

            return {
                "success": True,
                "appointment_id": appointment_id,
                "queue_number": queue_number,
                "doctor_id": doctor_id,
                "date": date_str,
                "time": time_str,
                "message": f"تم الحجز بنجاح ✅ يوم {date_str} الساعة {time_str}. رقمك في الطابور: {queue_number}",
            }
        finally:
            await lock_service.release_slot_lock(doctor_id, date_str, time_str)

    async def cancel_appointment(
        self,
        appointment_id: Optional[str] = None,
        patient_phone: Optional[str] = None,
        date_str: Optional[str] = None,
        doctor_id: str = "default-doctor",
        clinic_id: str = "default-clinic",
        reason: Optional[str] = None,
    ) -> dict:
        """Cancel appointment and free up the time slot."""
        target_appt = None

        if appointment_id:
            raw = await redis_service.client.get(self._appointment_key(appointment_id))
            if raw:
                target_appt = json.loads(raw)
        elif patient_phone:
            appts = await self.get_patient_appointments(patient_phone)
            active = [a for a in appts if a.get("status") == "scheduled"]
            if date_str:
                active = [a for a in active if a.get("date") == date_str]
            if active:
                target_appt = active[-1]

        if not target_appt:
            return {
                "success": False,
                "error": "not_found",
                "message": "لم يتم العثور على موعد محجوز لإلغائه.",
            }

        # Strict Ownership Check: Cannot cancel another patient's appointment
        if patient_phone and target_appt.get("patient_phone") != patient_phone:
            return {
                "success": False,
                "error": "unauthorized",
                "message": "غير مصرح لك بإلغاء موعد لا يخص رقم هاتفك المسجل.",
            }

        appt_id = target_appt["id"]
        appt_date = target_appt["date"]
        appt_time = target_appt["time"]
        doc_id = target_appt.get("doctor_id", doctor_id)
        cl_id = target_appt.get("clinic_id", clinic_id)
        phone = target_appt.get("patient_phone", patient_phone)

        # Update status
        target_appt["status"] = "cancelled"
        target_appt["cancellation_reason"] = reason or ""
        await redis_service.client.set(self._appointment_key(appt_id), json.dumps(target_appt))

        # Free the slot
        await redis_service.client.srem(self._doctor_date_slots_key(doc_id, appt_date), appt_time)
        await redis_service.client.delete(self._slot_key(doc_id, appt_date, appt_time))
        if phone:
            await redis_service.client.srem(self._patient_appointments_key(phone), appt_id)

        # Remove from queue
        await redis_service.remove_from_queue(cl_id, doc_id, appt_date, appt_id)

        logger.info(f"Appointment cancelled: {appt_id} slot freed: {appt_date} {appt_time}")

        return {
            "success": True,
            "appointment_id": appt_id,
            "message": f"تم إلغاء موعد يوم {appt_date} الساعة {appt_time} بنجاح والموعد أصبح متاحاً الآن ❌",
        }

    async def reschedule_appointment(
        self,
        patient_phone: str,
        new_date: str,
        new_time: str,
        appointment_id: Optional[str] = None,
        old_date: Optional[str] = None,
        doctor_id: str = "default-doctor",
        clinic_id: str = "default-clinic",
    ) -> dict:
        """Reschedule an existing appointment to a new date/time slot."""
        new_time = normalize_time(new_time)
        new_date = new_date.strip()

        # 1. Check if new slot is already booked
        is_booked = await redis_service.client.sismember(
            self._doctor_date_slots_key(doctor_id, new_date),
            new_time
        )
        if is_booked:
            return {
                "success": False,
                "error": "slot_taken",
                "message": f"عفواً، الموعد الجديد الساعة {new_time} يوم {new_date} محجوز بالفعل لمريض آخر. يرجى اختيار موعد آخر.",
            }

        # 2. Cancel old appointment
        cancel_res = await self.cancel_appointment(
            appointment_id=appointment_id,
            patient_phone=patient_phone,
            date_str=old_date,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            reason="تعديل الموعد"
        )
        if not cancel_res.get("success"):
            return cancel_res

        # 3. Book new slot
        book_res = await self.book_appointment(
            patient_phone=patient_phone,
            date_str=new_date,
            time_str=new_time,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
        )
        if book_res.get("success"):
            book_res["message"] = f"تم تعديل موعدك بنجاح ✅ الموعد الجديد: يوم {new_date} الساعة {new_time}. رقمك الجديد في الطابور: {book_res.get('queue_number')}"

        return book_res

    async def get_patient_appointments(self, patient_phone: str) -> list[dict]:
        """Get all appointments for a patient."""
        appt_ids_raw = await redis_service.client.smembers(self._patient_appointments_key(patient_phone))
        if isinstance(appt_ids_raw, set):
            appt_ids = list(appt_ids_raw)
        elif isinstance(appt_ids_raw, (list, tuple)):
            appt_ids = list(appt_ids_raw)
        else:
            appt_ids = []

        results = []
        for aid in appt_ids:
            raw = await redis_service.client.get(self._appointment_key(aid))
            if raw:
                try:
                    results.append(json.loads(raw))
                except Exception:
                    pass
        return sorted(results, key=lambda x: (x.get("date", ""), x.get("time", "")))


appointment_service = AppointmentService()
