"""
Demo data — fills today and the next two weeks with a realistic clinic day so the
dashboard and reception screens can be shown without real patients.
Writes records directly (bypassing "no past slots" validation) on purpose.
"""

import json
import random
import uuid
from datetime import datetime, timedelta

from app.core.clock import clinic_now
from app.services.appointment_service import (
    appointment_service,
    calculate_slot_queue_number,
    CLINIC_OPEN_HOUR,
    LAST_SLOT_HOUR,
    LAST_SLOT_MINUTE,
    SLOT_DURATION_MINUTES,
    WEEKLY_OFF_DAY,
)
from app.services.redis_client import redis_service

DOCTOR_ID = "default-doctor"
CLINIC_ID = "default-clinic"

NAMES = [
    "أحمد محمد", "سارة علي", "محمود حسن", "منى إبراهيم", "يوسف عادل", "نورا خالد",
    "كريم سامي", "هبة مصطفى", "عمر طارق", "ياسمين فؤاد", "مصطفى رضا", "دينا أشرف",
    "خالد عبدالله", "ريم مجدي", "طارق نبيل", "آية حسام", "إسلام فتحي", "مريم وائل",
]


def _day_slots() -> list[str]:
    slots, t = [], datetime(2000, 1, 1, CLINIC_OPEN_HOUR, 0)
    end = datetime(2000, 1, 1, LAST_SLOT_HOUR, LAST_SLOT_MINUTE)
    while t <= end:
        slots.append(t.strftime("%H:%M"))
        t += timedelta(minutes=SLOT_DURATION_MINUTES)
    return slots


async def _store(appt: dict) -> None:
    client = redis_service.client
    await client.set(f"appointment:{appt['id']}", json.dumps(appt, ensure_ascii=False))
    await client.set(f"ref_code:{appt['reference_code']}", appt["id"])
    await client.set(f"ref_code:{appt['id'][:4].upper()}", appt["id"])
    await client.sadd(f"appts_by_date:{appt['date']}", appt["id"])
    await client.zadd(appointment_service.RECENT_BOOKINGS_KEY, {appt["id"]: datetime.fromisoformat(appt["created_at"]).timestamp()})
    if appt["status"] != "cancelled":
        await client.sadd(f"doctor_slots:{DOCTOR_ID}:{appt['date']}", appt["time"])
        await client.set(f"slot_booked:{DOCTOR_ID}:{appt['date']}:{appt['time']}", appt["id"])
        await client.sadd(f"patient_appts:{appt['patient_phone']}", appt["id"])
    if appt["status"] in ("scheduled", "checked_in", "in_progress"):
        await redis_service.add_to_queue(CLINIC_ID, DOCTOR_ID, appt["date"], appt["id"], appt["queue_number"])


def _make(rng: random.Random, date_str: str, time_str: str, name: str, status: str, created_at: datetime) -> dict:
    appt_id = str(uuid.uuid4())
    return {
        "id": appt_id,
        "reference_code": f"REF-{appt_id[:4].upper()}",
        "patient_phone": "01" + rng.choice("0125") + "".join(rng.choices("0123456789", k=8)),
        "patient_name": name,
        "patient_id": "default-patient",
        "doctor_id": DOCTOR_ID,
        "clinic_id": CLINIC_ID,
        "date": date_str,
        "time": time_str,
        "status": status,
        "queue_number": calculate_slot_queue_number(time_str),
        "notes": "",
        "source": rng.choice(["ai_chat", "ai_chat", "ai_chat", "reception"]),
        "created_at": created_at.isoformat(),
    }


async def seed_demo_data(as_of: str | None = None) -> dict:
    """`as_of` (HH:MM) lays out today as if it were that time — handy for demos after hours."""
    await appointment_service.clear_all_data()
    rng = random.Random(42)
    now = clinic_now()
    today = now.strftime("%Y-%m-%d")
    slots = _day_slots()
    names = NAMES[:]
    rng.shuffle(names)
    created = 0

    # --- Today: a realistic flow around the current time ---
    if now.weekday() != WEEKLY_OFF_DAY:
        todays_slots = [s for s in slots if rng.random() < 0.75]
        cutoff = as_of or now.strftime("%H:%M")
        past = [s for s in todays_slots if s <= cutoff]
        future = [s for s in todays_slots if s > cutoff]
        durations = []

        for i, slot in enumerate(past):
            slot_dt = datetime.strptime(f"{today} {slot}", "%Y-%m-%d %H:%M")
            appt = _make(rng, today, slot, names[i % len(names)], "completed", slot_dt - timedelta(days=rng.randint(1, 6), hours=rng.randint(0, 8)))
            if i == len(past) - 1:
                appt["status"] = "in_progress"
                appt["checked_in_at"] = (now - timedelta(minutes=25)).isoformat()
                appt["started_at"] = (now - timedelta(minutes=8)).isoformat()
            elif i == 2:
                appt["status"] = "no_show"
            elif i == 4:
                appt["status"] = "cancelled"
            else:
                duration = rng.randint(12, 28)
                durations.append(duration)
                appt["checked_in_at"] = (slot_dt - timedelta(minutes=10)).isoformat()
                appt["started_at"] = slot_dt.isoformat()
                appt["completed_at"] = (slot_dt + timedelta(minutes=duration)).isoformat()
                appt["duration_minutes"] = duration
            await _store(appt)
            created += 1

        for j, slot in enumerate(future):
            status = "checked_in" if j < 2 else "scheduled"
            appt = _make(rng, today, slot, names[(len(past) + j) % len(names)], status, now - timedelta(hours=rng.randint(1, 30)))
            if status == "checked_in":
                appt["checked_in_at"] = (now - timedelta(minutes=rng.randint(3, 20))).isoformat()
            await _store(appt)
            created += 1

        if past:
            await redis_service.update_current_serving(CLINIC_ID, DOCTOR_ID, today, calculate_slot_queue_number(past[-1]))
        for d in durations[-20:]:
            await redis_service.update_avg_time(CLINIC_ID, DOCTOR_ID, d)

    # --- Next 13 days: bookings thinning out further ahead ---
    for offset in range(1, 14):
        day = now + timedelta(days=offset)
        if day.weekday() == WEEKLY_OFF_DAY:
            continue
        fill = max(0.12, 0.8 - offset * 0.06)
        date_str = day.strftime("%Y-%m-%d")
        for k, slot in enumerate(s for s in slots if rng.random() < fill):
            booked_at = now - timedelta(hours=rng.randint(0, 72), minutes=rng.randint(0, 59))
            await _store(_make(rng, date_str, slot, names[(offset * 3 + k) % len(names)], "scheduled", booked_at))
            created += 1

    return {"success": True, "created": created, "message": f"تم إنشاء {created} حجز تجريبي."}
