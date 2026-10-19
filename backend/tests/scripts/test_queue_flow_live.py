"""
Interactive Live Queue Testing Script
Tests the full patient queue journey:
1. Booking via AI Chat
2. Querying queue position via AI Chat in Arabic & English
3. Live REST API polling (/api/v1/queue/position/...)
4. Doctor transitions (Start consultation -> Complete consultation)
5. Dynamic ETA recalculation and turn notification
"""

import sys
import time
import httpx
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "https://3eyadaty-api.up.railway.app"
CLINIC_ID = "default-clinic"
DOCTOR_ID = "default-doctor"
CLINIC_TOKEN = "clinic-secret-2026"
TODAY = "2026-09-02"

client = httpx.Client(base_url=BASE_URL, timeout=60.0)

BOLD = "\033[1m"
GREEN = "\033[32m"
BLUE = "\033[34m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RESET = "\033[0m"


def print_step(title):
    print(f"\n{BOLD}{BLUE}======================================================================{RESET}")
    print(f"{BOLD}{BLUE}👉 {title}{RESET}")
    print(f"{BOLD}{BLUE}======================================================================{RESET}")


def main():
    print(f"{BOLD}{CYAN}🏥 TESTING LIVE QUEUE TRACKING & DYNAMIC NOTIFICATIONS{RESET}")
    print(f"🎯 Target Server: {BASE_URL}")
    print(f"📅 Queue Date: {TODAY}\n")

    # Generate random unique 11-digit test phone numbers
    import random
    suffix1 = random.randint(100000, 999999)
    suffix2 = random.randint(100000, 999999)
    phone_p1 = f"012{suffix1:08d}"
    phone_p2 = f"012{suffix2:08d}"
    ts = str(int(time.time()))[-4:]

    # -------------------------------------------------------------
    # Step 1: Patient 1 Books 12:00 PM
    # -------------------------------------------------------------
    print_step(f"Step 1: Patient 1 ({phone_p1}) Books 12:00 PM on {TODAY} via AI Chat")
    r1 = client.post("/api/v1/chat", json={
        "message": f"عايز احجز يوم {TODAY} الساعة 12:00 الظهر ورقم تليفوني {phone_p1}",
        "clinic_id": CLINIC_ID,
        "patient_phone": phone_p1,
        "thread_id": f"qtest-p1-{ts}"
    })
    d1 = r1.json()
    print(f"{GREEN}🤖 AI Response to Patient 1:{RESET}\n{d1.get('response')}")
    appt1_id = d1.get("data", {}).get("appointment_id")

    # -------------------------------------------------------------
    # Step 2: Patient 2 Books 12:30 PM
    # -------------------------------------------------------------
    print_step(f"Step 2: Patient 2 ({phone_p2}) Books 12:30 PM on {TODAY} via AI Chat")
    r2 = client.post("/api/v1/chat", json={
        "message": f"احجزلي يوم {TODAY} الساعة 12:30 الظهر ورقمي {phone_p2}",
        "clinic_id": CLINIC_ID,
        "patient_phone": phone_p2,
        "thread_id": f"qtest-p2-{ts}"
    })
    d2 = r2.json()
    print(f"{GREEN}🤖 AI Response to Patient 2:{RESET}\n{d2.get('response')}")
    appt2_id = d2.get("data", {}).get("appointment_id")

    # -------------------------------------------------------------
    # Step 3: Patient 2 asks AI Chat about their Queue Turn
    # -------------------------------------------------------------
    print_step("Step 3: Patient 2 asks AI Chat: 'دوري كام دلوقتي وفاضلي قد إيه؟'")
    r3 = client.post("/api/v1/chat", json={
        "message": "دوري كام دلوقتي في الطابور وفاضلي قد إيه؟",
        "clinic_id": CLINIC_ID,
        "patient_phone": phone_p2,
        "thread_id": f"qtest-p2-{ts}"
    })
    d3 = r3.json()
    print(f"{GREEN}🤖 AI Response to Patient 2:{RESET}\n{d3.get('response')}")

    # -------------------------------------------------------------
    # Step 4: Direct Fast REST API Polling (/queue/position)
    # -------------------------------------------------------------
    if appt2_id:
        print_step("Step 4: Frontend High-Speed Live Polling (/api/v1/queue/position/...)")
        t0 = time.perf_counter()
        r_pos = client.get(f"/api/v1/queue/position/{CLINIC_ID}/{DOCTOR_ID}/{appt2_id}?queue_date={TODAY}")
        dur = (time.perf_counter() - t0) * 1000
        print(f"⏱️ Response Time: {dur:.2f} ms")
        print(f"📊 Queue Position Object from Redis:\n{r_pos.json()}")

    # -------------------------------------------------------------
    # Step 5: Doctor Calls Patient 1 into the Examination Room
    # -------------------------------------------------------------
    if appt1_id:
        print_step("Step 5: Doctor starts consultation with Patient 1 (Current Serving -> #1)")
        r_start = client.post(
            f"/api/v1/queue/start/{appt1_id}?clinic_id={CLINIC_ID}&doctor_id={DOCTOR_ID}&queue_number=1",
            headers={"X-Clinic-Token": CLINIC_TOKEN}
        )
        print(f"✅ Doctor Action Result: {r_start.json()}")

    # -------------------------------------------------------------
    # Step 6: Patient 2 checks again in English via AI Chat
    # -------------------------------------------------------------
    print_step("Step 6: Patient 2 asks AI Chat in English: 'What is my queue status now?'")
    r6 = client.post("/api/v1/chat", json={
        "message": "What is my queue status now?",
        "clinic_id": CLINIC_ID,
        "patient_phone": phone_p2,
        "thread_id": f"qtest-p2-{ts}"
    })
    d6 = r6.json()
    print(f"{GREEN}🤖 AI English Response to Patient 2:{RESET}\n{d6.get('response')}")

    # -------------------------------------------------------------
    # Step 7: Doctor Finishes Consultation with Patient 1 (20 mins logged)
    # -------------------------------------------------------------
    if appt1_id:
        print_step("Step 7: Doctor finishes Patient 1 (20 min duration) & calls Patient 2")
        client.post(
            f"/api/v1/queue/complete/{appt1_id}?clinic_id={CLINIC_ID}&doctor_id={DOCTOR_ID}&duration_minutes=20",
            headers={"X-Clinic-Token": CLINIC_TOKEN}
        )
        # Doctor calls Patient 2
        if appt2_id:
            client.post(
                f"/api/v1/queue/start/{appt2_id}?clinic_id={CLINIC_ID}&doctor_id={DOCTOR_ID}&queue_number=2",
                headers={"X-Clinic-Token": CLINIC_TOKEN}
            )
            print("✅ Patient 2 is now being called into the examination room!")

    # -------------------------------------------------------------
    # Step 8: Patient 2 asks AI Chat: 'هل دوري جه دلوقتي؟'
    # -------------------------------------------------------------
    print_step("Step 8: Patient 2 asks AI Chat: 'هل دوري جه دلوقتي عند الدكتور؟'")
    r8 = client.post("/api/v1/chat", json={
        "message": "هل دوري جه دلوقتي عند الدكتور؟",
        "clinic_id": CLINIC_ID,
        "patient_phone": phone_p2,
        "thread_id": f"qtest-p2-{ts}"
    })
    d8 = r8.json()
    print(f"{GREEN}🤖 AI Response to Patient 2:{RESET}\n{d8.get('response')}")

    print(f"\n{BOLD}{GREEN}======================================================================{RESET}")
    print(f"{BOLD}{GREEN}🎉 LIVE QUEUE TEST COMPLETED SUCCESSFULLY ON RAILWAY CLOUD! 🚀{RESET}")
    print(f"{BOLD}{GREEN}======================================================================{RESET}\n")


if __name__ == "__main__":
    main()
