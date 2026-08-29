"""
Security — MVP Passwordless Auth
- Patient: Phone-based identification
- Clinic: Secret path + config token
"""

from fastapi import HTTPException, Header, Request, status
from app.config import get_settings


async def verify_clinic_token(
    x_clinic_token: str = Header(..., alias="X-Clinic-Token"),
) -> bool:
    """
    Verify clinic access token from request header.
    MVP: Simple token comparison (upgrade to JWT later).
    """
    settings = get_settings()
    if x_clinic_token != settings.CLINIC_CONFIG_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid clinic access token",
        )
    return True


async def verify_clinic_path(
    request: Request,
    secret_path: str,
) -> bool:
    """
    Verify the clinic secret path from the URL.
    MVP: Simple path comparison.
    """
    settings = get_settings()
    if secret_path != settings.CLINIC_SECRET_PATH:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )
    return True
