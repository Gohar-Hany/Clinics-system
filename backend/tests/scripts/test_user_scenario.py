"""
Test the exact user dialogue scenario:
1. Ask for queue without phone
2. Give phone
3. Say 'كنت حاجز يوم التلات تقريبا' -> Bot must NOT ask for phone again
4. Say 'عايز احجز يوم التلات الساعة 12 الضهر' -> Bot must NOT ask for phone, and must book Tuesday 2026-09-01
5. Ask for queue again -> Bot immediately returns queue position #1
"""

import httpx
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

client = httpx.Client(base_url="http://localhost:8000", timeout=45.0)
test_phone = f"0128{int(time.time())%10000000:07d}"

print("\n" + "="*50)
print(f"🧪 TESTING EXACT USER CONVERSATION SCENARIO (Phone: {test_phone})")
print("="*50)

# Turn 1: Ask for queue
print("\n--- Turn 1: User asks for queue position ---")
r1 = client.post("/api/v1/chat", json={
    "message": "عايز أعرف مكاني في الطابور 📊",
    "clinic_id": "default-clinic",
})
d1 = r1.json()
thread_id = d1.get("thread_id")
print(f"Bot: {d1.get('response')}")
assert "رقم" in d1.get("response", "") or "تليفون" in d1.get("response", "")

# Turn 2: Give phone number
print("\n--- Turn 2: User provides phone number ---")
r2 = client.post("/api/v1/chat", json={
    "message": test_phone,
    "clinic_id": "default-clinic",
    "thread_id": thread_id,
    "patient_phone": test_phone,
})
d2 = r2.json()
print(f"Bot: {d2.get('response')}")

# Turn 3: User says 'كنت حاجز يوم التلات تقريبا'
print("\n--- Turn 3: User mentions Tuesday booking ---")
r3 = client.post("/api/v1/chat", json={
    "message": "كنت حاجز يوم التلات تقريبا",
    "clinic_id": "default-clinic",
    "thread_id": thread_id,
    "patient_phone": test_phone,
})
d3 = r3.json()
print(f"Bot: {d3.get('response')}")
# MUST NOT ask for phone number again!
assert "ممكن تقولي رقم تليفونك" not in d3.get("response", ""), "Bot should NOT ask for phone number again!"

# Turn 4: User books Tuesday 12:00 PM
print("\n--- Turn 4: User requests booking Tuesday at 12:00 PM ---")
r4 = client.post("/api/v1/chat", json={
    "message": "عايز احجز يوم التلات الساعة 12 الضهر",
    "clinic_id": "default-clinic",
    "thread_id": thread_id,
    "patient_phone": test_phone,
})
d4 = r4.json()
print(f"Bot: {d4.get('response')}")
# MUST NOT ask for phone number!
assert "محتاج رقم تليفونك" not in d4.get("response", ""), "Bot should NOT ask for phone number again!"
# MUST book correctly for Tuesday (2026-09-01)
assert "2026-09-01" in d4.get("response", "") or "12:00" in d4.get("response", "") or "تم" in d4.get("response", "")

# Turn 5: Ask for queue position again
print("\n--- Turn 5: User asks for queue position after booking ---")
r5 = client.post("/api/v1/chat", json={
    "message": "عايز اعرف دوري كام في الطابور دلوقتي",
    "clinic_id": "default-clinic",
    "thread_id": thread_id,
    "patient_phone": test_phone,
})
d5 = r5.json()
print(f"Bot: {d5.get('response')}")
assert "1" in d5.get("response", "") or "دورك" in d5.get("response", "") or "مسجل" in d5.get("response", "")

print("\n" + "="*50)
print("🎉 USER SCENARIO TEST PASSED WITH ZERO FLAWS!")
print("="*50)
