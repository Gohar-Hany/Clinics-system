"""
Clinic System — Application Configuration
Uses Pydantic BaseSettings for environment variable management.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # === App ===
    APP_NAME: str = "Clinic AI System"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # === Database ===
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/clinic"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/clinic"

    # === Redis ===
    REDIS_URL: str = "redis://redis:6379/0"
    QUEUE_KEY_PREFIX: str = "queue"
    LOCK_KEY_PREFIX: str = "lock"
    LOCK_TTL_SECONDS: int = 30

    # === Supabase ===
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # === OpenRouter (LLM Gateway) ===
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    BOOKING_MODEL: str = "google/gemini-2.0-flash-001"
    DOCTOR_MODEL: str = "openai/gpt-4o"
    IMAGING_MODEL: str = "google/gemini-2.0-flash-001"

    # === Speech-to-Text ===
    GROQ_API_KEY: str = ""
    GOOGLE_CLOUD_STT_CREDENTIALS: str = ""
    OPENAI_API_KEY: str = ""

    # === Tavily Search ===
    TAVILY_API_KEY: str = ""

    # === LangSmith ===
    LANGSMITH_API_KEY: str = ""
    LANGCHAIN_TRACING_V2: bool = True
    LANGCHAIN_PROJECT: str = "clinic-system"

    # === Clinic Auth (MVP — Passwordless) ===
    CLINIC_SECRET_PATH: str = "my-clinic"
    CLINIC_CONFIG_TOKEN: str = "change-me-in-production"

    # === Queue Settings ===
    DEFAULT_AVG_CONSULTATION_MINUTES: int = 20
    QUEUE_ROLLING_AVG_COUNT: int = 20
    QUEUE_SYNC_INTERVAL_SECONDS: int = 60

    # === Celery ===
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    model_config = {
        "env_file": (".env", "../.env", "../../.env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
