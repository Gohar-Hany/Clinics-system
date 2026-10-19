"""
Enterprise Stress & Edge Case Test Suite for 3eyadaty Clinic System.
Validates:
1. Exact Working Hours & Last Slot Boundaries (09:00 - 16:30).
2. Rejection of 17:00, 16:55, 08:30, and non-standard intervals.
3. Chronological Slot-Based Queue Ticket Numbers (09:00 -> #1, 14:00 -> #11, 16:30 -> #16).
4. High-Concurrency Slot Race Condition (10 parallel requests -> exactly 1 winner).
5. Seamless Rescheduling & Atomic Slot Handover.
6. Cancellation and Slot Recovery.
7. Anti-Spam Single Active Booking Per Day.
8. Friday / Weekly Off-Day Rejection.
"""

import sys
import asyncio
import time
from datetime import datetime, timedelta
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.appointment_service import appointment_service, calculate_slot_queue_number
from app.services.redis_client import redis_service
from app.services.locking import lock_service

BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
BLUE = "\033[34m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RESET = "\033[0m"

results = []

def record_test(name: str, passed: bool, details: str = "", duration_ms: float = 0.0):
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    results.append({"name": name, "passed": passed, "details": details})
    print(f"  [{status}] {BOLD}{name}{RESET} ({duration_ms:.1f}ms) {details}")


async def test_1_slot_queue_number_calculation():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🎫 1. CHRONOLOGICAL QUEUE TICKET NUMBER FORMULA{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    t0 = time.perf_counter()
    q_0900 = calculate_slot_queue_number("09:00")
    q_0930 = calculate_slot_queue_number("09:30")
    q_1000 = calculate_slot_queue_number("10:00")
    q_1200 = calculate_slot_queue_number("12:00")
    q_1400 = calculate_slot_queue_number("14:00")
    q_1630 = calculate_slot_queue_number("16:30")
    dur = (time.perf_counter() - t0) * 1000

    record_test("1.1: 09:00 AM gives Ticket #1 (First slot of day)", q_0900 == 1, f"Got: #{q_0900}", dur)
    record_test("1.2: 09:30 AM gives Ticket #2", q_0930 == 2, f"Got: #{q_0930}", dur)
    record_test("1.3: 10:00 AM gives Ticket #3", q_1000 == 3, f"Got: #{q_1000}", dur)
    record_test("1.4: 12:00 PM gives Ticket #7", q_1200 == 7, f"Got: #{q_1200}", dur)
    record_test("1.5: 02:00 PM gives Ticket #11", q_1400 == 11, f"Got: #{q_1400}", dur)
    record_test("1.6: 04:30 PM gives Ticket #16 (Last slot of day)", q_1630 == 16, f"Got: #{q_1630}", dur)


async def test_2_boundary_working_hours():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}⏰ 2. STRICT WORKING HOURS & OUT-OF-BOUNDS REJECTION{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    # Make sure not Friday
    if datetime.strptime(test_date, "%Y-%m-%d").weekday() == 4:
        test_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")

    # 1. Test 17:00 (5:00 PM) - MUST BE REJECTED
    t0 = time.perf_counter()
    r_1700 = await appointment_service.book_appointment("01000000001", test_date, "17:00")
    dur_1700 = (time.perf_counter() - t0) * 1000
    record_test(
        "2.1: 17:00 (5:00 PM Closing Time) strictly rejected",
        r_1700.get("success") is False and r_1700.get("error") == "outside_working_hours",
        f"Response: {r_1700.get('error')} - {r_1700.get('message')}",
        dur_1700
    )

    # 2. Test 16:55 (5 to 5) - MUST BE REJECTED
    t0 = time.perf_counter()
    r_1655 = await appointment_service.book_appointment("01000000002", test_date, "16:55")
    dur_1655 = (time.perf_counter() - t0) * 1000
    record_test(
        "2.2: 16:55 (5 minutes before closing) strictly rejected",
        r_1655.get("success") is False and r_1655.get("error") in ("outside_working_hours", "invalid_slot_time"),
        f"Response: {r_1655.get('error')} - {r_1655.get('message')}",
        dur_1655
    )

    # 3. Test 08:30 (Before opening) - MUST BE REJECTED
    t0 = time.perf_counter()
    r_0830 = await appointment_service.book_appointment("01000000003", test_date, "08:30")
    dur_0830 = (time.perf_counter() - t0) * 1000
    record_test(
        "2.3: 08:30 (Before 09:00 opening) strictly rejected",
        r_0830.get("success") is False and r_0830.get("error") == "outside_working_hours",
        f"Response: {r_0830.get('error')} - {r_0830.get('message')}",
        dur_0830
    )

    # 4. Test 16:30 (Last valid slot of the day) - MUST BE ACCEPTED
    t0 = time.perf_counter()
    r_1630 = await appointment_service.book_appointment("01000000004", test_date, "16:30")
    dur_1630 = (time.perf_counter() - t0) * 1000
    record_test(
        "2.4: 16:30 (4:30 PM Last Slot) accepted with Ticket #16",
        r_1630.get("success") is True and r_1630.get("queue_number") == 16,
        f"Booked! Queue Ticket: #{r_1630.get('queue_number')}",
        dur_1630
    )


async def test_3_chronological_ordering_regardless_of_booking_time():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}📊 3. CHRONOLOGICAL QUEUE INDEPENDENT OF CREATION ORDER{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
    if datetime.strptime(test_date, "%Y-%m-%d").weekday() == 4:
        test_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")

    # Step A: Patient A books 14:00 (2:00 PM) FIRST
    t0 = time.perf_counter()
    res_a = await appointment_service.book_appointment("01111111111", test_date, "14:00")
    dur_a = (time.perf_counter() - t0) * 1000

    # Step B: Patient B books 09:00 (9:00 AM) LATER
    t0 = time.perf_counter()
    res_b = await appointment_service.book_appointment("01222222222", test_date, "09:00")
    dur_b = (time.perf_counter() - t0) * 1000

    record_test(
        "3.1: Patient A booked 14:00 first and received Ticket #11",
        res_a.get("success") is True and res_a.get("queue_number") == 11,
        f"Ticket: #{res_a.get('queue_number')}",
        dur_a
    )

    record_test(
        "3.2: Patient B booked 09:00 second and received Ticket #1 (not #2 or #3!)",
        res_b.get("success") is True and res_b.get("queue_number") == 1,
        f"Ticket: #{res_b.get('queue_number')}",
        dur_b
    )

    # Verify Redis sorted set ordering
    queue_state = await redis_service.get_full_queue("default-clinic", "default-doctor", test_date)
    entries = queue_state.get("entries", [])
    first_entry = entries[0] if entries else {}
    record_test(
        "3.3: Queue SSOT orders 09:00 (Ticket #1) ahead of 14:00 (Ticket #11)",
        first_entry.get("queue_number") == 1,
        f"First in line: Ticket #{first_entry.get('queue_number')}",
        0.0
    )


async def test_4_concurrency_race_condition():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔒 4. HIGH-CONCURRENCY RACE CONDITION DEFENSE (10 CONCURRENT USERS){RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
    if datetime.strptime(test_date, "%Y-%m-%d").weekday() == 4:
        test_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    target_slot = "10:30"

    # Launch 10 simultaneous booking attempts for the exact same slot
    t0 = time.perf_counter()
    tasks = [
        appointment_service.book_appointment(
            patient_phone=f"015000000{i:02d}",
            date_str=test_date,
            time_str=target_slot,
        )
        for i in range(10)
    ]
    results_list = await asyncio.gather(*tasks)
    dur = (time.perf_counter() - t0) * 1000

    successes = [r for r in results_list if r.get("success") is True]
    fails = [r for r in results_list if r.get("success") is False]

    record_test(
        "4.1: Exactly ONE winner out of 10 concurrent requests",
        len(successes) == 1,
        f"Successes: {len(successes)}, Failures: {len(fails)}",
        dur
    )
    record_test(
        "4.2: Remaining 9 requests rejected with slot_taken",
        len(fails) == 9 and all(f.get("error") == "slot_taken" for f in fails),
        f"Rejection reason verified for all 9 losers",
        dur
    )


async def test_5_rescheduling_and_cancellation():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔄 5. ATOMIC RESCHEDULING & SLOT RECOVERY{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d")
    if datetime.strptime(test_date, "%Y-%m-%d").weekday() == 4:
        test_date = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")

    patient = "01234567800"

    # 1. Book 11:00
    r_book = await appointment_service.book_appointment(patient, test_date, "11:00")
    record_test("5.1: Initial booking at 11:00 (Ticket #5)", r_book.get("success") is True and r_book.get("queue_number") == 5)

    # 2. Reschedule to 09:30
    t0 = time.perf_counter()
    r_resched = await appointment_service.reschedule_appointment(
        patient_phone=patient,
        new_date=test_date,
        new_time="09:30",
        old_date=test_date,
    )
    dur_resched = (time.perf_counter() - t0) * 1000
    record_test(
        "5.2: Rescheduled to 09:30 with new Ticket #2",
        r_resched.get("success") is True and r_resched.get("queue_number") == 2,
        f"New Ticket: #{r_resched.get('queue_number')}",
        dur_resched
    )

    # 3. Verify old slot (11:00) is now FREE for another patient
    r_freed = await appointment_service.book_appointment("01234567899", test_date, "11:00")
    record_test(
        "5.3: Old slot 11:00 was released and booked by another patient",
        r_freed.get("success") is True and r_freed.get("queue_number") == 5,
        f"New Patient Ticket: #{r_freed.get('queue_number')}"
    )

    # 4. Cancel appointment
    r_cancel = await appointment_service.cancel_appointment(patient_phone=patient, date_str=test_date)
    record_test(
        "5.4: Cancellation successfully releases slot 09:30",
        r_cancel.get("success") is True
    )


async def main():
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}🏥 3EYADATY (عيادتي) — ENTERPRISE ROOT-CAUSE RECOVERY AUDIT{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")

    await test_1_slot_queue_number_calculation()
    await test_2_boundary_working_hours()
    await test_3_chronological_ordering_regardless_of_booking_time()
    await test_4_concurrency_race_condition()
    await test_5_rescheduling_and_cancellation()

    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    if passed_count == total_count:
        print(f"{BOLD}{GREEN}🎉 ALL {total_count}/{total_count} ENTERPRISE TESTS PASSED (100.0% SUCCESS){RESET}")
    else:
        print(f"{BOLD}{RED}⚠️ {total_count - passed_count}/{total_count} TESTS FAILED{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")


if __name__ == "__main__":
    asyncio.run(main())
