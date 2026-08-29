"""Status enums for the Clinic System."""

from enum import Enum


class AppointmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    CHECKED_IN = "checked_in"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class ConsultationStatus(str, Enum):
    PROCESSING = "processing"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    SEARCHING = "searching"
    SUGGESTING = "suggesting"
    AWAITING_REVIEW = "awaiting_review"
    NORMALIZING_DRUGS = "normalizing_drugs"
    PRESCRIBING = "prescribing"
    COMPLETED = "completed"


class ImagingStatus(str, Enum):
    UPLOADED = "uploaded"
    ANALYZING = "analyzing"
    SEARCHING_LITERATURE = "searching_literature"
    AWAITING_REVIEW = "awaiting_review"
    REVIEWED = "reviewed"
    SAVED = "saved"


class PrescriptionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DISPENSED = "dispensed"
    CANCELLED = "cancelled"


class ChatStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"


class ImageType(str, Enum):
    XRAY = "xray"
    MRI = "mri"
    CT = "ct"
    ULTRASOUND = "ultrasound"
    OTHER = "other"


class AgentIntent(str, Enum):
    BOOKING = "booking"
    QUEUE_CHECK = "queue_check"
    RESCHEDULE = "reschedule"
    CANCEL = "cancel"
    CONSULTATION = "consultation"
    IMAGING = "imaging"
    GENERAL = "general"
