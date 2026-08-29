"""
Chat endpoint — Patient booking chat via LangGraph Supervisor Agent.
"""

import uuid
from fastapi import APIRouter

from app.models.schemas import ChatRequest, ChatResponse
from app.agents.supervisor import invoke_agent

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest) -> ChatResponse:
    """
    Process a patient chat message through the LangGraph Supervisor Agent.

    Flow:
    1. Identify/create conversation thread
    2. Invoke LangGraph supervisor with thread_id (checkpointed)
    3. Agent detects intent → routes to subgraph → executes tools
    4. Return agent response with metadata

    The supervisor routes to the appropriate subgraph:
    - booking → Booking Subgraph (check availability, book, cancel, reschedule)
    - queue_check → Queue tools (get position, ETA)
    - general → General response
    """
    # Generate or reuse thread_id for conversation continuity
    thread_id = request.thread_id or str(uuid.uuid4())

    try:
        # Invoke the LangGraph agent
        result = await invoke_agent(
            message=request.message,
            thread_id=thread_id,
            clinic_id=request.clinic_id,
            patient_phone=request.patient_phone,
        )

        return ChatResponse(
            response=result["response"],
            thread_id=thread_id,
            intent=result.get("intent"),
            data={
                k: v for k, v in result.items()
                if k not in ("response", "thread_id", "intent") and v is not None
            } or None,
        )

    except Exception as e:
        # Graceful error handling
        return ChatResponse(
            response=f"عفواً، حصلت مشكلة تقنية. حاول تاني بعد شوية. 🙏",
            thread_id=thread_id,
            intent="error",
            data={"error": str(e)},
        )
