"""In-memory sliding-window rate limiter with safe proxy IP resolution."""

import asyncio
from collections import deque
import ipaddress
import math
import time
from typing import Callable, Deque, Dict, List, Optional, Sequence, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


def is_ip_in_network(ip_str: str, network_or_ip: str) -> bool:
    """Check if an IP string matches a specific IP or CIDR network string."""
    try:
        ip = ipaddress.ip_address(ip_str.strip())
        net = ipaddress.ip_network(network_or_ip.strip(), strict=False)
        return ip in net
    except ValueError:
        return ip_str.strip() == network_or_ip.strip()


def resolve_client_ip(request: Request, trusted_proxies: Optional[Sequence[str]] = None) -> str:
    """
    Safely resolve the client IP address.

    Never blindly trusts arbitrary client-supplied X-Forwarded-For headers.
    Proxy headers are only parsed when the direct peer IP (request.client.host)
    matches a configured trusted proxy or network.
    """
    direct_ip = request.client.host if request.client else "127.0.0.1"

    # If no trusted proxies are configured, direct peer IP is the only safe identifier
    if not trusted_proxies:
        return direct_ip

    # Check if direct connection originates from a trusted proxy
    is_direct_trusted = any(is_ip_in_network(direct_ip, proxy) for proxy in trusted_proxies)
    if not is_direct_trusted:
        return direct_ip

    # Direct connection is trusted: inspect X-Forwarded-For right-to-left
    forwarded_for = request.headers.get("x-forwarded-for")
    if not forwarded_for:
        return direct_ip

    raw_hops = [hop.strip() for hop in forwarded_for.split(",") if hop.strip()]
    if not raw_hops:
        return direct_ip

    # Traverse hops right-to-left (from proxy nearest to server backwards)
    for hop in reversed(raw_hops):
        is_trusted = any(is_ip_in_network(hop, proxy) for proxy in trusted_proxies)
        if not is_trusted:
            # First untrusted hop is the authentic client IP
            return hop

    # If all hops in XFF are in trusted networks, return the leftmost hop
    return raw_hops[0]


class SlidingWindowRateLimiter:
    """
    Thread-safe and async-aware in-memory sliding-window rate limiter.

    NOTE: This limiter maintains state in process memory and applies per-process.
    In multi-worker or multi-container deployments, each instance enforces its own
    rate limit window. For horizontally scaled distributed deployments, a shared store
    (such as Redis) is required.
    """

    def __init__(
        self,
        requests_per_minute: int = 60,
        window_seconds: float = 60.0,
        max_tracked_clients: int = 10000,
        time_func: Optional[Callable[[], float]] = None,
    ):
        self.requests_per_minute = max(1, requests_per_minute)
        self.window_seconds = max(1.0, float(window_seconds))
        self.max_tracked_clients = max_tracked_clients
        self._time_func = time_func if time_func is not None else time.monotonic
        self._clients: Dict[str, Deque[float]] = {}
        self._lock = asyncio.Lock()
        self._last_prune: float = self._time_func()

    def _prune_inactive(self, now: float) -> None:
        """Evict clients with no activity within the current sliding window."""
        cutoff = now - self.window_seconds
        expired_keys = [
            cid
            for cid, history in self._clients.items()
            if not history or history[-1] < cutoff
        ]
        for cid in expired_keys:
            del self._clients[cid]
        self._last_prune = now

    async def acquire(self, client_id: str) -> Tuple[bool, int]:
        """
        Attempt to acquire a rate limit slot for the given client identifier.

        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        async with self._lock:
            now = self._time_func()

            # Periodic or capacity-triggered cleanup to prevent unbounded memory growth
            if (
                now - self._last_prune > 30.0
                or len(self._clients) >= self.max_tracked_clients
            ):
                self._prune_inactive(now)

            history = self._clients.get(client_id)
            if history is None:
                history = deque()
                self._clients[client_id] = history

            cutoff = now - self.window_seconds

            # Slide window: pop timestamps older than window cutoff
            while history and history[0] <= cutoff:
                history.popleft()

            if len(history) >= self.requests_per_minute:
                # Limit exceeded: calculate retry-after based on oldest entry in window
                oldest_entry = history[0]
                retry_after = max(1, int(math.ceil(oldest_entry + self.window_seconds - now)))
                return False, retry_after

            # Slot granted: record timestamp
            history.append(now)
            return True, 0

    def clear(self) -> None:
        """Clear all client tracking data."""
        self._clients.clear()
        self._last_prune = self._time_func()

    def tracked_clients_count(self) -> int:
        """Return the number of currently tracked client identifiers."""
        return len(self._clients)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware applying sliding-window rate limiting to /api/v1/* endpoints.
    Health check endpoints (/api/v1/health and /health) are exempt.
    """

    def __init__(
        self,
        app,
        limiter: SlidingWindowRateLimiter,
        trusted_proxies: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.limiter = limiter
        self.trusted_proxies = trusted_proxies or []

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # 1. Exempt all non-API paths (static assets, root health, docs, SPA)
        if not path.startswith("/api/v1/"):
            return await call_next(request)

        # 2. Exempt API health endpoint so monitoring/probes remain available
        if path.rstrip("/") == "/api/v1/health":
            return await call_next(request)

        # 3. Resolve client IP securely
        client_ip = resolve_client_ip(request, self.trusted_proxies)

        # 4. Check rate limiter
        allowed, retry_after = await self.limiter.acquire(client_ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too Many Requests",
                    "retry_after": retry_after,
                    "message": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                },
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)
