"""API v1 Router — Aggregates all endpoint routers."""

from fastapi import APIRouter

from app.api.v1.chat import router as chat_router
from app.api.v1.queue import router as queue_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.doctor import router as doctor_router

api_router = APIRouter()

# Health check
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "clinic-ai-backend",
    }

# Phase 1 routes
api_router.include_router(chat_router, prefix="/chat", tags=["Chat"])
api_router.include_router(queue_router, prefix="/queue", tags=["Queue"])
api_router.include_router(appointments_router, prefix="/appointments", tags=["Appointments"])

# Phase 2 routes — Doctor Assistant, Audio Consultation, SOAP Notes, Smart Rx, and Imaging VLM
api_router.include_router(doctor_router, prefix="/doctor", tags=["Doctor Assistant"])
