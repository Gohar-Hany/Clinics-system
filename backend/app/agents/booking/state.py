"""Booking Agent — LangGraph State Schema."""

from typing import TypedDict, Literal, Annotated
from langgraph.graph.message import add_messages


class BookingState(TypedDict):
    """State for the Booking Subgraph."""
    # Conversation
    messages: Annotated[list, add_messages]

    # Context
    clinic_id: str
    patient_id: str | None
    patient_phone: str | None
    intent: str | None
    current_agent: str
    error: str | None

    # Booking-specific
    doctor_id: str | None
    requested_date: str | None
    requested_time: str | None
    available_slots: list[dict] | None
    selected_slot: dict | None
    appointment_id: str | None
    queue_number: int | None
    lock_acquired: bool
    booking_status: Literal[
        "idle",
        "checking_availability",
        "locking_slot",
        "slot_selected",
        "confirming",
        "confirmed",
        "failed",
        "slot_taken",
    ] | None
