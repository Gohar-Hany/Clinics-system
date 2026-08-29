"""
Master All-In-One Test Runner for Clinic AI System.
Executes all test suites across the entire system:
1. Concurrency & Slot Locking Suite (test_booking_concurrency.py)
2. Exact User Conversation Scenario Suite (test_user_scenario.py)
3. Enterprise Multi-Turn & Race Condition Suite (tests/test_enterprise_suite.py)
4. Production Resilience & Security Guardrail Suite (tests/test_production_resilience.py)
"""

import asyncio
import os
import subprocess
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

GREEN = "\033[92m"
RED = "\033[91m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

backend_dir = os.path.dirname(os.path.abspath(__file__))
python_exe = sys.executable

suites = [
    {
        "name": "1. Exact User Scenario & Phone Memory Suite",
        "file": os.path.join(backend_dir, "test_user_scenario.py"),
        "category": "Multi-Turn Dialogue & Calendar Mapping",
    },
    {
        "name": "2. Concurrency & Slot Isolation Suite",
        "file": os.path.join(backend_dir, "test_booking_concurrency.py"),
        "category": "Distributed Slot Locking & Race Conditions",
    },
    {
        "name": "3. Enterprise 18-Test Comprehensive Suite",
        "file": os.path.join(backend_dir, "tests", "test_enterprise_suite.py"),
        "category": "High Concurrency, Rescheduling & Distraction Memory",
    },
    {
        "name": "4. Production Resilience & Security Suite",
        "file": os.path.join(backend_dir, "tests", "test_production_resilience.py"),
        "category": "Anti-Spam, ID Hijacking, Dialect NLP & Queue Drift",
    },
]


def run_suite(suite_info):
    print(f"\n{BOLD}{BLUE}===================================================================={RESET}")
    print(f"{BOLD}🚀 RUNNING: {suite_info['name']}{RESET}")
    print(f"{BLUE}📂 Category: {suite_info['category']}{RESET}")
    print(f"{BOLD}{BLUE}===================================================================={RESET}\n")

    t0 = time.perf_counter()
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    res = subprocess.run(
        [python_exe, suite_info["file"]],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    duration = time.perf_counter() - t0

    print(res.stdout)
    if res.stderr and res.returncode != 0:
        print(f"{RED}{res.stderr}{RESET}")

    passed = (res.returncode == 0)
    return {
        "name": suite_info["name"],
        "category": suite_info["category"],
        "passed": passed,
        "duration": duration,
        "output": res.stdout,
    }


def main():
    print(f"\n{BOLD}======================================================================{RESET}")
    print(f"{BOLD}🏥 CLINIC MANAGEMENT SYSTEM — MASTER ENTERPRISE TEST SUITE RUNNER{RESET}")
    print(f"{BOLD}======================================================================{RESET}")

    start_total = time.perf_counter()
    results = []

    for s in suites:
        res = run_suite(s)
        results.append(res)

    total_duration = time.perf_counter() - start_total
    all_passed = all(r["passed"] for r in results)

    print(f"\n{BOLD}======================================================================{RESET}")
    print(f"{BOLD}📊 MASTER SUITE FINAL AUDIT REPORT{RESET}")
    print(f"{BOLD}======================================================================{RESET}")

    for idx, r in enumerate(results, 1):
        status_text = f"{GREEN}✅ PASSED{RESET}" if r["passed"] else f"{RED}❌ FAILED{RESET}"
        print(f"  {idx}. {r['name']:<50} : {status_text} ({r['duration']:.2f}s)")

    print(f"{BOLD}----------------------------------------------------------------------{RESET}")
    print(f"Total Suites Executed : {len(results)}")
    print(f"Passed Suites         : {GREEN}{sum(1 for r in results if r['passed'])}{RESET}")
    print(f"Failed Suites         : {RED if not all_passed else GREEN}{sum(1 for r in results if not r['passed'])}{RESET}")
    print(f"Total Execution Time  : {total_duration:.2f}s")
    print(f"System Health Status  : {GREEN}100% PRODUCTION READY 🚀{RESET}" if all_passed else f"{RED}REQUIRES ATTENTION ⚠️{RESET}")
    print(f"{BOLD}======================================================================{RESET}\n")

    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    main()
