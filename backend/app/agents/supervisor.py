"""
Supervisor Agent — Main LangGraph entry point.
Routes patient messages to the appropriate subgraph based on intent detection.
Retains patient phone context across multi-turn conversations.
"""

import re
from typing import Literal
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END, START

from app.agents.booking.state import BookingState
from app.agents.booking.nodes import (
    booking_agent_node,
    booking_tool_node,
    should_continue as booking_should_continue,
    extract_phone,
)
from app.config import get_settings
from app.core.checkpointer import get_checkpointer


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


def get_compiled_graph():
    """Get compiled supervisor graph with checkpointer."""
    graph = create_supervisor_graph()
    checkpointer = get_checkpointer()
    return graph.compile(checkpointer=checkpointer)


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

    # Invoke the graph
    result = await compiled_graph.ainvoke(input_state, config=config)

    # Extract the last AI message with text content
    response_text = ""
    messages = result.get("messages", [])
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if getattr(msg, "type", None) == "ai" or hasattr(msg, "tool_calls"):
            if content and isinstance(content, str) and content.strip():
                response_text = content.strip()
                break

    if not response_text and messages:
        last = messages[-1]
        response_text = getattr(last, "content", str(last))

    # Look for tool results in state or messages
    queue_number = result.get("queue_number")
    appointment_id = result.get("appointment_id")
    final_phone = result.get("patient_phone") or active_phone

    for msg in reversed(messages):
        if getattr(msg, "type", None) == "tool" and hasattr(msg, "content"):
            try:
                import json
                tool_data = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                if isinstance(tool_data, dict):
                    if "queue_number" in tool_data and not queue_number:
                        queue_number = tool_data["queue_number"]
                    if "appointment_id" in tool_data and not appointment_id:
                        appointment_id = tool_data["appointment_id"]
                    if "patient_phone" in tool_data and not final_phone:
                        final_phone = tool_data["patient_phone"]
            except Exception:
                pass

    return {
        "response": response_text,
        "thread_id": thread_id,
        "intent": result.get("intent"),
        "patient_id": result.get("patient_id"),
        "patient_phone": final_phone,
        "appointment_id": appointment_id,
        "queue_number": queue_number,
    }
