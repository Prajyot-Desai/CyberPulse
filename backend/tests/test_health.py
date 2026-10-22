"""Tests for backend health check endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health_endpoint(async_app_client: AsyncClient) -> None:
    """Verify GET /health returns 200 OK and valid health payload without credentials."""
    response = await async_app_client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "cyberpulse-backend"
    assert "version" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_v1_health_endpoint(async_app_client: AsyncClient) -> None:
    """Verify GET /api/v1/health also works as a versioned alias."""
    response = await async_app_client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "cyberpulse-backend"
