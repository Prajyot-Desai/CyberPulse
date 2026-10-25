"""Deterministic unit and integration tests for sliding-window rate limiting and proxy IP resolution."""

import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from app.core.config import Settings
from app.core.rate_limit import (
    RateLimitMiddleware,
    SlidingWindowRateLimiter,
    resolve_client_ip,
)
from app.main import create_app


class FakeRequest:
    """Lightweight test double for starlette.datastructures.Request."""

    def __init__(self, client_host: str, headers: dict = None):
        class Client:
            def __init__(self, host: str):
                self.host = host

        self.client = Client(client_host)
        self.headers = headers or {}


def test_resolve_client_ip_without_trusted_proxies_ignores_forwarded_for():
    """Verify that when no trusted proxies are configured, X-Forwarded-For is strictly ignored."""
    req = FakeRequest("198.51.100.24", {"x-forwarded-for": "203.0.113.195, 10.0.0.1"})
    assert resolve_client_ip(req, trusted_proxies=[]) == "198.51.100.24"


def test_resolve_client_ip_with_untrusted_direct_peer_ignores_forwarded_for():
    """Verify that an untrusted direct peer cannot spoof client identity via X-Forwarded-For."""
    req = FakeRequest("198.51.100.24", {"x-forwarded-for": "203.0.113.195"})
    assert resolve_client_ip(req, trusted_proxies=["127.0.0.1", "10.0.0.0/8"]) == "198.51.100.24"


def test_resolve_client_ip_with_trusted_proxy_resolves_real_client():
    """Verify that a trusted proxy IP allows safe right-to-left resolution of the client IP."""
    # Direct peer is trusted 10.0.0.1 -> XFF hop 203.0.113.195 is real client
    req = FakeRequest("10.0.0.1", {"x-forwarded-for": "203.0.113.195"})
    assert resolve_client_ip(req, trusted_proxies=["10.0.0.0/8"]) == "203.0.113.195"

    # Multi-hop proxy chain: Client -> Untrusted intermediary -> Trusted Proxy 2 -> Trusted Proxy 1 (Direct)
    req_multihop = FakeRequest(
        "10.0.0.1",
        {"x-forwarded-for": "192.0.2.1, 198.51.100.5, 10.0.0.2"},
    )
    # 10.0.0.1 is trusted; 10.0.0.2 is in 10.0.0.0/8 (trusted); 198.51.100.5 is first untrusted
    assert resolve_client_ip(req_multihop, trusted_proxies=["10.0.0.0/8"]) == "198.51.100.5"


@pytest.mark.asyncio
async def test_sliding_window_rate_limiter_allowed_and_exceeded():
    """Verify that limiter allows requests up to limit and rejects subsequent requests with Retry-After."""
    current_time = 1000.0

    def mock_clock() -> float:
        return current_time

    limiter = SlidingWindowRateLimiter(
        requests_per_minute=3,
        window_seconds=60.0,
        time_func=mock_clock,
    )

    # First 3 requests granted
    ok, retry = await limiter.acquire("client-a")
    assert ok is True and retry == 0

    ok, retry = await limiter.acquire("client-a")
    assert ok is True and retry == 0

    ok, retry = await limiter.acquire("client-a")
    assert ok is True and retry == 0

    # 4th request in same second rejected with 60s retry
    ok, retry = await limiter.acquire("client-a")
    assert ok is False
    assert retry == 60


@pytest.mark.asyncio
async def test_sliding_window_expiration_with_controllable_clock():
    """Verify that advancing clock past window resets allowance deterministically without sleep."""
    current_time = 2000.0

    def mock_clock() -> float:
        return current_time

    limiter = SlidingWindowRateLimiter(
        requests_per_minute=2,
        window_seconds=60.0,
        time_func=mock_clock,
    )

    assert (await limiter.acquire("client-1"))[0] is True
    current_time += 10.0
    assert (await limiter.acquire("client-1"))[0] is True

    # Limit reached
    ok, retry = await limiter.acquire("client-1")
    assert ok is False
    # Oldest was at 2000.0, so retry after 2000.0 + 60.0 - 2010.0 = 50.0
    assert retry == 50

    # Advance clock past the first request's expiration (2000 + 60 = 2060; advance to 2061)
    current_time = 2061.0

    # First slot has expired, one slot is now available
    ok, retry = await limiter.acquire("client-1")
    assert ok is True
    assert retry == 0


