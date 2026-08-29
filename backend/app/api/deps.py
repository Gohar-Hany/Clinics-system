"""
API Dependencies — Shared dependencies for route handlers.
"""

from fastapi import Depends, Header, HTTPException, status
from typing import Optional

from app.config import get_settings, Settings


async def get_current_settings() -> Settings:
    """Get application settings."""
    return get_settings()


async def verify_clinic_access(
    x_clinic_token: str = Header(None, alias="X-Clinic-Token"),
    settings: Settings = Depends(get_current_settings),
) -> dict:
    """
    Verify clinic access token.
    Returns clinic context if valid.

    MVP: Simple token comparison.
    Future: JWT with role-based access.
    """
    if not x_clinic_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing clinic access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if x_clinic_token != settings.CLINIC_CONFIG_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid clinic access token",
        )

    # MVP: Return basic clinic context
    return {
        "clinic_id": "default-clinic",  # TODO: Look up from DB
        "role": "admin",                # TODO: Role from token
    }


async def verify_patient_access(
    x_patient_phone: Optional[str] = Header(None, alias="X-Patient-Phone"),
) -> dict | None:
    """
    Identify patient by phone number.
    Returns patient context if phone provided.
    """
    if not x_patient_phone:
        return None

    return {
        "phone": x_patient_phone,
    }
