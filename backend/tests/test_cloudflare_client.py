"""Tests for asynchronous CloudflareRadarClient error handling and retries."""

import httpx
import pytest
import respx
from app.clients.cloudflare import (
    CloudflareAuthError,
    CloudflareRadarClient,
    CloudflareRateLimitError,
    CloudflareResponseError,
    CloudflareUpstreamError,
)
from app.core.config import Settings
from tests.conftest import MOCK_L3_TIMESERIES


@pytest.mark.asyncio
@respx.mock
async def test_client_success(mock_configured_settings: Settings) -> None:
    """Verify successful request sends authorization header and returns payload."""
    route = respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(200, json=MOCK_L3_TIMESERIES))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    data = await client.get_layer3_timeseries()

    assert data["success"] is True
    assert route.called
    auth_header = route.calls.last.request.headers.get("Authorization")
    assert auth_header == "Bearer mock-secret-cf-token-998877"
    await client.close()


@pytest.mark.asyncio
async def test_client_missing_token_raises_auth_error(
    mock_unconfigured_settings: Settings,
) -> None:
    """Verify unconfigured token raises CloudflareAuthError immediately without network calls."""
    client = CloudflareRadarClient(settings=mock_unconfigured_settings)
    with pytest.raises(CloudflareAuthError) as exc_info:
        await client.get_layer3_timeseries()
    assert "token is not configured" in str(exc_info.value)
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_auth_failure_does_not_retry(
    mock_configured_settings: Settings,
) -> None:
    """Verify 401 Unauthorized raises CloudflareAuthError immediately without retrying."""
    route = respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(401, json={"success": False, "errors": [{"message": "Invalid token"}]}))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    with pytest.raises(CloudflareAuthError):
        await client.get_layer3_timeseries()

    # Must be called exactly once; auth failures are permanent and should not retry
    assert route.call_count == 1
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_rate_limiting_429(mock_configured_settings: Settings) -> None:
    """Verify 429 Too Many Requests raises CloudflareRateLimitError with parsed Retry-After."""
    respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(429, headers={"Retry-After": "45"}))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    with pytest.raises(CloudflareRateLimitError) as exc_info:
        await client.get_layer3_timeseries()

    assert exc_info.value.retry_after == 45
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_server_error_retries_and_raises(
    mock_configured_settings: Settings,
) -> None:
    """Verify 500 Internal Server Error retries according to RADAR_MAX_RETRIES."""
    route = respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(500, text="Internal Server Error"))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    with pytest.raises(CloudflareUpstreamError):
        await client.get_layer3_timeseries()

    # Initial attempt (1) + retries (2) = 3 calls
    assert route.call_count == 3
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_malformed_json_response(
    mock_configured_settings: Settings,
) -> None:
    """Verify non-JSON response raises CloudflareResponseError."""
    respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(200, text="<!DOCTYPE html><html>Gateway timeout</html>"))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    with pytest.raises(CloudflareResponseError):
        await client.get_layer3_timeseries()
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_failure_envelope(mock_configured_settings: Settings) -> None:
    """Verify 200 with success=false raises CloudflareResponseError."""
    respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries"
    ).mock(return_value=httpx.Response(200, json={"success": False, "errors": [{"message": "Invalid dateRange"}]}))

    client = CloudflareRadarClient(settings=mock_configured_settings)
    with pytest.raises(CloudflareResponseError) as exc_info:
        await client.get_layer3_timeseries()
    assert "Cloudflare returned failure envelope" in str(exc_info.value)
    await client.close()


@pytest.mark.asyncio
@respx.mock
async def test_client_get_layer3_summary_protocol_endpoint(
    mock_configured_settings: Settings,
) -> None:
    """Verify get_layer3_summary_protocol targets the documented /summary/PROTOCOL endpoint."""
    route = respx.get(
        "https://api.cloudflare.com/client/v4/radar/attacks/layer3/summary/PROTOCOL"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "errors": [],
                "messages": [],
                "result": {
                    "summary_0": {"UDP": "65.0", "TCP": "30.0"},
                    "meta": {},
                },
            },
        )
    )

    client = CloudflareRadarClient(settings=mock_configured_settings)
    data = await client.get_layer3_summary_protocol(date_range="7d")

    assert data["success"] is True
    assert route.called
    assert route.calls.last.request.url.params["dateRange"] == "7d"
    assert route.calls.last.request.url.params["format"] == "json"
    await client.close()
