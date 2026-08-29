"""
Clinic AI System — FastAPI Application Entry Point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.v1.router import api_router
from app.services.redis_client import redis_service
from app.core.checkpointer import init_checkpointer

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown events."""
    settings = get_settings()

    # --- Startup ---
    # Initialize Redis connection
    await redis_service.connect(settings.REDIS_URL)

    # Initialize LangGraph checkpointer (PostgresSaver)
    await init_checkpointer(settings.SYNC_DATABASE_URL)

    logger.info(f"{settings.APP_NAME} v{settings.APP_VERSION} started")
    logger.info(f"LangSmith tracing: {'enabled' if settings.LANGCHAIN_TRACING_V2 else 'disabled'}")

    yield

    # --- Shutdown ---
    await redis_service.disconnect()
    logger.info("Clinic system shutdown complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-Powered Clinic Management System with LangGraph Agents",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Healthcheck endpoints for Railway / Cloud monitoring
    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "service": settings.APP_NAME,
        }

    @app.get("/", tags=["System"])
    async def root():
        return {
            "message": f"Welcome to {settings.APP_NAME} API v{settings.APP_VERSION}",
            "docs": "/docs",
            "health": "/health",
        }

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
