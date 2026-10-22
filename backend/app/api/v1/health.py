"""Health check endpoints for container and service monitoring."""

from fastapi import APIRouter
from app.models.radar import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns backend process status. Does not require Cloudflare authentication.",
)
async def get_health() -> HealthResponse:
    """Return operational health status."""
    return HealthResponse()