@pytest.mark.asyncio
async def test_independent_clients_tracked_separately():
    """Verify that throttling one client does not impact a different client."""
    current_time = 3000.0

    limiter = SlidingWindowRateLimiter(
        requests_per_minute=1,
        window_seconds=60.0,
        time_func=lambda: current_time,
    )

    # Client A consumes quota
    assert (await limiter.acquire("192.168.1.10"))[0] is True
    assert (await limiter.acquire("192.168.1.10"))[0] is False

    # Client B should still be allowed
    assert (await limiter.acquire("192.168.1.20"))[0] is True
    assert (await limiter.acquire("192.168.1.20"))[0] is False


@pytest.mark.asyncio
async def test_memory_pruning_inactive_clients():
    """Verify that inactive clients are pruned to prevent unbounded memory growth."""
    current_time = 4000.0

    def mock_clock() -> float:
        return current_time

    limiter = SlidingWindowRateLimiter(
        requests_per_minute=5,
        window_seconds=60.0,
        max_tracked_clients=5,
        time_func=mock_clock,
    )

    # Register 3 clients
    await limiter.acquire("c1")
    await limiter.acquire("c2")
    await limiter.acquire("c3")
    assert limiter.tracked_clients_count() == 3

    # Advance clock past 60s
    current_time += 65.0

    # Next acquire triggers prune of inactive clients
    await limiter.acquire("c4")
    # c1, c2, c3 were older than cutoff -> pruned; only c4 tracked
    assert limiter.tracked_clients_count() == 1


@pytest.mark.asyncio
async def test_concurrency_parallel_requests_cannot_bypass_limit():
    """Verify that concurrent parallel requests are atomic and cannot bypass limit."""
    limiter = SlidingWindowRateLimiter(
        requests_per_minute=5,
        window_seconds=60.0,
    )

    # Run 20 concurrent acquire attempts
    results = await asyncio.gather(*(limiter.acquire("concurrent-client") for _ in range(20)))

    allowed_count = sum(1 for is_allowed, _ in results if is_allowed)
    rejected_count = sum(1 for is_allowed, _ in results if not is_allowed)

    assert allowed_count == 5
    assert rejected_count == 15


def test_rate_limit_middleware_integration_and_health_exemption():
    """Verify middleware throttles /api/v1 endpoints, returns 429 with Retry-After, and exempts health probes."""
    clock_time = 1000.0

    def mock_clock() -> float:
        return clock_time

    limiter = SlidingWindowRateLimiter(
        requests_per_minute=2,
        window_seconds=60.0,
        time_func=mock_clock,
    )

    settings = Settings(
        FRONTEND_DIST_DIR="none",
        BACKEND_RATE_LIMIT_PER_MINUTE=2,
    )
    app = create_app(settings=settings, rate_limiter=limiter)
    client = TestClient(app)

    # 1. First 2 requests to an API route succeed
    r1 = client.get("/api/v1/radar/status")
    assert r1.status_code == 200

    r2 = client.get("/api/v1/radar/status")
    assert r2.status_code == 200

    # 2. 3rd request receives 429 Too Many Requests
    r3 = client.get("/api/v1/radar/status")
    assert r3.status_code == 429
    assert "Retry-After" in r3.headers
    assert r3.json()["detail"] == "Too Many Requests"

    # 3. Health probes are EXEMPT and still return 200 even after limit reached
    health_v1 = client.get("/api/v1/health")
    assert health_v1.status_code == 200
    assert health_v1.json()["status"] == "ok"

    health_root = client.get("/health")
    assert health_root.status_code == 200
    assert health_root.json()["status"] == "ok"

    # 4. Advance clock by 61s: rate limit window resets
    clock_time += 61.0
    r4 = client.get("/api/v1/radar/status")
    assert r4.status_code == 200
