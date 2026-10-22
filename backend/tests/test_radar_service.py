"""Tests for RadarService normalization, caching, stale fallback, and unavailable states."""

from typing import Any, Dict
import httpx
import pytest
import respx
from app.clients.cloudflare import CloudflareRadarClient
from app.core.cache import InMemoryTTLCache
from app.core.config import Settings
from app.models.radar import DataStatus
from app.services.radar_service import RadarService
from tests.conftest import (
    MOCK_L3_TIMESERIES,
    MOCK_L7_TIMESERIES,
    MOCK_PROTOCOLS,
    MOCK_TOP_ORIGINS,
    MOCK_TOP_TARGETS,
)


def mock_all_radar_routes() -> Dict[str, respx.Route]:
    """Helper to mock all 5 standard Radar endpoints."""
    base = "https://api.cloudflare.com/client/v4/radar"
    return {
        "l3": respx.get(f"{base}/attacks/layer3/timeseries").mock(
            return_value=httpx.Response(200, json=MOCK_L3_TIMESERIES)
        ),
        "l7": respx.get(f"{base}/attacks/layer7/timeseries").mock(
            return_value=httpx.Response(200, json=MOCK_L7_TIMESERIES)
        ),
        "target": respx.get(f"{base}/attacks/layer3/top/locations/target").mock(
            return_value=httpx.Response(200, json=MOCK_TOP_TARGETS)
        ),
        "origin": respx.get(f"{base}/attacks/layer3/top/locations/origin").mock(
            return_value=httpx.Response(200, json=MOCK_TOP_ORIGINS)
        ),
        "protocol": respx.get(f"{base}/attacks/layer3/summary/protocol").mock(
            return_value=httpx.Response(200, json=MOCK_PROTOCOLS)
        ),
    }


@pytest.mark.asyncio
async def test_unconfigured_radar_service(mock_unconfigured_settings: Settings) -> None:
    """Verify service returns unconfigured status when no token is supplied."""
    cache = InMemoryTTLCache()
    service = RadarService(cache_instance=cache, settings=mock_unconfigured_settings)

    overview = await service.get_overview()
    assert overview.status == DataStatus.UNCONFIGURED
    assert overview.metrics is None
    assert "token is not configured" in (overview.warning or "")

    status = service.get_status()
    assert status.upstream_configured is False


@pytest.mark.asyncio
@respx.mock
async def test_successful_normalization_and_caching(
    mock_configured_settings: Settings,
) -> None:
    """Verify upstream data is fetched, normalized correctly, and cached."""
    routes = mock_all_radar_routes()
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    service = RadarService(cache_instance=cache, settings=mock_configured_settings)

    # First fetch: should call upstream
    overview = await service.get_overview(date_range="7d")
    assert overview.status == DataStatus.FRESH
    assert overview.is_stale is False
    assert overview.metrics is not None

    # Check timeseries normalization
    assert len(overview.metrics.layer3_timeseries) == 2
    assert overview.metrics.layer3_timeseries[0].value == 120.5
    assert len(overview.metrics.layer7_timeseries) == 2
    assert overview.metrics.layer7_timeseries[1].value == 75.5

    # Check country normalization
    assert len(overview.metrics.top_target_countries) == 2
    assert overview.metrics.top_target_countries[0].country_code == "US"
    assert overview.metrics.top_target_countries[0].percentage == 45.5

    assert len(overview.metrics.top_origin_countries) == 2
    assert overview.metrics.top_origin_countries[0].country_code == "CN"
    assert overview.metrics.top_origin_countries[0].percentage == 30.2

    # Check protocol normalization
    assert len(overview.metrics.protocols) == 3
    assert overview.metrics.protocols[0].protocol == "UDP"
    assert overview.metrics.protocols[0].percentage == 62.5

    # Second fetch: cache hit (no additional upstream requests)
    overview_2 = await service.get_overview(date_range="7d")
    assert overview_2.status == DataStatus.FRESH
    assert routes["l3"].call_count == 1
    assert cache.stats()["hits"] >= 1


@pytest.mark.asyncio
@respx.mock
async def test_stale_cache_fallback_on_upstream_failure(
    mock_configured_settings: Settings,
) -> None:
    """Verify service returns stale cached data if upstream fails after cache expires."""
    base = "https://api.cloudflare.com/client/v4/radar"
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    service = RadarService(cache_instance=cache, settings=mock_configured_settings)

    # 1. Populate cache with an expired entry (TTL=0)
    mock_all_radar_routes()
    fresh = await service.get_overview(date_range="7d")
    # Manually store as expired in cache
    cache.set("radar_overview_7d", fresh, ttl_seconds=0)

    # 2. Reset routes to return 500 error
    respx.clear()
    respx.get(f"{base}/attacks/layer3/timeseries").mock(
        return_value=httpx.Response(500, text="Cloudflare downstream issue")
    )
    respx.get(f"{base}/attacks/layer7/timeseries").mock(
        return_value=httpx.Response(500, text="Cloudflare downstream issue")
    )
    respx.get(f"{base}/attacks/layer3/top/locations/target").mock(
        return_value=httpx.Response(500, text="Cloudflare downstream issue")
    )
    respx.get(f"{base}/attacks/layer3/top/locations/origin").mock(
        return_value=httpx.Response(500, text="Cloudflare downstream issue")
    )
    respx.get(f"{base}/attacks/layer3/summary/protocol").mock(
        return_value=httpx.Response(500, text="Cloudflare downstream issue")
    )

    # 3. Next fetch should fail upstream but return stale data
    stale_result = await service.get_overview(date_range="7d")
    assert stale_result.status == DataStatus.STALE
    assert stale_result.is_stale is True
    assert stale_result.metrics is not None
    assert "Serving cached data" in (stale_result.warning or "")


@pytest.mark.asyncio
@respx.mock
async def test_unavailable_when_upstream_fails_without_cache(
    mock_configured_settings: Settings,
) -> None:
    """Verify service returns unavailable status when upstream fails and no cached data exists."""
    base = "https://api.cloudflare.com/client/v4/radar"
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    service = RadarService(cache_instance=cache, settings=mock_configured_settings)

    # Mock all endpoints to fail
    respx.get(f"{base}/attacks/layer3/timeseries").mock(
        return_value=httpx.Response(500, text="Server Error")
    )
    respx.get(f"{base}/attacks/layer7/timeseries").mock(
        return_value=httpx.Response(500, text="Server Error")
    )
    respx.get(f"{base}/attacks/layer3/top/locations/target").mock(
        return_value=httpx.Response(500, text="Server Error")
    )
    respx.get(f"{base}/attacks/layer3/top/locations/origin").mock(
        return_value=httpx.Response(500, text="Server Error")
    )
    respx.get(f"{base}/attacks/layer3/summary/protocol").mock(
        return_value=httpx.Response(500, text="Server Error")
    )

    result = await service.get_overview(date_range="7d")
    assert result.status == DataStatus.UNAVAILABLE
    assert result.metrics is None
    assert "unavailable" in (result.warning or "").lower()
