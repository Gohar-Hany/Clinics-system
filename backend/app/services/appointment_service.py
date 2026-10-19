"""
Appointment Service — Manages scheduling, slot isolation, booking validation,
cancellation, rescheduling and the visit lifecycle (arrival → consultation → done).
Enforces single-slot uniqueness and strict double-booking prevention.
"""

from datetime import datetime, timedelta
import json
import uuid
from typing import Optional
import logging

from app.services.redis_client import redis_service
from app.services.locking import lock_service
from app.core.arabic_nlp import parse_arabic_time
from app.core.clock import clinic_now

logger = logging.getLogger(__name__)

# Clinic Schedule Config
CLINIC_OPEN_HOUR = 9
CLINIC_CLOSE_HOUR = 17
SLOT_DURATION_MINUTES = 30
LAST_SLOT_HOUR = 16
LAST_SLOT_MINUTE = 30
WEEKLY_OFF_DAY = 4  # 4 = Friday (0=Monday, 6=Sunday)
SLOTS_PER_DAY = ((LAST_SLOT_HOUR - CLINIC_OPEN_HOUR) * 60 + LAST_SLOT_MINUTE) // SLOT_DURATION_MINUTES + 1

ACTIVE_STATUSES = ("scheduled", "checked_in", "in_progress")

WEEKDAYS_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]


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


