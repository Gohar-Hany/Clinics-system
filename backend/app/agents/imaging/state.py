"""Imaging Agent — LangGraph State Schema."""

from typing import TypedDict, Literal, Annotated
from langgraph.graph.message import add_messages


class ImagingState(TypedDict):
    """State for the Imaging (VLM) Subgraph."""
    # Conversation
    messages: Annotated[list, add_messages]

    # Context
    clinic_id: str
    patient_id: str | None
    patient_phone: str | None
    intent: str | None
    current_agent: str
    error: str | None

    # Imaging-specific
    consultation_id: str
    image_url: str                       # Supabase Storage URL
    image_type: str                      # xray, mri, ct, ultrasound
    clinical_context: str | None         # Doctor's notes
    vlm_analysis: dict | None            # VLM raw output
    findings: list[dict] | None          # Structured findings
    search_results: list[dict] | None    # Literature after VLM (Tavily)
    doctor_review: str | None            # Doctor's final review (HITL)
    analysis_status: Literal[
        "uploaded",
        "analyzing",
        "searching_literature",
        "awaiting_review",
        "reviewed",
        "saved",
    ] | None
