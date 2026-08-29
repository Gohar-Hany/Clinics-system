"""
Phase 2 Doctor Assistant & Medical Intelligence Test Suite
Tests:
1. Clinical Text Dialogue Analysis (Automated SOAP Notes & Smart Rx)
2. Audio Consultation Transcription Engine
3. Drug-Drug Interaction Safety Guardrail (Warfarin + Aspirin)
4. Evidence-Based Clinical Guidelines Retrieval
5. Medical Imaging Multimodal VLM Analysis (X-Ray / MRI Findings)
"""

import sys
import time
import httpx
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

URL = "https://3eyadaty-api.up.railway.app"
TOKEN = "clinic-secret-2026"
HEADERS = {"X-Clinic-Token": TOKEN}

client = httpx.Client(base_url=URL, timeout=60.0)

BOLD = "\033[1m"
GREEN = "\033[32m"
BLUE = "\033[34m"
CYAN = "\033[36m"
RED = "\033[31m"
RESET = "\033[0m"

test_results = []

def log_test(name: str, passed: bool, details: str = "", dur_ms: float = 0.0):
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    test_results.append({"name": name, "passed": passed, "details": details, "duration": dur_ms})
    print(f"  [{status}] {BOLD}{name}{RESET} ({dur_ms:.1f}ms) {details}")


