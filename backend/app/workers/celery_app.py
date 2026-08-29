"""
Celery application configuration.
Uses Redis as broker and result backend.
"""

from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "clinic_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

# Celery configuration
celery_app.conf.update(
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="Africa/Cairo",
    enable_utc=True,

    # Task settings
    task_track_started=True,
    task_time_limit=600,        # 10 minutes max per task
    task_soft_time_limit=540,   # Soft limit at 9 minutes

    # Worker settings
    worker_prefetch_multiplier=1,   # One task at a time per worker
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (memory leak prevention)

    # Result settings
    result_expires=3600,  # Results expire after 1 hour
)
