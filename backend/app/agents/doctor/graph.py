"""
Doctor Assistant Agent — LangGraph Subgraph Compilation.
"""

from langgraph.graph import StateGraph, START, END
from app.agents.doctor.state import DoctorAssistantState
from app.agents.doctor.nodes import clinical_consultation_node


def create_doctor_subgraph() -> StateGraph:
    """Create the Doctor Assistant LangGraph subgraph."""
    graph = StateGraph(DoctorAssistantState)

    # Add clinical analysis node
    graph.add_node("clinical_analysis", clinical_consultation_node)

    # Simple pipeline: START -> clinical_analysis -> END
    graph.add_edge(START, "clinical_analysis")
    graph.add_edge("clinical_analysis", END)

    return graph


doctor_subgraph = create_doctor_subgraph().compile()
