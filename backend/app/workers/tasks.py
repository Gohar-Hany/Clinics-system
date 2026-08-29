"""
Celery tasks — Background processing for:
- Audio transcription (Phase 2)
- Medical analysis (Phase 2)
- Imaging VLM analysis (Phase 3)
"""

from app.workers.celery_app import celery_app


@celery_app.task(bind=True, name="consultation_analysis")
def consultation_analysis_task(
    self,
    audio_url: str,
    appointment_id: str,
    patient_id: str,
    doctor_id: str,
    clinic_id: str,
    consultation_id: str,
) -> dict:
    """
    Phase 2: Full consultation analysis pipeline.
    1. Download audio from Supabase Storage
    2. Transcribe (Google STT / Whisper)
    3. Run Doctor LangGraph agent (analyze → search → suggest)
    4. Update consultation record in Supabase
    5. Trigger Realtime notification
    """
    # TODO: Implement in Phase 2
    self.update_state(state="PROCESSING", meta={"step": "transcribing"})
    return {"status": "not_implemented", "phase": 2}


@celery_app.task(bind=True, name="imaging_analysis")
def imaging_analysis_task(
    self,
    image_url: str,
    consultation_id: str,
    image_type: str,
    clinical_context: str | None,
    imaging_id: str,
) -> dict:
    """
    Phase 3: Medical imaging analysis pipeline.
    1. Load image from Supabase Storage URL
    2. Run Imaging LangGraph agent (VLM → search → save)
    3. Update imaging record in Supabase
    4. Trigger Realtime notification
    """
    # TODO: Implement in Phase 3
    self.update_state(state="PROCESSING", meta={"step": "analyzing"})
    return {"status": "not_implemented", "phase": 3}
