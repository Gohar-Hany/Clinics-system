"""
OpenRouter LLM Client — Gateway to multiple AI models.
Supports model switching via config for different agents.
"""

from openai import AsyncOpenAI
from app.config import get_settings


def get_openrouter_client() -> AsyncOpenAI:
    """Create an OpenRouter-compatible AsyncOpenAI client."""
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
    )


def get_booking_model() -> str:
    """Get the model ID for the booking agent."""
    return get_settings().BOOKING_MODEL


def get_doctor_model() -> str:
    """Get the model ID for the doctor assistant agent."""
    return get_settings().DOCTOR_MODEL


def get_imaging_model() -> str:
    """Get the model ID for the imaging VLM agent."""
    return get_settings().IMAGING_MODEL
