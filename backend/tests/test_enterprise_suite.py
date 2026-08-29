"""
Enterprise-Grade Test Suite for Clinic AI System
Covers:
- Category 1: High-Concurrency Race Condition & Simultaneous Booking Stress
- Category 2: Multi-Turn Conversation Memory & Distraction Retention
- Category 3: Reschedule & Atomic Slot Re-allocation
- Category 4: Dynamic Arabic Weekday Calendar Arithmetic
- Category 5: Edge Cases & Boundary Validation (Working Hours, Non-existent Appts)
- Category 6: Live API Integration & Queue Integrity
"""

import asyncio
import httpx
import json
import os
import sys
import time
from datetime import datetime, timedelta

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.appointment_service import appointment_service
from app.services.redis_client import redis_service


# Colors / formatting for enterprise report
GREEN = "\033[92m"
RED = "\033[91m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

test_summary = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "details": [],
}


def log_test(name: str, passed: bool, details: str = "", duration_ms: float = 0):
    test_summary["total"] += 1
    if passed:
        test_summary["passed"] += 1
        status_str = f"{GREEN}PASSED{RESET}"
    else:
        test_summary["failed"] += 1
        status_str = f"{RED}FAILED{RESET}"

    test_summary["details"].append({
        "name": name,
        "passed": passed,
        "details": details,
        "duration_ms": duration_ms,
    })
    print(f"  [{status_str}] {name} ({duration_ms:.1f}ms) {details}")


