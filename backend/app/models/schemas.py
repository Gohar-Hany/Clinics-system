"""
Pydantic schemas — Request/Response models for the API.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time, datetime

from app.models.enums import (
    AppointmentStatus,
    ConsultationStatus,
    ImagingStatus,
    Gender,
)


# ╔══════════════════════════════════════════╗
# ║            Chat / Booking                ║
# ╚══════════════════════════════════════════╝

class ChatRequest(BaseModel):
    """Patient chat message request."""
    message: str = Field(..., min_length=1, max_length=2000)
    patient_phone: Optional[str] = Field(None, pattern=r"^01[0-9]{9}$")
    clinic_id: str
    thread_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Agent chat response."""
    response: str
    thread_id: str
    intent: Optional[str] = None
    data: Optional[dict] = None  # Extra data (appointment details, queue info, etc.)


# ╔══════════════════════════════════════════╗
# ║            Appointments                  ║
# ╚══════════════════════════════════════════╝

class AppointmentCreate(BaseModel):
    clinic_id: str
    doctor_id: str
    patient_id: str
    appointment_date: date
    start_time: time
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: str
    clinic_id: str
    doctor_id: str
    patient_id: str
    appointment_date: date
    start_time: time
    end_time: Optional[time] = None
    status: AppointmentStatus
    queue_number: Optional[int] = None
    checked_in_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class AppointmentStatusUpdate(BaseModel):
    """Update appointment status (check-in, start, complete, cancel, no-show)."""
    status: AppointmentStatus


# ╔══════════════════════════════════════════╗
# ║            Queue                         ║
# ╚══════════════════════════════════════════╝

class QueuePositionResponse(BaseModel):
    """Queue position and ETA for a patient."""
    queue_number: int
    current_serving: int
    patients_ahead: int
    total_in_queue: int
    avg_consultation_minutes: int
    estimated_wait_minutes: int


class QueueStateResponse(BaseModel):
    """Full queue state for dashboard."""
    entries: list[dict]
    current_serving: int
    total: int
    avg_consultation_minutes: int


# ╔══════════════════════════════════════════╗
# ║           Consultation                   ║
# ╚══════════════════════════════════════════╝

class ConsultationAnalyzeRequest(BaseModel):
    """Request to analyze a recorded consultation."""
    appointment_id: str
    audio_url: str
    patient_id: str
    doctor_id: str
    clinic_id: str


class ConsultationReviewRequest(BaseModel):
    """Doctor's review of AI suggestions."""
    consultation_id: str
    selected_medications: list[dict]
    doctor_notes: Optional[str] = None
    instructions: Optional[str] = None


class ConsultationResponse(BaseModel):
    id: str
    appointment_id: str
    transcript: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_suggestions: Optional[list[dict]] = None
    diagnosis: Optional[dict] = None
    doctor_notes: Optional[str] = None
    status: ConsultationStatus
    created_at: datetime


# ╔══════════════════════════════════════════╗
# ║           Imaging                        ║
# ╚══════════════════════════════════════════╝

class ImagingAnalyzeRequest(BaseModel):
    """Request to analyze a medical image."""
    consultation_id: str
    image_url: str
    image_type: str = "xray"
    clinical_context: Optional[str] = None


class ImagingReviewRequest(BaseModel):
    """Doctor's review of imaging AI analysis."""
    imaging_id: str
    doctor_review: str


class ImagingResponse(BaseModel):
    id: str
    image_url: str
    image_type: str
    ai_analysis: Optional[dict] = None
    ai_findings: Optional[list[dict]] = None
    doctor_review: Optional[str] = None
    status: ImagingStatus
    created_at: datetime


# ╔══════════════════════════════════════════╗
# ║            Patients                      ║
# ╚══════════════════════════════════════════╝

class PatientCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r"^01[0-9]{9}$")
    clinic_id: str
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None


class PatientResponse(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    created_at: datetime


# ╔══════════════════════════════════════════╗
# ║            Prescription                  ║
# ╚══════════════════════════════════════════╝

class MedicationItem(BaseModel):
    """Single medication in a prescription."""
    brand_name: str
    generic_name: Optional[str] = None
    dosage: str
    frequency: str
    duration: str
    form: Optional[str] = None  # tablet, capsule, syrup, etc.
    notes: Optional[str] = None
    normalized: bool = False  # Whether drug DB verified


class PrescriptionResponse(BaseModel):
    id: str
    consultation_id: str
    patient_id: str
    doctor_id: str
    medications: list[MedicationItem]
    instructions: Optional[str] = None
    drugs_normalized: bool
    status: str
    created_at: datetime


# ╔══════════════════════════════════════════╗
# ║            Auth (MVP)                    ║
# ╚══════════════════════════════════════════╝

class ClinicTokenRequest(BaseModel):
    """Clinic portal token validation."""
    token: str


class ClinicTokenResponse(BaseModel):
    valid: bool
    clinic_id: Optional[str] = None
    role: Optional[str] = None  # "doctor" or "reception"
