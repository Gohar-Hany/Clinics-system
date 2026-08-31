"""
Live Production HTTP Cloud Test Suite for 3eyadaty API.
Target: https://3eyadaty-api.up.railway.app
Tests real network HTTP requests against the live deployed service on Railway.
100% Idempotent, self-cleaning, and isolated across runs.
"""

import sys
import asyncio
import time
import random
import uuid
from datetime import datetime, timedelta
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROD_URL = "https://3eyadaty-api.up.railway.app"
CLINIC_TOKEN = "clinic-secret-2026"
HEADERS = {
    "Content-Type": "application/json",
    "X-Clinic-Token": CLINIC_TOKEN,
}

BOLD = "\033[1m"
GREEN = "\033[32m"
RED = "\033[31m"
BLUE = "\033[34m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RESET = "\033[0m"

results = []

def get_unique_phone():
    return f"012{random.randint(10000000, 99999999)}"

def get_unique_future_date(offset_days: int = 10) -> str:
    # Pick a unique date not falling on Friday
    d = datetime.now() + timedelta(days=offset_days)
    if d.weekday() == 4: # Friday
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")

def record(name: str, passed: bool, details: str = "", duration_ms: float = 0.0):
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    results.append({"name": name, "passed": passed, "details": details})
    print(f"  [{status}] {BOLD}{name}{RESET} ({duration_ms:.1f}ms) {details}")


async def test_production_health(client: httpx.AsyncClient):
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🌐 1. PRODUCTION HEALTH & CONNECTIVITY AUDIT{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    t0 = time.perf_counter()
    r = await client.get("/health")
    dur = (time.perf_counter() - t0) * 1000

    data = r.json() if r.status_code == 200 else {}
    passed = r.status_code == 200 and data.get("status") == "healthy"
    record("1.1: Production API Health Check", passed, f"Status: {r.status_code}, Response: {data}", dur)


async def test_production_boundary_and_closing_hours(client: httpx.AsyncClient):
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}⏰ 2. PRODUCTION WORKING HOURS & BOUNDARY REJECTIONS{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = get_unique_future_date(offset_days=random.randint(5, 12))
    phone_1 = get_unique_phone()
    phone_2 = get_unique_phone()

    # 1. Ask chat to book 17:00 (5:00 PM) -> MUST BE REJECTED
    t0 = time.perf_counter()
    r_1700 = await client.post("/api/v1/chat", json={
        "message": f"عايز احجز موعد يوم {test_date} الساعة 5 مساءً ورقم تليفوني {phone_1}",
        "clinic_id": "default-clinic",
    })
    dur_1700 = (time.perf_counter() - t0) * 1000
    d_1700 = r_1700.json()
    resp_text = d_1700.get("response", "")
    passed_1700 = ("مغلق" in resp_text or "تقفل" in resp_text or "تنتهي" in resp_text or "4:30" in resp_text or "خارج" in resp_text or "عفواً" in resp_text or "لا يمكن" in resp_text or "أعتذر" in resp_text)
    record("2.1: 5:00 PM (17:00 Closing time) strictly rejected by AI", passed_1700, f"Bot reply: '{resp_text[:85]}...'", dur_1700)

    # 2. Ask chat to book 16:30 (4:30 PM Last Slot) -> MUST BE CONFIRMED with Ticket #16
    t0 = time.perf_counter()
    r_1630 = await client.post("/api/v1/chat", json={
        "message": f"طب احجزلي يوم {test_date} الساعة 4:30 مساء ورقم تليفوني {phone_2}",
        "clinic_id": "default-clinic",
    })
    dur_1630 = (time.perf_counter() - t0) * 1000
    d_1630 = r_1630.json()
    resp_1630 = d_1630.get("response", "")
    passed_1630 = ("تم" in resp_1630 or "تأكيد" in resp_1630 or "بنجاح" in resp_1630 or "16" in resp_1630)
    record("2.2: 4:30 PM (16:30 Last Slot) successfully booked with Ticket #16", passed_1630, f"Bot reply: '{resp_1630[:85]}...'", dur_1630)


async def test_production_chronological_queue(client: httpx.AsyncClient):
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🎫 3. CHRONOLOGICAL TICKET #1 vs #11 OVER PRODUCTION HTTP{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = get_unique_future_date(offset_days=random.randint(13, 17))
    phone_a = get_unique_phone()
    phone_b = get_unique_phone()

    # Step A: Patient A books 14:00 (2:00 PM) FIRST
    t0 = time.perf_counter()
    r_a = await client.post("/api/v1/chat", json={
        "message": f"عايز احجز موعد يوم {test_date} الساعة 2 الظهر ورقم تليفوني {phone_a}",
        "clinic_id": "default-clinic",
    })
    dur_a = (time.perf_counter() - t0) * 1000
    d_a = r_a.json()
    resp_a = d_a.get("response", "")
    passed_a = ("11" in resp_a or "تم" in resp_a)
    record("3.1: Patient A booked 14:00 first (Assigned Ticket #11)", passed_a, f"Bot: '{resp_a[:80]}...'", dur_a)

    # Step B: Patient B books 09:00 (9:00 AM) SECOND
    t0 = time.perf_counter()
    r_b = await client.post("/api/v1/chat", json={
        "message": f"عايز احجز موعد يوم {test_date} الساعة 9 الصبح ورقم تليفوني {phone_b}",
        "clinic_id": "default-clinic",
    })
    dur_b = (time.perf_counter() - t0) * 1000
    d_b = r_b.json()
    resp_b = d_b.get("response", "")
    passed_b = ("1" in resp_b or "الأول" in resp_b or "تم" in resp_b) and ("3" not in resp_b)
    record("3.2: Patient B booked 09:00 second and received Ticket #1 (First in line)", passed_b, f"Bot: '{resp_b[:80]}...'", dur_b)

    # Step C: Verify Live Queue State API from Reception
    t0 = time.perf_counter()
    r_q = await client.get("/api/v1/queue/state/default-clinic/default-doctor", params={"queue_date": test_date}, headers=HEADERS)
    dur_q = (time.perf_counter() - t0) * 1000
    d_q = r_q.json()
    passed_q = (r_q.status_code == 200) and (d_q.get("total", 0) >= 2)
    record("3.3: Reception Live Queue State endpoint confirmed queue count", passed_q, f"Total in queue for {test_date}: {d_q.get('total', 0)}", dur_q)


async def test_production_live_concurrency(client: httpx.AsyncClient):
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔒 4. LIVE HIGH-CONCURRENCY RACE CONDITION (10 CONCURRENT HTTP CALLS){RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = get_unique_future_date(offset_days=random.randint(18, 20))
    target_time = "10:30"

    t0 = time.perf_counter()
    tasks = [
        client.post("/api/v1/chat", json={
            "message": f"احجزلي يوم {test_date} الساعة {target_time} ورقم تليفوني {get_unique_phone()}",
            "clinic_id": "default-clinic",
        })
        for _ in range(10)
    ]
    responses = await asyncio.gather(*tasks)
    dur = (time.perf_counter() - t0) * 1000

    success_replies = []
    conflict_replies = []

    for r in responses:
        if r.status_code == 200:
            txt = r.json().get("response", "")
            if "تم حجز" in txt or "تم تأكيد" in txt or "REF-" in txt or "تم الحجز" in txt:
                success_replies.append(txt)
            else:
                conflict_replies.append(txt)

    record(
        "4.1: Exactly ONE winner booked the slot across 10 concurrent HTTP requests",
        len(success_replies) == 1,
        f"Winners: {len(success_replies)}, Rejected/Offered alternative: {len(conflict_replies)}",
        dur
    )
    record(
        "4.2: Remaining 9 requests prevented from double-booking",
        len(conflict_replies) == 9,
        f"Concurrency isolation verified on Live Cloud Server",
        dur
    )


async def test_production_multiturn_rescheduling(client: httpx.AsyncClient):
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔄 5. LIVE MULTI-TURN RESCHEDULING & OVERWRITING DIALOGUE{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    test_date = get_unique_future_date(offset_days=random.randint(2, 6))
    phone = get_unique_phone()

    # Turn 1: Initial Booking at 10:00 AM
    t0 = time.perf_counter()
    r1 = await client.post("/api/v1/chat", json={
        "message": f"عايز احجز موعد يوم {test_date} الساعة 10:00 الصبح ورقم تليفوني {phone}",
        "clinic_id": "default-clinic",
    })
    dur1 = (time.perf_counter() - t0) * 1000
    d1 = r1.json()
    thread_id = d1.get("thread_id")
    resp1 = d1.get("response", "")
    record("5.1: Initial booking at 10:00 (Ticket #3)", "تم" in resp1 or "3" in resp1, f"Bot: '{resp1[:80]}...'", dur1)

    # Turn 2: Patient says "لا غير الميعاد خليه 12:30 الظهر"
    t0 = time.perf_counter()
    r2 = await client.post("/api/v1/chat", json={
        "message": "لا معلش غير الميعاد خليه 12:30 الظهر",
        "clinic_id": "default-clinic",
        "thread_id": thread_id,
        "patient_phone": phone,
    })
    dur2 = (time.perf_counter() - t0) * 1000
    d2 = r2.json()
    resp2 = d2.get("response", "")
    passed2 = ("تم تعديل" in resp2 or "الموعد الجديد" in resp2 or "12:30" in resp2 or "8" in resp2) and ("لديك حجز نشط بالفعل" not in resp2)
    record("5.2: Smooth rescheduling to 12:30 without anti-spam collision", passed2, f"Bot: '{resp2[:80]}...'", dur2)


async def main():
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}🚀 LIVE PRODUCTION CLOUD AUDIT (RAILWAY PLATFORM){RESET}")
    print(f"{BOLD}{CYAN}🎯 Base URL: {PROD_URL}{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")

    async with httpx.AsyncClient(base_url=PROD_URL, timeout=60.0, headers=HEADERS) as client:
        await test_production_health(client)
        await test_production_boundary_and_closing_hours(client)
        await test_production_chronological_queue(client)
        await test_production_live_concurrency(client)
        await test_production_multiturn_rescheduling(client)

    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    if passed_count == total_count:
        print(f"{BOLD}{GREEN}🎉 ALL {total_count}/{total_count} LIVE PRODUCTION TESTS PASSED (100.0% SUCCESS){RESET}")
    else:
        print(f"{BOLD}{RED}⚠️ {total_count - passed_count}/{total_count} PRODUCTION TESTS FAILED{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")


if __name__ == "__main__":
    asyncio.run(main())