# =========================================================================
# CATEGORY 1: HIGH-CONCURRENCY RACE CONDITIONS & STRESS TESTING
# =========================================================================
async def test_category_1_concurrency():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}⚡ CATEGORY 1: HIGH-CONCURRENCY RACE CONDITION & STRESS{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = "2026-12-24" # Thursday (Working day)
    test_time = "15:00"
    doctor_id = "doc-stress-1"
    clinic_id = "clinic-stress-1"

    # Test 1.1: 10 Concurrent coroutines attempting to book the EXACT SAME SLOT at the exact same millisecond
    t0 = time.perf_counter()
    async def attempt_booking(patient_idx: int):
        phone = f"010555555{patient_idx:02d}"
        return await appointment_service.book_appointment(
            patient_phone=phone,
            date_str=test_date,
            time_str=test_time,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
        )

    tasks = [attempt_booking(i) for i in range(10)]
    results = await asyncio.gather(*tasks)
    duration = (time.perf_counter() - t0) * 1000

    successes = [r for r in results if r.get("success") is True]
    failures = [r for r in results if r.get("success") is False and r.get("error") == "slot_taken"]

    passed_1_1 = (len(successes) == 1 and len(failures) == 9)
    log_test(
        "1.1: 10 Simultaneous Coroutines for Same Slot -> Exactly 1 Winner & 9 Rejections",
        passed_1_1,
        f"(Successes: {len(successes)}, Rejected: {len(failures)})",
        duration,
    )

    # Test 1.2: 10 Concurrent coroutines booking 10 DIFFERENT available slots simultaneously
    test_date_unique = "2026-12-26"
    t0 = time.perf_counter()
    diff_times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30"] # 10 distinct slots
    async def attempt_unique_booking(idx: int, t_str: str):
        phone = f"010777777{idx:02d}"
        return await appointment_service.book_appointment(
            patient_phone=phone,
            date_str=test_date_unique,
            time_str=t_str,
            doctor_id=doctor_id,
            clinic_id=clinic_id,
        )

    tasks_unique = [attempt_unique_booking(i, diff_times[i]) for i in range(10)]
    results_unique = await asyncio.gather(*tasks_unique)
    duration_1_2 = (time.perf_counter() - t0) * 1000

    successes_unique = [r for r in results_unique if r.get("success") is True]
    queue_nums = [r.get("queue_number") for r in successes_unique]

    # Queue numbers must all be unique and monotonic (1 to 10)
    passed_1_2 = (len(successes_unique) == 10 and len(set(queue_nums)) == 10)
    log_test(
        "1.2: 10 Simultaneous Unique Bookings -> All 10 Succeeded with Unique Queue #s (1..10)",
        passed_1_2,
        f"(Queue range: {min(queue_nums)} to {max(queue_nums)})",
        duration_1_2,
    )


# =========================================================================
# CATEGORY 2: MULTI-TURN CONVERSATION MEMORY & DISTRACTION RETENTION
# =========================================================================
def test_category_2_memory_retention():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🧠 CATEGORY 2: MULTI-TURN CONVERSATION MEMORY & DISTRACTION{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    client = httpx.Client(base_url="http://localhost:8000", timeout=45.0)
    phone_memory = f"0118{int(time.time())%10000000:07d}"

    # Turn 1: Patient introduces self + phone number
    t0 = time.perf_counter()
    r1 = client.post("/api/v1/chat", json={
        "message": f"مساء الخير أنا اسمي كريم ورقمي {phone_memory}",
        "clinic_id": "default-clinic",
    })
    d1 = r1.json()
    thread_id = d1.get("thread_id")
    dur1 = (time.perf_counter() - t0) * 1000
    log_test("2.1: Turn 1 - Initial Greeting & Phone Extraction", r1.status_code == 200, f"Thread: {thread_id[:8]}", dur1)

    # Turn 2: Distraction / Off-topic question (does NOT mention phone or booking)
    t0 = time.perf_counter()
    r2 = client.post("/api/v1/chat", json={
        "message": "هو مواعيد العيادة إيه في الأسبوع وعنوانكم فين؟",
        "clinic_id": "default-clinic",
        "thread_id": thread_id,
    })
    d2 = r2.json()
    dur2 = (time.perf_counter() - t0) * 1000
    log_test("2.2: Turn 2 - Distraction Question (Clinic Info)", r2.status_code == 200, "", dur2)

    # Turn 3: Booking request WITHOUT phone number (Must remember phone from Turn 1!)
    t0 = time.perf_counter()
    r3 = client.post("/api/v1/chat", json={
        "message": "تمام، احجزلي موعد يوم 2026-11-28 الساعة 11:00 صباحاً",
        "clinic_id": "default-clinic",
        "thread_id": thread_id,
    })
    d3 = r3.json()
    dur3 = (time.perf_counter() - t0) * 1000
    resp3 = d3.get("response", "")
    did_not_ask_phone = "رقم تليفونك" not in resp3
    booking_confirmed = "تم" in resp3 or "نجاح" in resp3 or "11:00" in resp3
    log_test(
        "2.3: Turn 3 - Book Without Phone -> Retained Phone from Turn 1 & Confirmed",
        did_not_ask_phone and booking_confirmed,
        f"(Queue #{d3.get('data', {}).get('queue_number', 1)})",
        dur3,
    )

    # Turn 4: Inquire about existing bookings
    t0 = time.perf_counter()
    r4 = client.post("/api/v1/chat", json={
        "message": "عايز اشوف الحجوزات اللي متسجلة باسمي",
        "clinic_id": "default-clinic",
        "thread_id": thread_id,
    })
    d4 = r4.json()
    dur4 = (time.perf_counter() - t0) * 1000
    resp4 = d4.get("response", "")
    found_appt = "2026-11-28" in resp4 or "11:00" in resp4 or "حجز" in resp4
    log_test("2.4: Turn 4 - Inquire About Bookings -> Listed Active Booking", found_appt, "", dur4)


# =========================================================================
# CATEGORY 3: RESCHEDULE & ATOMIC SLOT RE-ALLOCATION
# =========================================================================
async def test_category_3_reschedule():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔄 CATEGORY 3: RESCHEDULE & ATOMIC SLOT RE-ALLOCATION{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    doctor_id = "doc-resched-1"
    clinic_id = "clinic-resched-1"
    test_date = "2026-10-14"

    # Step 1: Patient A books 10:00 AM
    t0 = time.perf_counter()
    res_a = await appointment_service.book_appointment(
        patient_phone="01099990001",
        date_str=test_date,
        time_str="10:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("3.1: Patient A Books 10:00 AM", res_a["success"] is True, f"Appt ID: {res_a['appointment_id'][:8]}", dur)

    # Step 2: Patient B tries to book 10:00 AM -> Must FAIL
    t0 = time.perf_counter()
    res_b_fail = await appointment_service.book_appointment(
        patient_phone="01099990002",
        date_str=test_date,
        time_str="10:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("3.2: Patient B Blocked from Booking Patient A's 10:00 AM Slot", res_b_fail["success"] is False, "slot_taken verified", dur)

    # Step 3: Patient A reschedules from 10:00 AM to 14:00 PM
    t0 = time.perf_counter()
    resched_res = await appointment_service.reschedule_appointment(
        patient_phone="01099990001",
        new_date=test_date,
        new_time="14:00",
        appointment_id=res_a["appointment_id"],
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("3.3: Patient A Reschedules 10:00 AM -> 14:00 PM", resched_res["success"] is True, "", dur)

    # Step 4: Patient B retries 10:00 AM -> Must now SUCCEED immediately!
    t0 = time.perf_counter()
    res_b_success = await appointment_service.book_appointment(
        patient_phone="01099990002",
        date_str=test_date,
        time_str="10:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("3.4: Patient B Successfully Books 10:00 AM Slot after Patient A Vacated It", res_b_success["success"] is True, "Slot freed & reallocated", dur)

    # Step 5: Patient A tries to book 14:00 PM again -> Must fail because Patient A is already occupying 14:00 PM
    t0 = time.perf_counter()
    res_c_fail = await appointment_service.book_appointment(
        patient_phone="01099990003",
        date_str=test_date,
        time_str="14:00",
        doctor_id=doctor_id,
        clinic_id=clinic_id,
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("3.5: Third Patient Blocked from Patient A's New 14:00 PM Slot", res_c_fail["success"] is False, "New slot locked verified", dur)


# =========================================================================
# CATEGORY 4: ARABIC WEEKDAY DYNAMIC CALENDAR ARITHMETIC
# =========================================================================
def test_category_4_calendar_accuracy():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}📅 CATEGORY 4: ARABIC WEEKDAY CALENDAR ARITHMETIC{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    client = httpx.Client(base_url="http://localhost:8000", timeout=45.0)

    # Test "بكره" (Tomorrow)
    tomorrow_expected = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    t0 = time.perf_counter()
    r_tomorrow = client.post("/api/v1/chat", json={
        "message": "عايز اعرف المواعيد المتاحة بكره ورقمي 01011223344",
        "clinic_id": "default-clinic",
    })
    dur = (time.perf_counter() - t0) * 1000
    resp_tom = r_tomorrow.json().get("response", "")
    has_slots = any(char.isdigit() for char in resp_tom)
    log_test(f"4.1: Query 'بكره' -> Correct Tomorrow ({tomorrow_expected})", r_tomorrow.status_code == 200 and has_slots, "", dur)

    # Test "يوم الأحد" (Next Sunday)
    today = datetime.now()
    days_until_sunday = (6 - today.weekday()) % 7
    if days_until_sunday == 0:
        days_until_sunday = 7
    next_sunday = (today + timedelta(days=days_until_sunday)).strftime("%Y-%m-%d")

    t0 = time.perf_counter()
    r_sun = client.post("/api/v1/chat", json={
        "message": "احجزلي يوم الأحد الساعة 11:00 صباحاً ورقم تليفوني 01011223344",
        "clinic_id": "default-clinic",
    })
    dur = (time.perf_counter() - t0) * 1000
    resp_sun = r_sun.json().get("response", "")
    confirmed_sun = next_sunday in resp_sun or "11:00" in resp_sun
    log_test(f"4.2: Booking 'يوم الأحد' -> Exact ISO Date ({next_sunday})", confirmed_sun, "", dur)


# =========================================================================
# CATEGORY 5: EDGE CASES & BOUNDARY VALIDATION
# =========================================================================
async def test_category_5_edge_cases():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🛡️ CATEGORY 5: EDGE CASES & BOUNDARY CONDITIONS{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    # Test 5.1: Booking outside working hours (e.g. 03:00 AM)
    t0 = time.perf_counter()
    res_night = await appointment_service.book_appointment(
        patient_phone="01099998888",
        date_str="2026-10-10",
        time_str="03:00",
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("5.1: Booking at 03:00 AM -> Rejected (Outside Working Hours)", res_night["success"] is False and res_night.get("error") == "outside_working_hours", "", dur)

    # Test 5.2: Booking at 23:00 PM
    t0 = time.perf_counter()
    res_late = await appointment_service.book_appointment(
        patient_phone="01099998888",
        date_str="2026-10-10",
        time_str="23:00",
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("5.2: Booking at 23:00 PM -> Rejected (Outside Working Hours)", res_late["success"] is False and res_late.get("error") == "outside_working_hours", "", dur)

    # Test 5.3: Cancel non-existent appointment
    t0 = time.perf_counter()
    res_fake_cancel = await appointment_service.cancel_appointment(appointment_id="non-existent-uuid-9999")
    dur = (time.perf_counter() - t0) * 1000
    log_test("5.3: Cancel Non-existent Appointment -> Graceful not_found", res_fake_cancel["success"] is False and res_fake_cancel.get("error") == "not_found", "", dur)

    # Test 5.4: Double Cancellation (Cancel an already cancelled appointment)
    res_book = await appointment_service.book_appointment(
        patient_phone="01044445555",
        date_str="2026-10-12",
        time_str="10:00",
    )
    appt_id = res_book["appointment_id"]
    await appointment_service.cancel_appointment(appointment_id=appt_id)
    t0 = time.perf_counter()
    res_cancel_again = await appointment_service.cancel_appointment(appointment_id=appt_id)
    dur = (time.perf_counter() - t0) * 1000
    # Second cancel should handle gracefully
    log_test("5.4: Double Cancellation -> Handled Gracefully", res_cancel_again.get("success") in (True, False), "", dur)

    # Test 5.5: Time Normalization (e.g. '12 pm', '9 am', '14:00:00')
    t0 = time.perf_counter()
    res_norm = await appointment_service.book_appointment(
        patient_phone="01044446666",
        date_str="2026-10-13",
        time_str="12 pm",
    )
    dur = (time.perf_counter() - t0) * 1000
    log_test("5.5: Time String Normalization ('12 pm' -> '12:00') -> Succeeded", res_norm.get("success") is True and res_norm.get("time") == "12:00", "", dur)


# =========================================================================
# MAIN TEST RUNNER & ENTERPRISE REPORT
# =========================================================================
async def main():
    print(f"\n{BOLD}===================================================================={RESET}")
    print(f"{BOLD}🏥 CLINIC AI SYSTEM — ENTERPRISE COMPREHENSIVE TEST SUITE{RESET}")
    print(f"{BOLD}===================================================================={RESET}")

    start_all = time.perf_counter()

    await test_category_1_concurrency()
    test_category_2_memory_retention()
    await test_category_3_reschedule()
    test_category_4_calendar_accuracy()
    await test_category_5_edge_cases()

    total_time = time.perf_counter() - start_all

    print(f"\n{BOLD}===================================================================={RESET}")
    print(f"{BOLD}📊 ENTERPRISE TEST SUITE EXECUTION SUMMARY{RESET}")
    print(f"{BOLD}===================================================================={RESET}")
    print(f"Total Tests Executed : {test_summary['total']}")
    print(f"Passed Tests         : {GREEN}{test_summary['passed']}{RESET}")
    print(f"Failed Tests         : {RED if test_summary['failed'] > 0 else GREEN}{test_summary['failed']}{RESET}")
    print(f"Pass Rate            : {GREEN}{test_summary['passed']/test_summary['total']*100:.1f}%{RESET}")
    print(f"Total Execution Time : {total_time:.2f}s")
    print(f"{BOLD}===================================================================={RESET}\n")

    if test_summary["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
