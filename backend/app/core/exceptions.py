"""Custom exceptions for the Clinic AI System."""

from fastapi import HTTPException, status


class SlotAlreadyBookedException(HTTPException):
    """Raised when a slot is already taken during concurrent booking."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="الموعد ده اتحجز خلاص. اختار موعد تاني.",
        )


class PatientNotFoundException(HTTPException):
    """Raised when patient is not found."""

    def __init__(self, phone: str = ""):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"مفيش مريض مسجل بالرقم {phone}" if phone else "المريض مش موجود",
        )


class AppointmentNotFoundException(HTTPException):
    """Raised when appointment is not found."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الموعد مش موجود",
        )


class ConsultationNotFoundException(HTTPException):
    """Raised when consultation is not found."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكشف مش موجود",
        )


class DrugNotRecognizedException(Exception):
    """Raised when a drug name can't be matched in local DB."""

    def __init__(self, drug_name: str):
        self.drug_name = drug_name
        super().__init__(f"لم يتم التعرف على الدواء: {drug_name}")


class LockAcquisitionFailedException(Exception):
    """Raised when distributed lock cannot be acquired."""

    def __init__(self, resource: str):
        self.resource = resource
        super().__init__(f"Failed to acquire lock for: {resource}")
