"""
Booking Subgraph — LangGraph StateGraph for appointment booking.
"""

from langgraph.graph import StateGraph, END

from app.agents.booking.state import BookingState
from app.agents.booking.nodes import (
    booking_agent_node,
    booking_tool_node,
    should_continue,
)


def create_booking_graph() -> StateGraph:
    """
    Create the Booking Subgraph.

    Flow:
    1. booking_agent → LLM processes message and decides action
    2. tools → Execute tool calls (check_availability, create_appointment, etc.)
    3. Loop back to booking_agent until LLM responds without tool calls
    """
    graph = StateGraph(BookingState)

    # Add nodes
    graph.add_node("booking_agent", booking_agent_node)
    graph.add_node("tools", booking_tool_node)

    # Set entry point
    graph.set_entry_point("booking_agent")

    # Add edges
    graph.add_conditional_edges(
        "booking_agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )
    graph.add_edge("tools", "booking_agent")

    return graph


# Compiled booking subgraph (without checkpointer — managed by parent)
booking_subgraph = create_booking_graph().compile()
