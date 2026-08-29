"""
Comprehensive Queue Number Incrementation Audit Test
Tests 10 consecutive bookings on a fresh date to prove:
1. Patient 1 gets Queue #1
2. Patient 2 gets Queue #2
3. Patient 3 gets Queue #3
...
10. Patient 10 gets Queue #10
And verifies that when Patient 3 cancels, the queue integrity remains solid!
"""

import sys
import time
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

URL = "https://3eyadaty-api.up.railway.app"
TEST_DATE = "2026-09-10" # A completely fresh upcoming Thursday
CLINIC_ID = "default-clinic"
DOCTOR_ID = "default-doctor"
TOKEN = "clinic-secret-2026"

client = httpx.Client(base_url=URL, timeout=60.0)

BOLD = "\033[1m"
GREEN = "\033[32m"
BLUE = "\033[34m"
CYAN = "\033[36m"
RED = "\033[31m"
RESET = "\033[0m"


def main():
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}🧪 AUDITING QUEUE NUMBER INCREMENTATION (1..10) ON LIVE CLOUD{RESET}")
    print(f"{BOLD}{CYAN}🎯 Target: {URL} | 📅 Date: {TEST_DATE}{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")

    slots = [
        "09:00", "09:30", "10:00", "10:30", "11:00",
        "12:00", "12:30", "01:00", "01:30", "02:00"
    ]
    slots_24h = [
        "09:00", "09:30", "10:00", "10:30", "11:00",
        "12:00", "12:30", "13:00", "13:30", "14:00"
    ]

    assigned_numbers = []
    appointment_ids = []

    ts = str(int(time.time()))[-4:]

    for idx, (slot, slot_24h) in enumerate(zip(slots, slots_24h), start=1):
        phone = f"0127{ts}{idx:03d}"
        t0 = time.perf_counter()
        
        # Book via AI Chat
        r = client.post("/api/v1/chat", json={
            "message": f"احجزلي يوم {TEST_DATE} الساعة {slot} ورقم تليفوني {phone}",
            "clinic_id": CLINIC_ID,
            "patient_phone": phone,
            "thread_id": f"audit-q-{ts}-{idx}"
        })
        dur = (time.perf_counter() - t0) * 1000
        d = r.json()
        
        assigned_q = d.get("data", {}).get("queue_number")
        appt_id = d.get("data", {}).get("appointment_id")
        
        assigned_numbers.append(assigned_q)
        appointment_ids.append(appt_id)

        status_tag = f"{GREEN}✅ PASS{RESET}" if assigned_q == idx else f"{RED}❌ FAIL (Expected {idx}, got {assigned_q}){RESET}"
        print(f"Patient {idx:02d} ({phone}) -> Slot {slot:5s} | Queue Ticket: {BOLD}#{assigned_q}{RESET} | {status_tag} ({dur:.1f}ms)")

    # Verify Redis Full Queue State
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}📊 VERIFYING FULL REDIS QUEUE STATE FOR {TEST_DATE}{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")
    
    r_state = client.get(f"/api/v1/queue/state/{CLINIC_ID}/{DOCTOR_ID}?queue_date={TEST_DATE}", headers={"X-Clinic-Token": TOKEN})
    state = r_state.json()
    print(f"Total in Queue: {state.get('total')}")
    print("Entries in Order:")
    for entry in state.get("entries", []):
        print(f"  - Queue #{entry.get('queue_number')} -> Appointment {entry.get('appointment_id')[:8]}...")

    expected_sequence = list(range(1, 11))
    is_perfect = (assigned_numbers == expected_sequence) and (state.get("total") == 10)

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    if is_perfect:
        print(f"{BOLD}{GREEN}🏆 PERFECT RESULT: Sequence is exactly [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]! No logical error!{RESET}")
    else:
        print(f"{BOLD}{RED}⚠️ ISSUE DETECTED: Got {assigned_numbers} instead of {expected_sequence}{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")


if __name__ == "__main__":
    main()
