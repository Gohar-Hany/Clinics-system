"""
Clinic Clock — every "now" / "today" in the system goes through here so the
clinic's local time is used even when the server runs in UTC (Railway, Docker).
"""

from datetime import datetime, date
from functools import lru_cache
from zoneinfo import ZoneInfo

from app.config import get_settings


@lru_cache
def clinic_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().CLINIC_TIMEZONE)


def clinic_now() -> datetime:
    """Current clinic-local time as a naive datetime (matches stored HH:MM strings)."""
    return datetime.now(clinic_tz()).replace(tzinfo=None)


def clinic_today() -> date:
    return clinic_now().date()


def clinic_today_str() -> str:
    return clinic_today().strftime("%Y-%m-%d")
