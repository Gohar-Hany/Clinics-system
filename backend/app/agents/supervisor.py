"""
Supervisor Agent — Main LangGraph entry point.
Routes patient messages to the appropriate subgraph based on intent detection.
Retains patient phone context across multi-turn conversations.
"""

import json
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, END, START

from app.agents.booking.state import BookingState
from app.agents.booking.nodes import (
    booking_agent_node,
    booking_tool_node,
    should_continue as booking_should_continue,
    extract_phone,
)
from app.agents.booking.tools import DOCTOR_ID
from app.core.checkpointer import RedisBackedMemorySaver, get_checkpointer
from app.services.redis_client import redis_service
from app.services.appointment_service import appointment_service


SupervisorState = BookingState


async def detect_intent(state: SupervisorState) -> dict:
    """
    Detect user intent from the latest message and preserve patient phone.
    """
    # 1. Search for phone in state and all messages
    patient_phone = state.get("patient_phone")
    if not patient_phone:
        for msg in reversed(state.get("messages", [])):
            if hasattr(msg, "content") and isinstance(msg.content, str):
                extracted = extract_phone(msg.content)
                if extracted:
                    patient_phone = extracted
                    break

    result = {"intent": "booking", "current_agent": "booking"}
    if patient_phone:
        result["patient_phone"] = patient_phone

    if not state.get("messages") or len(state["messages"]) <= 1:
        return result

    last_message = state["messages"][-1]

    # Quick keyword-based intent detection
    if hasattr(last_message, "content") and isinstance(last_message.content, str):
        content = last_message.content.lower()

        # Queue check keywords
        queue_keywords = ["طابور", "دور", "فاضل", "مكاني", "مستني", "انتظار", "queue", "position", "wait"]
        if any(kw in content for kw in queue_keywords):
            result["intent"] = "queue_check"
            return result

        # Cancel keywords
        cancel_keywords = ["الغ", "إلغاء", "كنسل", "cancel", "مش عايز"]
        if any(kw in content for kw in cancel_keywords):
            result["intent"] = "cancel"
            return result

        # Reschedule keywords
        reschedule_keywords = ["غير", "تغيير", "أغير", "اغير", "reschedule", "change"]
        if any(kw in content for kw in reschedule_keywords):
            result["intent"] = "reschedule"
            return result

    return result


def route_to_subgraph(state: SupervisorState) -> str:
    """Route to the appropriate subgraph based on detected intent."""
    return "booking_agent"


# ╔══════════════════════════════════════════════╗
# ║         Build the Main Graph                 ║
# ╚══════════════════════════════════════════════╝

def create_supervisor_graph() -> StateGraph:
    """Create the main Supervisor graph."""
    graph = StateGraph(SupervisorState)

    # Add nodes
    graph.add_node("detect_intent", detect_intent)
    graph.add_node("booking_agent", booking_agent_node)
    graph.add_node("tools", booking_tool_node)

    # Entry point
    graph.add_edge(START, "detect_intent")

    # Route from intent detection to subgraph
    graph.add_conditional_edges(
        "detect_intent",
        route_to_subgraph,
        {
            "booking_agent": "booking_agent",
        },
    )

    # Booking agent → tools or end
    graph.add_conditional_edges(
        "booking_agent",
        booking_should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )
    graph.add_edge("tools", "booking_agent")

    return graph


_compiled_graph = None
_compiled_for = None


def get_compiled_graph():
    """Compiled supervisor graph, built once per checkpointer instance."""
    global _compiled_graph, _compiled_for
    checkpointer = get_checkpointer()
    if _compiled_graph is None or _compiled_for is not checkpointer:
        _compiled_graph = create_supervisor_graph().compile(checkpointer=checkpointer)
        _compiled_for = checkpointer
    return _compiled_graph