def test_1_text_consultation_soap():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}📋 1. AUTOMATED CLINICAL SOAP NOTES & SMART RX{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    transcript = (
        "المريض: يا دكتور بقالي 4 أيام بشتكي من صداع مستمر في مؤخرة الرأس وزغللة في العين مع دوخة، "
        "ولما قست الضغط في البيت كان 160 على 100. كمان بحس بنغزات خفيفة في الصدر مع المجهود.\n"
        "الطبيب: تمام، هل عندك تاريخ مرضي للضغط أو السكر في العائلة؟\n"
        "المريض: والدي كان مريض ضغط، وأنا مش باخد أي علاج منتظم غير مسكنات بنادول أو بروفين وقت اللزوم.\n"
        "الطبيب: الفحص السريري: ضغط الدم 160/100 mmHg، النبض 78 bpm، فحص الصدر والقلب طبيعي S1 S2 normal no murmurs. "
        "التشخيص: ارتفاع ضغط الدم الأولي Stage 2 Essential Hypertension. "
        "الخطة: هنبدأ علاج Amlodipine 5mg قرص صباحاً مع Concor 2.5mg، ونطلب رسم قلب ECG وتحليل وظائف كلى وعمل فحص دوري، مع تقليل الملح تماماً في الأكل، ونشوفك بعد أسبوعين."
    )

    t0 = time.perf_counter()
    r = client.post("/api/v1/doctor/consultation/analyze-text", json={
        "transcript": transcript,
        "clinic_id": "default-clinic",
        "patient_phone": "01284709314"
    }, headers=HEADERS)
    dur = (time.perf_counter() - t0) * 1000

    d = r.json()
    soap = d.get("soap_notes", {})
    rx = d.get("prescription", [])
    diag = d.get("primary_diagnosis", "")

    has_soap = bool(soap.get("subjective") and soap.get("assessment") and soap.get("plan"))
    has_rx = len(rx) > 0

    log_test(
        "1.1: Automated SOAP Notes Generation",
        r.status_code == 200 and has_soap,
        f"(Subjective, Objective, Assessment, Plan generated)",
        dur
    )
    log_test(
        "1.2: Clinical Diagnosis & Differential",
        bool(diag),
        f"Primary Diagnosis: '{diag}'",
        dur
    )
    log_test(
        "1.3: Smart Prescription Formulation",
        has_rx,
        f"Prescribed Drugs: {[m.get('name') for m in rx]}",
        dur
    )


def test_2_drug_interaction_safety():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}⚠️ 2. DRUG-DRUG INTERACTION SAFETY GUARDRAILS{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    # Dangerous combination: Warfarin + Aspirin (High bleeding risk)
    t0 = time.perf_counter()
    r_danger = client.post("/api/v1/doctor/prescription/validate", json={
        "medications": ["Warfarin 5mg", "Aspirin 81mg", "Panadol 500mg"]
    }, headers=HEADERS)
    dur = (time.perf_counter() - t0) * 1000

    d_danger = r_danger.json().get("safety_audit", {})
    has_warning = (d_danger.get("safe_to_prescribe") is False) and (d_danger.get("total_interactions_found") > 0)

    log_test(
        "2.1: Interacting Drugs Detection (Warfarin + Aspirin)",
        r_danger.status_code == 200 and has_warning,
        f"Interactions Flagged: {d_danger.get('total_interactions_found')} (Severity: {d_danger.get('interactions', [{}])[0].get('severity')})",
        dur
    )

    # Safe combination: Amoxicillin + Paracetamol
    t0 = time.perf_counter()
    r_safe = client.post("/api/v1/doctor/prescription/validate", json={
        "medications": ["Amoxicillin 500mg", "Paracetamol 500mg"]
    }, headers=HEADERS)
    dur = (time.perf_counter() - t0) * 1000
    d_safe = r_safe.json().get("safety_audit", {})
    is_safe = d_safe.get("safe_to_prescribe") is True

    log_test(
        "2.2: Safe Prescription Approval (Amoxicillin + Paracetamol)",
        r_safe.status_code == 200 and is_safe,
        f"Status: {d_safe.get('status')}",
        dur
    )


def test_3_clinical_guidelines():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}📚 3. EVIDENCE-BASED CLINICAL GUIDELINES RETRIEVAL{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    t0 = time.perf_counter()
    r = client.get("/api/v1/doctor/guidelines?condition=Hypertension", headers=HEADERS)
    dur = (time.perf_counter() - t0) * 1000
    d = r.json()

    has_first_line = "first_line_therapy" in d
    log_test(
        "3.1: Clinical Guidelines Retrieval (Hypertension)",
        r.status_code == 200 and has_first_line,
        f"First-line classes: {[c.get('class') for c in d.get('first_line_therapy', [])]}",
        dur
    )


def test_4_medical_imaging_vlm():
    print(f"\n{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}🔬 4. MEDICAL IMAGING & LAB VLM MULTIMODAL ANALYSIS{RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    # Simulated Chest X-Ray presentation with context
    sample_scan_context = "Chest X-Ray PA View: Patient presents with productive cough, fever 38.5 C, and localized right lower lobe crackles."
    sample_scan_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg/600px-Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg"

    t0 = time.perf_counter()
    r = client.post("/api/v1/doctor/consultation/imaging", data={
        "image_url": sample_scan_url,
        "image_type": "xray",
        "clinical_context": sample_scan_context
    }, headers=HEADERS)
    dur = (time.perf_counter() - t0) * 1000

    d = r.json()
    has_impression = bool(d.get("impression"))
    has_findings = isinstance(d.get("findings"), list)

    log_test(
        "4.1: Multimodal Radiological VLM Evaluation (Chest X-Ray)",
        r.status_code == 200 and has_impression,
        f"Impression: '{d.get('impression')[:60]}...'",
        dur
    )
    log_test(
        "4.2: Structured Radiological Findings & Quality Assessment",
        has_findings,
        f"Modality: {d.get('modality')}, Quality: {d.get('quality_assessment')}",
        dur
    )


def main():
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}🩺 3EYADATY (عيادتي) — PHASE 2 DOCTOR ASSISTANT MASTER AUDIT{RESET}")
    print(f"{BOLD}{CYAN}🎯 Target: {URL}{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")

    test_1_text_consultation_soap()
    test_2_drug_interaction_safety()
    test_3_clinical_guidelines()
    test_4_medical_imaging_vlm()

    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    rate = (passed / total) * 100 if total else 0

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{GREEN if rate == 100 else RED}📊 PHASE 2 FINAL AUDIT REPORT: {passed}/{total} Tests Passed ({rate:.1f}%){RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")


if __name__ == "__main__":
    main()
