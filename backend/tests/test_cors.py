"""Tests for CORS configuration, allow_credentials=False, and wildcard origins."""

from fastapi.testclient import TestClient
from app.core.config import Settings
from app.main import create_app


def test_cors_specific_allowed_origin():
    """Verify that configured origins receive proper CORS headers with allow_credentials=False."""
    settings = Settings(
        FRONTEND_DIST_DIR="none",
        BACKEND_CORS_ORIGINS="https://cyberpulse.example.com,http://localhost:5173",
    )
    app = create_app(settings=settings)
    client = TestClient(app)

    # Simple GET request with allowed origin
    res = client.get("/api/v1/health", headers={"Origin": "https://cyberpulse.example.com"})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://cyberpulse.example.com"
    # Credentials must be False for stateless token APIs
    assert res.headers.get("access-control-allow-credentials") is None

    # Preflight OPTIONS request
    opt = client.options(
        "/api/v1/health",
        headers={
            "Origin": "https://cyberpulse.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert opt.status_code == 200
    assert opt.headers.get("access-control-allow-origin") == "https://cyberpulse.example.com"
    assert opt.headers.get("access-control-allow-credentials") is None


def test_cors_wildcard_origin_without_startup_failure():
    """Verify that wildcard origin '*' boots cleanly without Starlette ValueError and returns wildcard header."""
    settings = Settings(
        FRONTEND_DIST_DIR="none",
        BACKEND_CORS_ORIGINS="*",
    )
    # create_app must not throw ValueError("Cannot use ['*'] for allow_origins with allow_credentials=True")
    app = create_app(settings=settings)
    client = TestClient(app)

    res = client.get("/api/v1/health", headers={"Origin": "https://any-arbitrary-client.com"})
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "*"
    assert res.headers.get("access-control-allow-credentials") is None


def test_cors_disallowed_origin_rejected():
    """Verify that origins not in the whitelist do not receive Access-Control-Allow-Origin."""
    settings = Settings(
        FRONTEND_DIST_DIR="none",
        BACKEND_CORS_ORIGINS="https://trusted.example.com",
    )
    app = create_app(settings=settings)
    client = TestClient(app)

    res = client.get("/api/v1/health", headers={"Origin": "https://malicious-site.com"})
    assert res.status_code == 200
    assert "access-control-allow-origin" not in res.headers