def calculate_slot_queue_number(time_str: str) -> int:
    """
    Calculate the chronological queue ticket number for a slot based on clinic opening time (09:00 AM).
    09:00 -> Ticket #1
    09:30 -> Ticket #2
    10:00 -> Ticket #3
    ...
    16:30 -> Ticket #16
    """
    try:
        parts = time_str.split(":")
        h, m = int(parts[0]), int(parts[1])
        total_minutes = (h - CLINIC_OPEN_HOUR) * 60 + m
        if total_minutes < 0:
            return 1
        slot_index = (total_minutes // SLOT_DURATION_MINUTES) + 1
        return max(1, slot_index)
    except Exception:
        return 1


def format_time_ar(time_str: str) -> str:
    """'14:30' -> '2:30 مساءً' (what patients actually say and read)."""
    try:
        t = datetime.strptime(time_str, "%H:%M")
    except ValueError:
        return time_str
    suffix = "صباحاً" if t.hour < 12 else "مساءً"
    return f"{t.hour % 12 or 12}:{t.minute:02d} {suffix}"


def format_date_ar(date_str: str) -> str:
    """'2026-10-20' -> 'الثلاثاء 20/10'."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return date_str
    return f"{WEEKDAYS_AR[d.weekday()]} {d.day}/{d.month}"


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

    def _date_index_key(self, date: str) -> str:
        return f"appts_by_date:{date}"

    RECENT_BOOKINGS_KEY = "appts_recent"

    # ╔══════════════════════════════════════════╗
    # ║        Slot validation & availability    ║
    # ╚══════════════════════════════════════════╝

    def _validate_slot(self, date_str: str, time_str: str) -> Optional[dict]:
        """Return an error payload if the slot can never be booked, else None."""
        now = clinic_now()

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

        if req_date.weekday() == WEEKLY_OFF_DAY:
            next_working_day = (req_date + timedelta(days=1)).strftime("%Y-%m-%d")
            return {
                "success": False,
                "error": "off_day",
                "message": f"العيادة في إجازة أسبوعية رسمية يوم الجمعة ({date_str}). أقرب يوم عمل متاح هو السبت ({next_working_day}).",
            }

        try:
            parts = time_str.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
        except Exception:
            return {
                "success": False,
                "error": "invalid_time_format",
                "message": f"صيغة الوقت غير صحيحة ({time_str}). يرجى استخدام صيغة 24 ساعة (مثال: 09:30 أو 14:00).",
            }

        # Reject before 09:00 or after 16:30 (Clinic closes at 17:00; last consultation starts 16:30)
        if (hour < CLINIC_OPEN_HOUR) or (hour > LAST_SLOT_HOUR) or (hour == LAST_SLOT_HOUR and minute > LAST_SLOT_MINUTE):
            return {
                "success": False,
                "error": "outside_working_hours",
                "message": f"عفواً، مواعيد العمل بالعيادة من 09:00 صباحاً حتى 05:00 مساءً فقط (آخر موعد كشف متاح يبدأ 04:30 مساءً). الموعد {time_str} خارج أوقات العمل الرسمية.",
            }

        if minute not in (0, 30):
            return {
                "success": False,
                "error": "invalid_slot_time",
                "message": f"عفواً، المواعيد بالعيادة تبدأ على رأس النصف ساعة (مثل: {hour:02d}:00 أو {hour:02d}:30). الموعد {time_str} غير متوافق مع جدول الكشوفات.",
            }

        if req_date == now.date():
            req_time = datetime.strptime(f"{hour:02d}:{minute:02d}", "%H:%M").time()
            if req_time <= now.time():
                return {
                    "success": False,
                    "error": "past_time",
                    "message": f"عفواً، الموعد الساعة {time_str} قد فات بالفعل اليوم ({now.strftime('%I:%M %p')}). يرجى اختيار موعد قادم.",
                }

        return None

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
        now = clinic_now()

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
        booked_times = set(await redis_service.client.smembers(self._doctor_date_slots_key(doctor_id, date_str)) or [])

        # 4. Working hours filter
        start_hour = CLINIC_OPEN_HOUR
        end_hour = LAST_SLOT_HOUR
        end_minute = LAST_SLOT_MINUTE

        if time_range == "morning":
            end_hour = 11
            end_minute = 30
        elif time_range == "afternoon":
            start_hour = 12

        all_slots = []
        current = datetime.strptime(f"{date_str} {start_hour:02d}:00", "%Y-%m-%d %H:%M")
        end = datetime.strptime(f"{date_str} {end_hour:02d}:{end_minute:02d}", "%Y-%m-%d %H:%M")

        while current <= end:
            slot_time = current.strftime("%H:%M")
            is_locked = await redis_service.client.exists(f"lock:slot:{doctor_id}:{date_str}:{slot_time}")

            # If requesting today, exclude slots that have already passed
            is_past_today = req_date == now.date() and current.time() <= now.time()

            if slot_time not in booked_times and not is_locked and not is_past_today:
                all_slots.append({
                    "time": slot_time,
                    "formatted": format_time_ar(slot_time),
                    "queue_number": calculate_slot_queue_number(slot_time),
                    "available": True,
                })
            current += timedelta(minutes=SLOT_DURATION_MINUTES)

        return {
            "success": True,
            "doctor_id": doctor_id,
            "date": date_str,
            "day_label": format_date_ar(date_str),
            "available_slots": all_slots,
            "total_available": len(all_slots),
            "message": f"المتاح يوم {date_str} هو {len(all_slots)} موعد." if all_slots else f"للأسف كل المواعيد محجوزة يوم {date_str} بالكامل.",
        }

    # ╔══════════════════════════════════════════╗
    # ║        Booking / Cancel / Reschedule     ║
    # ╚══════════════════════════════════════════╝

    async def book_appointment(
        self,
        patient_phone: str,
        date_str: str,
        time_str: str,
        doctor_id: str = "default-doctor",
        clinic_id: str = "default-clinic",
        patient_id: str = "default-patient",
        notes: Optional[str] = None,
        patient_name: Optional[str] = None,
        source: str = "ai_chat",
    ) -> dict:
        """
        Atomically book an appointment slot with full enterprise validations:
        - Past date & past time rejection
        - Off-day rejection
        - Out-of-hours & last-slot rejection
        - Slot alignment validation
        - Double-booking prevention
        - Chronological queue number assignment
        """
        # Clean & normalize inputs
        time_str = normalize_time(time_str)
        date_str = date_str.strip()

        # 1-4. Date, off-day, working hours, slot alignment, past time
        invalid = self._validate_slot(date_str, time_str)
        if invalid:
            return invalid

        # 5. Anti-Abuse / Spam Prevention: Single active appointment per patient per day
        existing_appts = await self.get_patient_appointments(patient_phone)
        for a in existing_appts:
            if a.get("status") in ACTIVE_STATUSES and a.get("date") == date_str and a.get("doctor_id") == doctor_id:
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
            # 7. Strict Check: Is this slot already booked?
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

            # 8. Create appointment record with chronological queue ticket number
            appointment_id = str(uuid.uuid4())
            queue_number = calculate_slot_queue_number(time_str)
            created_at = clinic_now()

            ref_code = f"REF-{appointment_id[:4].upper()}"
            appt_data = {
                "id": appointment_id,
                "reference_code": ref_code,
                "patient_phone": patient_phone,
                "patient_name": (patient_name or "").strip(),
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "clinic_id": clinic_id,
                "date": date_str,
                "time": time_str,
                "status": "scheduled",
                "queue_number": queue_number,
                "notes": notes or "",
                "source": source,
                "created_at": created_at.isoformat(),
            }

            # 9. Save appointment & mark slot as permanently booked
            await redis_service.client.set(self._appointment_key(appointment_id), json.dumps(appt_data, ensure_ascii=False))
            await redis_service.client.set(f"ref_code:{appointment_id[:4].upper()}", appointment_id)
            await redis_service.client.set(f"ref_code:{ref_code}", appointment_id)
            await redis_service.client.sadd(self._doctor_date_slots_key(doctor_id, date_str), time_str)
            await redis_service.client.set(self._slot_key(doctor_id, date_str, time_str), appointment_id)
            await redis_service.client.sadd(self._patient_appointments_key(patient_phone), appointment_id)
            await redis_service.client.sadd(self._date_index_key(date_str), appointment_id)
            await redis_service.client.zadd(self.RECENT_BOOKINGS_KEY, {appointment_id: created_at.timestamp()})

            # 10. Add to live queue with slot chronological queue score
            await redis_service.add_to_queue(clinic_id, doctor_id, date_str, appointment_id, queue_number)

            logger.info(f"Appointment booked: {appointment_id} ({ref_code}) for {patient_phone} at {date_str} {time_str} (Queue Ticket #{queue_number})")

            return {
                "success": True,
                "appointment_id": appointment_id,
                "reference_code": ref_code,
                "queue_number": queue_number,
                "doctor_id": doctor_id,
                "patient_name": appt_data["patient_name"],
                "patient_phone": patient_phone,
                "date": date_str,
                "time": time_str,
                "day_label": format_date_ar(date_str),
                "time_label": format_time_ar(time_str),
                "message": f"تم الحجز بنجاح ✅ يوم {date_str} الساعة {time_str}. رقمك في الطابور: #{queue_number} (كود الحجز: {ref_code})",
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
            target_appt = await self.get_appointment(appointment_id)
        elif patient_phone:
            appts = await self.get_patient_appointments(patient_phone)
            active = [a for a in appts if a.get("status") == "scheduled"]
            if date_str:
                active = [a for a in active if a.get("date") == date_str]
            if active:
                target_appt = active[-1]

        if not target_appt or target_appt.get("status") == "cancelled":
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
        target_appt["cancelled_at"] = clinic_now().isoformat()
        await self._save(target_appt)

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
            "date": appt_date,
            "time": appt_time,
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
        """Reschedule an existing appointment to a new date/time slot atomically."""
        new_time = normalize_time(new_time)
        new_date = new_date.strip()

        # 1. Validate the new slot BEFORE touching the old booking, so a bad
        #    request (Friday, past time, 5 PM…) never leaves the patient with nothing.
        invalid = self._validate_slot(new_date, new_time)
        if invalid:
            return invalid

        # 2. Check if new slot is already booked
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

        # 3. Cancel old appointment safely (keep its details to carry over / restore)
        old_appt = await self.get_appointment(appointment_id) if appointment_id else None
        if not old_appt:
            active = [a for a in await self.get_patient_appointments(patient_phone) if a.get("status") == "scheduled"]
            if old_date:
                active = [a for a in active if a.get("date") == old_date]
            old_appt = active[-1] if active else None

        cancel_res = await self.cancel_appointment(
            appointment_id=old_appt["id"] if old_appt else appointment_id,
            patient_phone=patient_phone,
            date_str=old_date,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            reason="تعديل الموعد"
        )
        if not cancel_res.get("success"):
            return cancel_res

        # 4. Book new slot
        book_res = await self.book_appointment(
            patient_phone=patient_phone,
            date_str=new_date,
            time_str=new_time,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
            patient_name=old_appt.get("patient_name") if old_appt else None,
            notes=old_appt.get("notes") if old_appt else None,
            source=old_appt.get("source", "ai_chat") if old_appt else "ai_chat",
        )
        if book_res.get("success"):
            book_res["message"] = f"تم تعديل موعدك بنجاح ✅ الموعد الجديد: يوم {new_date} الساعة {new_time}. رقمك الجديد في الطابور: #{book_res.get('queue_number')}"
        elif old_appt:
            # Restore the original booking so the patient is never left without one
            await self.book_appointment(
                patient_phone=patient_phone,
                date_str=old_appt["date"],
                time_str=old_appt["time"],
                doctor_id=old_appt.get("doctor_id", doctor_id),
                clinic_id=old_appt.get("clinic_id", clinic_id),
                patient_name=old_appt.get("patient_name"),
                notes=old_appt.get("notes"),
                source=old_appt.get("source", "ai_chat"),
            )

        return book_res

    # ╔══════════════════════════════════════════╗
    # ║        Visit lifecycle (reception)       ║
    # ╚══════════════════════════════════════════╝

    async def update_status(self, appointment_id: str, action: str) -> dict:
        """
        Move an appointment through the visit lifecycle:
        check_in → start → complete, or mark no_show / cancel.
        """
        appt = await self.get_appointment(appointment_id)
        if not appt:
            return {"success": False, "error": "not_found", "message": "الحجز غير موجود."}

        status = appt.get("status")
        doc_id = appt.get("doctor_id", "default-doctor")
        cl_id = appt.get("clinic_id", "default-clinic")
        now = clinic_now()

        allowed = {
            "check_in": ("scheduled", "no_show"),
            "start": ("scheduled", "checked_in"),
            "complete": ("in_progress",),
            "no_show": ("scheduled", "checked_in"),
            "cancel": ("scheduled", "checked_in", "no_show"),
        }
        if action not in allowed:
            return {"success": False, "error": "invalid_action", "message": f"إجراء غير معروف: {action}"}
        if status not in allowed[action]:
            return {
                "success": False,
                "error": "invalid_transition",
                "message": f"لا يمكن تنفيذ هذا الإجراء على حجز حالته الحالية ({status}).",
            }

        if action == "cancel":
            return await self.cancel_appointment(appointment_id=appointment_id, reason="ألغي من الاستقبال")

        if action == "check_in":
            appt["status"] = "checked_in"
            appt["checked_in_at"] = now.isoformat()
            await redis_service.add_to_queue(cl_id, doc_id, appt["date"], appt["id"], appt["queue_number"])

        elif action == "start":
            # Only one patient can be inside with the doctor: finish whoever is in now.
            for other in await self.list_appointments(appt["date"], doctor_id=doc_id):
                if other["status"] == "in_progress" and other["id"] != appt["id"]:
                    await self.update_status(other["id"], "complete")
            appt["status"] = "in_progress"
            appt["started_at"] = now.isoformat()
            appt.setdefault("checked_in_at", now.isoformat())
            await redis_service.update_current_serving(cl_id, doc_id, appt["date"], appt["queue_number"])

        elif action == "complete":
            appt["status"] = "completed"
            appt["completed_at"] = now.isoformat()
            started = datetime.fromisoformat(appt.get("started_at", now.isoformat()))
            duration = max(1, round((now - started).total_seconds() / 60))
            appt["duration_minutes"] = duration
            await redis_service.update_avg_time(cl_id, doc_id, duration)
            await redis_service.remove_from_queue(cl_id, doc_id, appt["date"], appt["id"])

        elif action == "no_show":
            appt["status"] = "no_show"
            appt["no_show_at"] = now.isoformat()
            await redis_service.remove_from_queue(cl_id, doc_id, appt["date"], appt["id"])

        await self._save(appt)
        return {"success": True, "appointment": appt}

    # ╔══════════════════════════════════════════╗
    # ║        Queries                           ║
    # ╚══════════════════════════════════════════╝

    async def _save(self, appt: dict) -> None:
        await redis_service.client.set(self._appointment_key(appt["id"]), json.dumps(appt, ensure_ascii=False))

    async def get_appointment(self, appointment_id: str) -> Optional[dict]:
        raw = await redis_service.client.get(self._appointment_key(appointment_id))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    async def _load_many(self, appt_ids) -> list[dict]:
        results = []
        for aid in appt_ids:
            appt = await self.get_appointment(aid)
            if appt:
                results.append(appt)
        return results

    async def get_patient_appointments(self, patient_phone: str) -> list[dict]:
        """Get all appointments for a patient."""
        appt_ids = await redis_service.client.smembers(self._patient_appointments_key(patient_phone)) or []
        results = await self._load_many(appt_ids)
        return sorted(results, key=lambda x: (x.get("date", ""), x.get("time", "")))

    async def list_appointments(
        self,
        date_str: str,
        doctor_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict]:
        """All appointments for a day (cancelled included), ordered by slot time."""
        appt_ids = await redis_service.client.smembers(self._date_index_key(date_str)) or []
        appts = await self._load_many(appt_ids)
        if doctor_id:
            appts = [a for a in appts if a.get("doctor_id") == doctor_id]
        if status:
            appts = [a for a in appts if a.get("status") == status]
        return sorted(appts, key=lambda a: (a.get("time", ""), a.get("created_at", "")))

    async def get_recent_bookings(self, limit: int = 8) -> list[dict]:
        appt_ids = await redis_service.client.zrevrange(self.RECENT_BOOKINGS_KEY, 0, limit - 1)
        return await self._load_many(appt_ids)

    async def get_dashboard_overview(self, date_str: str, doctor_id: str = "default-doctor", days_ahead: int = 14) -> dict:
        """Everything the clinic dashboard needs in one call."""
        now = clinic_now()
        day = datetime.strptime(date_str, "%Y-%m-%d").date()
        appts = await self.list_appointments(date_str, doctor_id=doctor_id)

        counts = {s: 0 for s in ("scheduled", "checked_in", "in_progress", "completed", "no_show", "cancelled")}
        for a in appts:
            counts[a.get("status", "scheduled")] = counts.get(a.get("status", "scheduled"), 0) + 1
        active_total = len(appts) - counts["cancelled"]

        # Hourly load for the selected day (non-cancelled bookings)
        hourly = []
        for hour in range(CLINIC_OPEN_HOUR, LAST_SLOT_HOUR + 1):
            prefix = f"{hour:02d}:"
            hourly.append({
                "hour": f"{hour:02d}:00",
                "count": sum(1 for a in appts if a.get("time", "").startswith(prefix) and a.get("status") != "cancelled"),
            })

        # Booking volume for the coming days
        upcoming_days = []
        for i in range(days_ahead):
            d = day + timedelta(days=i)
            d_str = d.strftime("%Y-%m-%d")
            day_appts = appts if i == 0 else await self.list_appointments(d_str, doctor_id=doctor_id)
            booked = sum(1 for a in day_appts if a.get("status") != "cancelled")
            upcoming_days.append({
                "date": d_str,
                "weekday": WEEKDAYS_AR[d.weekday()],
                "is_off_day": d.weekday() == WEEKLY_OFF_DAY,
                "count": booked,
                "capacity": 0 if d.weekday() == WEEKLY_OFF_DAY else SLOTS_PER_DAY,
            })

        # Next scheduled visits from now on (today's remaining + coming days)
        upcoming_list = []
        for entry in upcoming_days:
            if entry["count"] == 0:
                continue
            for a in await self.list_appointments(entry["date"], doctor_id=doctor_id):
                if a.get("status") != "scheduled":
                    continue
                if entry["date"] == now.strftime("%Y-%m-%d") and a.get("time", "") < now.strftime("%H:%M"):
                    continue
                upcoming_list.append(a)
            if len(upcoming_list) >= 8:
                break

        recent = await self.get_recent_bookings(limit=8)
        created_today = 0
        for a in await self.get_recent_bookings(limit=200):
            if a.get("created_at", "").startswith(now.strftime("%Y-%m-%d")):
                created_today += 1

        sources = {"ai_chat": 0, "reception": 0}
        for a in appts:
            if a.get("status") != "cancelled":
                sources[a.get("source", "ai_chat")] = sources.get(a.get("source", "ai_chat"), 0) + 1

        durations = [a["duration_minutes"] for a in appts if a.get("duration_minutes")]
        avg_raw = await redis_service.client.get(f"avg_time:default-clinic:{doctor_id}")

        in_progress = next((a for a in appts if a.get("status") == "in_progress"), None)
        waiting = [a for a in appts if a.get("status") == "checked_in"]

        return {
            "date": date_str,
            "generated_at": now.isoformat(),
            "is_off_day": day.weekday() == WEEKLY_OFF_DAY,
            "counts": {**counts, "total": active_total},
            "capacity": {
                "slots_per_day": SLOTS_PER_DAY,
                "booked": active_total,
                "utilization_pct": round(100 * active_total / SLOTS_PER_DAY) if SLOTS_PER_DAY else 0,
            },
            "now_serving": in_progress,
            "waiting": waiting,
            "avg_consultation_minutes": int(avg_raw) if avg_raw else 20,
            "avg_consultation_today": round(sum(durations) / len(durations)) if durations else None,
            "new_bookings_today": created_today,
            "upcoming_7_days": sum(e["count"] for e in upcoming_days[1:8]),
            "hourly": hourly,
            "upcoming_days": upcoming_days,
            "upcoming_list": upcoming_list[:8],
            "recent_bookings": recent,
            "sources": sources,
        }

    async def clear_all_data(self) -> dict:
        """Completely reset and flush all appointment, slot, queue, and patient data."""
        try:
            client = redis_service.client
            patterns = [
                "appointment:*", "patient_appts:*", "doctor_slots:*", "slot_booked:*", "ref_code:*",
                "lock:*", "queue:*", "queue_meta:*", "time_history:*", "avg_time:*",
                "appts_by_date:*", self.RECENT_BOOKINGS_KEY,
            ]
            for p in patterns:
                keys = await client.keys(p)
                if keys:
                    await client.delete(*keys)

            logger.info("All clinic appointment and queue data successfully cleared.")
            return {"success": True, "message": "تم مسح جميع الحجوزات والبيانات السابقة بنجاح وإعادة تصفير النظام بالكامل."}
        except Exception as e:
            logger.error(f"Error clearing clinic data: {e}")
            return {"success": False, "error": str(e)}


appointment_service = AppointmentService()