async def extract_turn_data(turn_messages: list) -> dict:
    """
    Structured data for the chat UI, taken ONLY from this turn's tool results
    (offered slots, a confirmed booking, a cancellation).
    """
    data: dict = {}
    for msg in turn_messages:
        if getattr(msg, "type", None) != "tool":
            continue
        try:
            result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
        except (TypeError, ValueError):
            continue
        if not isinstance(result, dict) or not result.get("success"):
            continue

        name = getattr(msg, "name", "")
        if name == "check_availability" and result.get("total_available") and not result.get("requested_time_available"):
            # Buttons only when the patient still has to choose (no time yet, or the asked time is taken)
            # The model only saw a few suggestions; the UI gets every free slot as a button.
            full = await appointment_service.get_available_slots(DOCTOR_ID, result["date"])
            data["slots"] = {
                "date": result.get("date"),
                "day_label": result.get("day_label"),
                "options": [{"time": s["time"], "label": s["formatted"]} for s in full.get("available_slots", [])],
            }
        elif name == "propose_booking":
            data.pop("slots", None)
            data["proposal"] = {
                "patient_name": result.get("patient_name"),
                "patient_phone": result.get("patient_phone"),
                "date": result.get("date"),
                "time": result.get("time"),
                "day_label": result.get("day_label"),
                "time_label": result.get("time_label"),
                "queue_number": result.get("queue_number"),
            }
        elif name in ("confirm_booking", "reschedule_appointment") and result.get("appointment_id"):
            data.pop("slots", None)
            data.pop("proposal", None)
            data["booking"] = {
                "reference_code": result.get("reference_code"),
                "queue_number": result.get("queue_number"),
                "date": result.get("date"),
                "time": result.get("time"),
                "day_label": result.get("day_label"),
                "time_label": result.get("time_label"),
                "patient_name": result.get("patient_name"),
                "patient_phone": result.get("patient_phone"),
                "rescheduled": name == "reschedule_appointment",
            }
            # Backwards-compatible flat fields
            data["appointment_id"] = result.get("appointment_id")
            data["queue_number"] = result.get("queue_number")
        elif name == "cancel_appointment":
            data["cancelled"] = {"date": result.get("date"), "time": result.get("time")}
    return data


# ╔══════════════════════════════════════════════╗
# ║         Invoke the Agent                     ║
# ╚══════════════════════════════════════════════╝

async def invoke_agent(
    message: str,
    thread_id: str,
    clinic_id: str,
    patient_phone: str | None = None,
    patient_id: str | None = None,
) -> dict:
    """Invoke the supervisor agent with a user message."""
    compiled_graph = get_compiled_graph()

    # Extract phone from message if provided
    extracted_phone = extract_phone(message)
    active_phone = patient_phone or extracted_phone

    # Config for checkpointing
    config = {
        "configurable": {
            "thread_id": thread_id,
        }
    }

    # Input state — Only set non-null fields so we don't overwrite preserved state
    input_state = {
        "messages": [HumanMessage(content=message)],
        "clinic_id": clinic_id,
        "current_agent": "supervisor",
        "lock_acquired": False,
    }
    if active_phone:
        input_state["patient_phone"] = active_phone
    if patient_id:
        input_state["patient_id"] = patient_id

    # Serverless hosts recycle the process between requests: restore / persist this
    # conversation through Redis when one is available.
    saver = get_checkpointer()
    persist = isinstance(saver, RedisBackedMemorySaver) and not redis_service.is_memory
    if persist:
        await saver.load_thread(redis_service.client, thread_id)

    # Invoke the graph
    result = await compiled_graph.ainvoke(input_state, config=config)

    if persist:
        await saver.save_thread(redis_service.client, thread_id)

    messages = result.get("messages", [])

    # This turn = everything after the latest human message
    last_human = max((i for i, m in enumerate(messages) if getattr(m, "type", None) == "human"), default=-1)
    turn_messages = messages[last_human + 1:]

    response_text = ""
    for msg in reversed(turn_messages):
        content = getattr(msg, "content", "")
        if getattr(msg, "type", None) == "ai" and isinstance(content, str) and content.strip():
            response_text = content.strip()
            break
    if not response_text:
        response_text = "معلش، حصلت لخبطة بسيطة. ممكن تقولي تاني حضرتك محتاج إيه؟"

    return {
        "response": response_text,
        "thread_id": thread_id,
        "intent": result.get("intent"),
        "patient_phone": result.get("patient_phone") or active_phone,
        **(await extract_turn_data(turn_messages)),
    }
