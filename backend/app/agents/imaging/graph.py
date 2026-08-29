"""
Imaging Agent — LangGraph Subgraph Compilation.
"""

from langgraph.graph import StateGraph, START, END
from app.agents.imaging.state import ImagingState
from app.agents.imaging.nodes import analyze_medical_image_node


def create_imaging_subgraph() -> StateGraph:
    """Create the Medical Imaging VLM LangGraph subgraph."""
    graph = StateGraph(ImagingState)

    # Add imaging analysis node
    graph.add_node("vlm_analysis", analyze_medical_image_node)

    # Pipeline: START -> vlm_analysis -> END
    graph.add_edge(START, "vlm_analysis")
    graph.add_edge("vlm_analysis", END)

    return graph


imaging_subgraph = create_imaging_subgraph().compile()
