"""Tests for RadarService normalization, caching, stale fallback, and unavailable states."""

from typing import Any, Dict
import httpx
import pytest
import respx
from app.clients.cloudflare import CloudflareRadarClient
from app.core.cache import InMemoryTTLCache
from app.core.config import Settings
from app.models.radar import DataStatus, LocationMetric, ProtocolMetric
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
        "protocol": respx.get(f"{base}/attacks/layer3/summary/PROTOCOL").mock(
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
    respx.get(f"{base}/attacks/layer3/summary/PROTOCOL").mock(
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
    respx.get(f"{base}/attacks/layer3/summary/PROTOCOL").mock(
        return_value=httpx.Response(500, text="Server Error")
    )

    result = await service.get_overview(date_range="7d")
    assert result.status == DataStatus.UNAVAILABLE
    assert result.metrics is None
    assert "unavailable" in (result.warning or "").lower()


# ------------------------------------------------------------------------------
# Regression Tests for Cloudflare Radar Normalization
# ------------------------------------------------------------------------------
def test_normalize_target_locations_documented_fields() -> None:
    """Verify target locations parse targetCountryAlpha2, targetCountryName, rank, and numeric strings."""
    raw = {
        "success": True,
        "result": {
            "top_0": [
                {
                    "targetCountryAlpha2": "US",
                    "targetCountryName": "United States",
                    "value": "45.50",
                    "rank": 1,
                },
                {
                    "targetCountryAlpha2": "de",
                    "targetCountryName": "Germany",
                    "value": "12.30",
                    "rank": "2",
                },
            ]
        },
    }
    locations = RadarService._normalize_locations(raw)
    assert len(locations) == 2
    assert locations[0] == LocationMetric(
        country_code="US",
        country_name="United States",
        percentage=45.5,
        rank=1,
    )
    assert locations[1] == LocationMetric(
        country_code="DE",
        country_name="Germany",
        percentage=12.3,
        rank=2,
    )


def test_normalize_origin_locations_documented_fields() -> None:
    """Verify origin locations parse originCountryAlpha2, originCountryName, rank, and legacy aliases."""
    raw = {
        "success": True,
        "result": {
            "top_0": [
                {
                    "originCountryAlpha2": "cn",
                    "originCountryName": "China",
                    "value": "30.20",
                    "rank": 1,
                },
                {
                    "clientCountryAlpha2": "BR",
                    "clientCountryName": "Brazil",
                    "value": "15.80",
                    "rank": 2,
                },
                {
                    "clientISOAlpha2": "FR",
                    "countryName": "France",
                    "value": "8.10",
                    "rank": 3,
                },
            ]
        },
    }
    locations = RadarService._normalize_locations(raw)
    assert len(locations) == 3
    assert locations[0].country_code == "CN"
    assert locations[0].country_name == "China"
    assert locations[0].percentage == 30.2
    assert locations[0].rank == 1

    assert locations[1].country_code == "BR"
    assert locations[1].country_name == "Brazil"
    assert locations[1].percentage == 15.8
    assert locations[1].rank == 2

    assert locations[2].country_code == "FR"
    assert locations[2].country_name == "France"
    assert locations[2].percentage == 8.1
    assert locations[2].rank == 3


def test_normalize_locations_missing_fields_explicitly_unknown() -> None:
    """Verify missing country codes and names remain explicitly unknown rather than fabricated."""
    raw = {
        "success": True,
        "result": {
            "top_0": [
                {
                    "value": "10.0",
                },
                {
                    "targetCountryAlpha2": "",
                    "targetCountryName": "   ",
                    "value": "invalid_num",
                },
            ]
        },
    }
    locations = RadarService._normalize_locations(raw)
    assert len(locations) == 2
    # Missing fields should default to "XX" and "Unknown", rank is None, value defaults safely
    assert locations[0].country_code == "XX"
    assert locations[0].country_name == "Unknown"
    assert locations[0].percentage == 10.0
    assert locations[0].rank is None

    assert locations[1].country_code == "XX"
    assert locations[1].country_name == "Unknown"
    assert locations[1].percentage == 0.0
    assert locations[1].rank is None


def test_normalize_locations_top0_defensive_compatibility() -> None:
    """Verify defensive support for top0 without fabricating it as the official response shape."""
    raw = {
        "success": True,
        "result": {
            "top0": [
                {
                    "targetCountryAlpha2": "JP",
                    "targetCountryName": "Japan",
                    "value": "18.5",
                    "rank": 1,
                }
            ]
        },
    }
    locations = RadarService._normalize_locations(raw)
    assert len(locations) == 1
    assert locations[0].country_code == "JP"
    assert locations[0].country_name == "Japan"
    assert locations[0].percentage == 18.5
    assert locations[0].rank == 1


def test_normalize_protocols_summary_0_dictionary() -> None:
    """Verify protocol normalization from a dictionary under summary_0 with metadata excluded."""
    raw = {
        "success": True,
        "result": {
            "summary_0": {
                "udp": "65.0",
                "tcp": "30.0",
                "icmp": "5.0",
                "meta": {"dateRange": "7d"},
                "units": "PERCENTAGE",
            },
            "meta": {"aggInterval": "1h"},
        },
    }
    protocols = RadarService._normalize_protocols(raw)
    assert len(protocols) == 3
    proto_dict = {p.protocol: p.percentage for p in protocols}
    assert proto_dict["UDP"] == 65.0
    assert proto_dict["TCP"] == 30.0
    assert proto_dict["ICMP"] == 5.0
    assert "META" not in proto_dict
    assert "UNITS" not in proto_dict


def test_normalize_protocols_summary0_defensive_alias() -> None:
    """Verify defensive support for summary0 alias when summary_0 is absent."""
    raw = {
        "success": True,
        "result": {
            "summary0": {
                "gre": "12.34",
                "ipip": "3.21",
            }
        },
    }
    protocols = RadarService._normalize_protocols(raw)
    assert len(protocols) == 2
    proto_dict = {p.protocol: p.percentage for p in protocols}
    assert proto_dict["GRE"] == 12.34
    assert proto_dict["IPIP"] == 3.21


def test_normalize_protocols_numeric_string_conversion_and_percentage_semantics() -> None:
    """Verify numeric string conversion while preserving percentage semantics (not counts)."""
    raw = {
        "success": True,
        "result": {
            "summary_0": {
                "UDP": "65.4321",
                "TCP": 30.1,
                "ICMP": 4,
                "UNKNOWN_PROTO": "invalid_value",
            }
        },
    }
    protocols = RadarService._normalize_protocols(raw)
    assert len(protocols) == 3
    proto_dict = {p.protocol: p.percentage for p in protocols}
    assert proto_dict["UDP"] == 65.43
    assert proto_dict["TCP"] == 30.1
    assert proto_dict["ICMP"] == 4.0
    assert "UNKNOWN_PROTO" not in proto_dict


def test_empty_or_malformed_response_handling() -> None:
    """Verify empty, malformed, or unexpected response payloads are handled gracefully."""
    malformed_payloads = [
        None,
        {},
        {"result": None},
        {"result": "unexpected_string"},
        {"result": {"top_0": "not_a_list"}},
        {"result": {"top_0": [None, 123, "not_a_dict"]}},
    ]
    for payload in malformed_payloads:
        assert RadarService._normalize_locations(payload) == []

    malformed_proto_payloads = [
        None,
        {},
        {"result": None},
        {"result": "unexpected_string"},
        {"result": {"summary_0": None}},
        {"result": {"summary_0": "not_a_dict_or_list"}},
    ]
    for proto_payload in malformed_proto_payloads:
        assert RadarService._normalize_protocols(proto_payload) == []


@pytest.mark.asyncio
@respx.mock
async def test_successful_overview_with_documented_radar_shapes(
    mock_configured_settings: Settings,
) -> None:
    """End-to-end service test verifying integration with documented Cloudflare response shapes."""
    base = "https://api.cloudflare.com/client/v4/radar"
    cache = InMemoryTTLCache(default_ttl_seconds=60)
    service = RadarService(cache_instance=cache, settings=mock_configured_settings)

    respx.get(f"{base}/attacks/layer3/timeseries").mock(
        return_value=httpx.Response(200, json=MOCK_L3_TIMESERIES)
    )
    respx.get(f"{base}/attacks/layer7/timeseries").mock(
        return_value=httpx.Response(200, json=MOCK_L7_TIMESERIES)
    )
    # Documented target response using top_0 and targetCountryAlpha2/targetCountryName
    respx.get(f"{base}/attacks/layer3/top/locations/target").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "result": {
                    "top_0": [
                        {
                            "targetCountryAlpha2": "US",
                            "targetCountryName": "United States",
                            "value": "52.4",
                            "rank": 1,
                        }
                    ],
                    "meta": {},
                },
            },
        )
    )
    # Documented origin response using top_0 and originCountryAlpha2/originCountryName
    respx.get(f"{base}/attacks/layer3/top/locations/origin").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "result": {
                    "top_0": [
                        {
                            "originCountryAlpha2": "CN",
                            "originCountryName": "China",
                            "value": "41.8",
                            "rank": 1,
                        }
                    ],
                    "meta": {},
                },
            },
        )
    )
    # Documented PROTOCOL summary using summary_0 dictionary
    respx.get(f"{base}/attacks/layer3/summary/PROTOCOL").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "result": {
                    "summary_0": {
                        "UDP": "68.5",
                        "TCP": "28.3",
                    },
                    "meta": {},
                },
            },
        )
    )

    overview = await service.get_overview(date_range="7d")
    assert overview.status == DataStatus.FRESH
    assert overview.metrics is not None
    assert len(overview.metrics.top_target_countries) == 1
    assert overview.metrics.top_target_countries[0].country_code == "US"
    assert overview.metrics.top_target_countries[0].country_name == "United States"
    assert overview.metrics.top_target_countries[0].percentage == 52.4
    assert overview.metrics.top_target_countries[0].rank == 1

    assert len(overview.metrics.top_origin_countries) == 1
    assert overview.metrics.top_origin_countries[0].country_code == "CN"
    assert overview.metrics.top_origin_countries[0].country_name == "China"
    assert overview.metrics.top_origin_countries[0].percentage == 41.8
    assert overview.metrics.top_origin_countries[0].rank == 1

    assert len(overview.metrics.protocols) == 2
    proto_dict = {p.protocol: p.percentage for p in overview.metrics.protocols}
    assert proto_dict["UDP"] == 68.5
    assert proto_dict["TCP"] == 28.3
