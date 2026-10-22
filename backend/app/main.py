"""CyberPulse FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.health import router as root_health_router
from app.api.v1.router import api_v1_router
from app.clients.cloudflare import CloudflareRadarClient
from app.core.config import get_settings
from app.core.logging import logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycle."""
    settings = get_settings()
    setup_logging(settings.LOG_LEVEL)

    configured_msg = "Configured" if settings.is_cloudflare_configured else "Unconfigured (Running in standalone/test mode)"
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION} "
        f"[Env: {settings.ENVIRONMENT}, Cloudflare: {configured_msg}]"
    )

    yield

    logger.info("Shutting down CyberPulse backend...")
    # Clean up singleton client if initialized
    default_client = CloudflareRadarClient(settings=settings)
    await default_client.close()


def create_app() -> FastAPI:
    """Application factory configuring middleware, routes, and lifespan."""
    settings = get_settings()

    app = FastAPI(
        title="CyberPulse — Global DDoS Intelligence API",
        version=settings.APP_VERSION,
        description=(
            "Production-quality backend service normalizing aggregated Cloudflare Radar "
            "DDoS intelligence for the CyberPulse 3D visualization dashboard."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Root health endpoint (standard for Kubernetes/load-balancers)
    app.include_router(root_health_router)

    # API v1 routes
    app.include_router(api_v1_router)

    return app


app = create_app()
