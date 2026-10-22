"""API endpoints for retrieving Cloudflare Radar DDoS metrics and operational status."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query
from app.models.radar import RadarOverviewResponse, RadarStatusResponse
from app.services.radar_service import RadarService, get_radar_service

router = APIRouter(prefix="/radar", tags=["Radar Intelligence"])


@router.get(
    "/overview",
    response_model=RadarOverviewResponse,
    summary="Aggregated DDoS Overview",
    description=(
        "Retrieves normalized DDoS attack statistics from Cloudflare Radar. "
        "Returns fresh cached data, or gracefully falls back to stale/unavailable if upstream fails."
    ),
)
async def get_radar_overview(
    date_range: Annotated[
        str,
        Query(
            alias="dateRange",
            pattern=r"^(1d|7d|14d|30d)$",
            description="Aggregation observation window (1d, 7d, 14d, 30d)",
        ),
    ] = "7d",
    service: RadarService = Depends(get_radar_service),
) -> RadarOverviewResponse:
    """Retrieve normalized macroscopic DDoS attack intelligence."""
    return await service.get_overview(date_range=date_range)


@router.get(
    "/status",
    response_model=RadarStatusResponse,
    summary="Upstream Configuration & Cache Status",
    description="Reports upstream configuration status, cache metrics, and last sync timestamp without leaking secrets.",
)
async def get_radar_status(
    service: RadarService = Depends(get_radar_service),
) -> RadarStatusResponse:
    """Return upstream readiness and cache health."""
    return service.get_status()
