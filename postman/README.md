# 📬 3eyadaty (عيادتي) — Postman API Collection & Environments

Complete professional Postman documentation adhering to the **Enterprise Postman Integration Standards (v2.1.0)**.

---

## 📁 Files Included

| File | Type | Description |
| :--- | :---: | :--- |
| [`3eyadaty_Clinic_API.postman_collection.json`](3eyadaty_Clinic_API.postman_collection.json) | Collection | Complete collection covering all system endpoints (Chat, Queue, Doctor AI, SOAP, Rx, VLM Imaging, Appointments). |
| [`3eyadaty_Production.postman_environment.json`](3eyadaty_Production.postman_environment.json) | Environment | Pre-configured variables for the Live Cloud API (`https://3eyadaty-api.up.railway.app`). |
| [`3eyadaty_Development.postman_environment.json`](3eyadaty_Development.postman_environment.json) | Environment | Pre-configured variables for Local Development (`http://localhost:8000`). |

---

## 🚀 How to Import into Postman (1-Click)

1. Open **Postman**.
2. Click **Import** (top left).
3. Drag and drop the `postman/` directory or select the 3 JSON files:
   - `3eyadaty_Clinic_API.postman_collection.json`
   - `3eyadaty_Production.postman_environment.json`
   - `3eyadaty_Development.postman_environment.json`
4. Select the environment: **`🏥 3eyadaty - Production (Railway Cloud)`** (top right dropdown).
5. Start testing!

---

## 🏛️ Collection Folder Structure

```
📁 🏥 3eyadaty (عيادتي) — Clinic AI System API
│
├── 📁 🏥 System Health
│   ├── 🔵 GET Health Check - Server Status (/health)
│   ├── 🔵 GET Root Welcome & API Info (/)
│   └── 🔵 GET OpenAPI JSON Schema (/openapi.json)
│
├── 📁 💬 AI Booking Chat Agent
│   ├── 🟢 POST Send Message - Inquire Available Slots
│   ├── 🟢 POST Send Message - Multi-turn Booking Confirmation
│   ├── 🟢 POST Send Message - Query Live Queue Position
│   ├── 🟢 POST Send Message - Reschedule Appointment
│   └── 🟢 POST Send Message - Cancel Appointment
│
├── 📁 ⏱️ Live Queue Operations
│   └── 📁 CRUD Operations
│       ├── 🔵 GET Live Queue Position by Appointment ID / Phone / Reference Code
│       ├── 🔵 GET Reception Full Queue State
│       ├── 🟢 POST Patient Arrival Check-In
│       ├── 🟢 POST Start Next Consultation
│       ├── 🟢 POST Complete Consultation & Recalculate ETA
│       └── 🔴 POST Skip / Cancel No-Show Patient
│
├── 📁 🩺 Doctor Assistant & Medical Co-Pilot
│   ├── 🟢 POST Analyze Audio Consultation (Whisper + SOAP Generator)
│   ├── 🟢 POST Analyze Text Consultation (Clinical Notes + SOAP Generator)
│   ├── 🟢 POST Analyze Medical Imaging (GPT-4o Multimodal VLM - XRay/MRI/CT/Lab)
│   ├── 🟢 POST Validate Prescription & Drug Interactions Guardrail
│   └── 🔵 GET Clinical Evidence-Based Guidelines Search
│
└── 📁 📅 Appointments Management
    ├── 📁 CRUD Operations
    │   ├── 🔵 GET List All Clinic Appointments
    │   ├── 🔵 GET Get Appointment by ID
    │   └── 🟠 PATCH Update Appointment Status
    │
    └── 📁 Query Operations
        ├── 🔎 GET Filter Appointments by Date
        ├── 🏷️ GET Filter Appointments by Doctor
        └── 🔍 GET Advanced Query - Date + Doctor Filter
```
