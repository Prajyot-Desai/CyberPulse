"""Security tests verifying credentials never leak in API responses, logs, or representations."""

import logging
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.core.config import Settings
from app.core.logging import SensitiveDataFilter
from app.main import create_app
from app.services.radar_service import RadarService, get_radar_service


@pytest.mark.asyncio
async def test_credentials_never_in_api_responses() -> None:
    """Verify that sensitive API tokens are never leaked in any HTTP response payload."""
    secret_token = "cf-super-confidential-token-XYZ12345"
    test_settings = Settings(
        CLOUDFLARE_API_TOKEN=SecretStr(secret_token),
        CLOUDFLARE_API_BASE_URL="https://api.cloudflare.com/client/v4/radar",
    )

    app = create_app()
    # Override settings dependency
    app.dependency_overrides[get_radar_service] = lambda: RadarService(settings=test_settings)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Test /health
        res_health = await client.get("/health")
        assert secret_token not in res_health.text

        # Test /api/v1/radar/status
        res_status = await client.get("/api/v1/radar/status")
        assert secret_token not in res_status.text

        # Test /api/v1/radar/overview
        res_overview = await client.get("/api/v1/radar/overview")
        assert secret_token not in res_overview.text


def test_sensitive_data_filter_masks_logs() -> None:
    """Verify SensitiveDataFilter redacts Bearer tokens and token params from logs."""
    filt = SensitiveDataFilter()
    secret = "secret-token-abcdef123"

    # Test Bearer header redaction
    record1 = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg=f"Sending request with Bearer {secret} to Cloudflare",
        args=(),
        exc_info=None,
    )
    filt.filter(record1)
    assert secret not in record1.msg
    assert "Bearer [REDACTED]" in record1.msg

    # Test param redaction
    record2 = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg=f"Configured with token={secret}",
        args=(),
        exc_info=None,
    )
    filt.filter(record2)
    assert secret not in record2.msg
    assert "token=[REDACTED]" in record2.msg


def test_settings_masks_secret_token() -> None:
    """Verify pydantic SecretStr masks secret in str and repr."""
    secret = "my-private-key-777"
    settings = Settings(CLOUDFLARE_API_TOKEN=SecretStr(secret))

    assert secret not in str(settings)
    assert secret not in repr(settings)
