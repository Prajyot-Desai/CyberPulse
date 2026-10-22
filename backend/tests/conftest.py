"""Deterministic Pytest fixtures and mock Cloudflare Radar response payloads."""

from typing import AsyncGenerator, Dict, Any
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app

# ------------------------------------------------------------------------------
# Mock Data Payloads (Strictly adhering to Cloudflare Radar API format)
# ------------------------------------------------------------------------------
MOCK_L3_TIMESERIES: Dict[str, Any] = {
    "success": True,
    "errors": [],
    "messages": [],
    "result": {
        "timestamps": ["2026-10-20T00:00:00Z", "2026-10-20T01:00:00Z"],
        "values": ["120.5", "340.2"],
        "meta": {"aggInterval": "1h"},
    },
}

MOCK_L7_TIMESERIES: Dict[str, Any] = {
    "success": True,
    "errors": [],
    "messages": [],
    "result": {
        "serie_0": {
            "timestamps": ["2026-10-20T00:00:00Z", "2026-10-20T01:00:00Z"],
            "values": [50.0, 75.5],
        },
        "meta": {"aggInterval": "1h"},
    },
}

MOCK_TOP_TARGETS: Dict[str, Any] = {
    "success": True,
    "errors": [],
    "messages": [],
    "result": {
        "top_0": [
            {
                "clientCountryAlpha2": "US",
                "clientCountryName": "United States",
                "value": "45.50",
            },
            {
                "clientCountryAlpha2": "DE",
                "clientCountryName": "Germany",
                "value": "12.30",
            },
        ],
        "meta": {"normalization": "PERCENTAGE"},
    },
}

MOCK_TOP_ORIGINS: Dict[str, Any] = {
    "success": True,
    "errors": [],
    "messages": [],
    "result": {
        "top_0": [
            {
                "clientCountryAlpha2": "CN",
                "clientCountryName": "China",
                "value": "30.20",
            },
            {
                "clientCountryAlpha2": "BR",
                "clientCountryName": "Brazil",
                "value": "15.80",
            },
        ],
        "meta": {"normalization": "PERCENTAGE"},
    },
}

MOCK_PROTOCOLS: Dict[str, Any] = {
    "success": True,
    "errors": [],
    "messages": [],
    "result": {
        "protocol": [
            {"metric": "UDP", "value": "62.5"},
            {"metric": "TCP", "value": "35.1"},
            {"metric": "ICMP", "value": "2.4"},
        ],
        "meta": {},
    },
}


# ------------------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------------------
@pytest.fixture
def mock_configured_settings() -> Settings:
    """Return Settings configured with a test secret token."""
    return Settings(
        CLOUDFLARE_API_TOKEN=SecretStr("mock-secret-cf-token-998877"),
        CLOUDFLARE_API_BASE_URL="https://api.cloudflare.com/client/v4/radar",
        CACHE_TTL_SECONDS=10,
        RADAR_MAX_RETRIES=2,
    )


@pytest.fixture
def mock_unconfigured_settings() -> Settings:
    """Return Settings without a valid token."""
    return Settings(
        CLOUDFLARE_API_TOKEN=None,
        CLOUDFLARE_API_BASE_URL="https://api.cloudflare.com/client/v4/radar",
        CACHE_TTL_SECONDS=10,
    )


@pytest.fixture
async def async_app_client() -> AsyncGenerator[AsyncClient, None]:
    """Yield an AsyncClient for testing the FastAPI application without a real server."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
