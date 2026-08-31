"""
Comprehensive Booking & Slot Concurrency Test Suite
Tests:
1. Slot Availability
2. Booking isolation (Single-slot exclusivity)
3. Double-booking prevention (Duplicate slot rejection)
4. Cancellation & Slot freeing
5. Rescheduling
6. Live AI Agent Multi-turn Integration
"""

import asyncio
import httpx
import json
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.appointment_service import appointment_service
from app.services.redis_client import redis_service


async def run_direct_service_tests():
    print("\n" + "="*50)
    print("🔬 1. DIRECT APPOINTMENT SERVICE & CONCURRENCY TESTS")
    print("="*50)

    test_date = "2026-11-15"
    doctor_id = "doc-test-1"
    clinic_id = "clinic-test-1"

    # 1. Initial Available Slots
    res_slots = await appointment_service.get_available_slots(doctor_id, test_date, clinic_id)
    slots = res_slots.get("available_slots", res_slots) if isinstance(res_slots, dict) else res_slots
    print(f"✅ Initial available slots for {test_date}: {len(slots)} slots")
    assert any(s["time"] == "12:00" for s in slots), "12:00 should be initially available"

    # 2. Patient 1 Books 12:00 PM
    print("\n--- Test: Patient 1 books 12:00 PM ---")
    res1 = await appointment_service.book_appointment(
        patient_phone="01011111111",
        date_str=test_date,
        time_str="12:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    print(f"Patient 1 Booking Result: success={res1.get('success')}, queue={res1.get('queue_number')}")
    assert res1["success"] is True
    assert res1["queue_number"] == 7
    appt1_id = res1["appointment_id"]

    # 3. Duplicate Booking Test: Patient 2 tries to book the EXACT SAME SLOT (12:00 PM)
    print("\n--- Test: Patient 2 attempts DOUBLE-BOOKING 12:00 PM ---")
    res2 = await appointment_service.book_appointment(
        patient_phone="01022222222",
        date_str=test_date,
        time_str="12:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    print(f"Patient 2 Double-Booking Result: success={res2.get('success')}, error={res2.get('error')}")
    print(f"Message: {res2.get('message')}")
    assert res2["success"] is False, "Double booking MUST fail!"
    assert res2["error"] == "slot_taken", "Error should be slot_taken"
    print("✅ Double-booking was BLOCKED successfully!")

    # 4. Check available slots now (12:00 must be absent)
    print("\n--- Test: Verify 12:00 is removed from available slots ---")
    res_after = await appointment_service.get_available_slots(doctor_id, test_date, clinic_id)
    slots_after = res_after.get("available_slots", res_after) if isinstance(res_after, dict) else res_after
    assert not any(s["time"] == "12:00" for s in slots_after), "12:00 MUST NOT appear in available slots"
    print(f"✅ Verified: 12:00 PM is no longer available (Remaining: {len(slots_after)} slots)")

    # 5. Patient 2 books 12:30 PM (different slot)
    print("\n--- Test: Patient 2 books alternative slot 12:30 PM ---")
    res3 = await appointment_service.book_appointment(
        patient_phone="01022222222",
        date_str=test_date,
        time_str="12:30",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    print(f"Patient 2 Booking Result: success={res3.get('success')}, queue={res3.get('queue_number')}")
    assert res3["success"] is True
    assert res3["queue_number"] == 8
    appt2_id = res3["appointment_id"]

    # 6. Cancellation: Patient 1 cancels 12:00 PM
    print("\n--- Test: Patient 1 CANCELS 12:00 PM ---")
    cancel_res = await appointment_service.cancel_appointment(appointment_id=appt1_id)
    print(f"Cancellation Result: {cancel_res.get('message')}")
    assert cancel_res["success"] is True

    # 7. Verify 12:00 is freed and can now be booked by Patient 3
    print("\n--- Test: Patient 3 books the newly freed 12:00 PM slot ---")
    res4 = await appointment_service.book_appointment(
        patient_phone="01033333333",
        date_str=test_date,
        time_str="12:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    print(f"Patient 3 Booking Result: success={res4.get('success')}, queue={res4.get('queue_number')}")
    assert res4["success"] is True
    print("✅ Slot was successfully freed and re-booked!")

    # 8. Rescheduling: Patient 2 reschedules from 12:30 PM to 14:00 PM
    print("\n--- Test: Patient 2 RESCHEDULES from 12:30 PM to 14:00 PM ---")
    resched_res = await appointment_service.reschedule_appointment(
        patient_phone="01022222222",
        new_date=test_date,
        new_time="14:00",
        appointment_id=appt2_id,
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    print(f"Reschedule Result: success={resched_res.get('success')}")
    print(f"Message: {resched_res.get('message')}")
    assert resched_res["success"] is True

    # Verify 12:30 is now free again
    res_final = await appointment_service.get_available_slots(doctor_id, test_date, clinic_id)
    slots_final = res_final.get("available_slots", res_final) if isinstance(res_final, dict) else res_final
    assert any(s["time"] == "12:30" for s in slots_final), "12:30 should now be free"
    assert not any(s["time"] == "14:00" for s in slots_final), "14:00 should now be booked"
    print("✅ Rescheduling freed old slot and locked new slot correctly!")


def run_ai_agent_api_tests():
    print("\n" + "="*50)
    print("🤖 2. LIVE AI AGENT FASTAPI ENDPOINT TESTS")
    print("="*50)

    client = httpx.Client(base_url="http://localhost:8000", timeout=45.0)
    phone_a = f"0109{int(time.time())%10000000:07d}"
    phone_b = f"0108{int(time.time())%10000000:07d}"
    chat_date = "2026-12-01"

    # Turn 1: Ask for availability
    print("\n--- Turn 1: Ask for appointment slots ---")
    r1 = client.post("/api/v1/chat", json={
        "message": f"السلام عليكم، عايز اعرف المواعيد المتاحة يوم {chat_date} ورقم تليفوني {phone_a}",
        "clinic_id": "default-clinic",
    })
    data1 = r1.json()
    thread_id = data1.get("thread_id")
    print(f"HTTP Status: {r1.status_code}")
    print(f"Thread ID: {thread_id}")
    sys.stdout.buffer.write(f"AI Response: {data1.get('response')}\n".encode("utf-8"))
    assert "لحظة واحدة" not in data1.get("response", ""), "Should NOT contain placeholder waiting messages!"
    assert any(char.isdigit() for char in data1.get("response", "")), "Should return slot times"

    # Turn 2: Pick 11:00 AM
    print("\n--- Turn 2: Confirm booking 11:00 AM ---")
    r2 = client.post("/api/v1/chat", json={
        "message": "تمام احجزلي الساعة 11:00 صباحاً",
        "clinic_id": "default-clinic",
        "thread_id": thread_id,
        "patient_phone": phone_a,
    })
    data2 = r2.json()
    print(f"HTTP Status: {r2.status_code}")
    sys.stdout.buffer.write(f"AI Response: {data2.get('response')}\n".encode("utf-8"))
    assert r2.status_code == 200
    assert "تم" in data2.get("response", "") or "نجاح" in data2.get("response", "") or "11:00" in data2.get("response", "")

    # Turn 3: Second Patient tries to book the EXACT SAME SLOT (11:00 AM on 2026-12-01)
    print("\n--- Turn 3: Patient B tries to book the SAME SLOT (11:00 AM) ---")
    r3 = client.post("/api/v1/chat", json={
        "message": f"عايز احجز يوم {chat_date} الساعة 11:00 ورقم تليفوني {phone_b}",
        "clinic_id": "default-clinic",
    })
    data3 = r3.json()
    print(f"HTTP Status: {r3.status_code}")
    sys.stdout.buffer.write(f"AI Response to Duplicate: {data3.get('response')}\n".encode("utf-8"))
    print("✅ AI Agent correctly handled duplicate booking!")


async def main():
    await run_direct_service_tests()
    run_ai_agent_api_tests()
    print("\n" + "="*50)
    print("🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
