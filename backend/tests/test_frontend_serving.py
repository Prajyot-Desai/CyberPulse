"""Tests for unified frontend static file and client SPA routing in FastAPI."""

from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import Settings
from app.main import create_app, resolve_frontend_dist


@pytest.mark.asyncio
async def test_frontend_dist_resolution_and_spa_serving() -> None:
    """Verify that when frontend dist is present, root and SPA routes serve index.html."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Root / serves index.html if dist exists
        dist_dir = resolve_frontend_dist()
        if dist_dir and (dist_dir / "index.html").is_file():
            res_root = await client.get("/")
            assert res_root.status_code == 200
            assert "text/html" in res_root.headers.get("content-type", "")
            assert "<!DOCTYPE html>" in res_root.text or "<html" in res_root.text

            # 2. Client SPA routes (e.g. /analytics, /threats) fall back to index.html
            res_spa = await client.get("/analytics")
            assert res_spa.status_code == 200
            assert "text/html" in res_spa.headers.get("content-type", "")

            # 3. Missing static assets return 404, NOT the SPA index.html
            res_missing_asset = await client.get("/assets/missing-bundle-999.js")
            assert res_missing_asset.status_code == 404
            assert "<!DOCTYPE html>" not in res_missing_asset.text

        # 4. Critical API routes must never be intercepted by SPA fallback
        res_health = await client.get("/health")
        assert res_health.status_code == 200
        assert res_health.json()["status"] == "ok"

        res_v1_health = await client.get("/api/v1/health")
        assert res_v1_health.status_code == 200
        assert res_v1_health.json()["status"] == "ok"

        # 5. Missing API endpoints return 404 JSON, NOT index.html
        res_missing_api = await client.get("/api/v1/unknown_endpoint")
        assert res_missing_api.status_code == 404
        assert res_missing_api.headers.get("content-type", "").startswith("application/json")
        assert res_missing_api.json() == {"detail": "Not Found"}


def test_settings_port_adaptation() -> None:
    """Verify Settings resolves PORT environment variable over default BACKEND_PORT."""
    # Default without PORT
    s_default = Settings()
    assert s_default.BACKEND_PORT == 8000

    # With PORT injected (e.g. Render / Cloud Run)
    s_injected = Settings(PORT=10000)
    assert s_injected.BACKEND_PORT == 10000
    assert s_injected.PORT == 10000


@pytest.mark.asyncio
async def test_api_only_mode_when_dist_absent(tmp_path: Path) -> None:
    """Verify backend operates safely in API-only mode when static dist directory is absent."""
    nonexistent = tmp_path / "nonexistent_dist"
    settings = Settings(FRONTEND_DIST_DIR=str(nonexistent))

    app = create_app(settings=settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # API endpoints work
        res_health = await client.get("/health")
        assert res_health.status_code == 200

        # In API-only mode without dist, root returns 404
        res_root = await client.get("/")
        assert res_root.status_code == 404
