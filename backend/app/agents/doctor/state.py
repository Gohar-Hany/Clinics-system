"""Doctor Assistant Agent — LangGraph State Schema."""

from typing import TypedDict, Literal, Annotated
from langgraph.graph.message import add_messages


class DoctorAssistantState(TypedDict):
    """
    State for the Doctor Assistant Subgraph.
    ⚠️ NO binary data — URLs only to prevent state bloat.
    """
    # Conversation
    messages: Annotated[list, add_messages]

    # Context
    clinic_id: str
    patient_id: str | None
    patient_phone: str | None
    intent: str | None
    current_agent: str
    error: str | None

    # Doctor-specific
    appointment_id: str
    audio_storage_url: str               # URL only (NOT bytes)
    transcript: str | None               # Filled by Celery worker
    symptoms_extracted: list[str] | None
    patient_history: dict | None
    ai_analysis: dict | None
    search_results: list[dict] | None    # Tavily search results
    treatment_suggestions: list[dict] | None
    doctor_decision: dict | None         # Doctor's choice (HITL)
    normalized_medications: list[dict] | None  # After Drug DB lookup
    prescription: dict | None
    consultation_status: Literal[
        "audio_uploaded",
        "transcribing",
        "analyzing",
        "searching",
        "suggesting",
        "awaiting_review",
        "normalizing_drugs",
        "prescribing",
        "completed",
    ] | None
