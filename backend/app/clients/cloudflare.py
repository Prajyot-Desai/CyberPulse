"""Asynchronous Cloudflare Radar HTTP client using HTTPX with retries and error isolation."""

import asyncio
from typing import Any, Dict, Optional
import httpx

from app.core.config import Settings, get_settings
from app.core.logging import logger


# ------------------------------------------------------------------------------
# Exceptions
# ------------------------------------------------------------------------------
class CloudflareClientError(Exception):
    """Base exception for all Cloudflare Radar client failures."""


class CloudflareAuthError(CloudflareClientError):
    """Authentication or authorization failure (HTTP 401, 403). Permanent: do NOT retry."""


class CloudflareRateLimitError(CloudflareClientError):
    """Upstream rate limit exceeded (HTTP 429)."""

    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after


class CloudflareUpstreamError(CloudflareClientError):
    """Transient server error from Cloudflare (HTTP 5xx or connection timeout)."""


class CloudflareResponseError(CloudflareClientError):
    """Malformed JSON or unexpected envelope structure."""


# ------------------------------------------------------------------------------
# Client Implementation
# ------------------------------------------------------------------------------
class CloudflareRadarClient:
    """Asynchronous client interacting strictly with verified Cloudflare Radar API endpoints."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self.settings = settings or get_settings()
        self._external_client = http_client
        self._internal_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Provide existing or lazily-created HTTPX async client."""
        if self._external_client is not None:
            return self._external_client
        if self._internal_client is None or self._internal_client.is_closed:
            self._internal_client = httpx.AsyncClient(
                timeout=httpx.Timeout(self.settings.RADAR_REQUEST_TIMEOUT_SECONDS),
                limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
            )
        return self._internal_client

    async def close(self) -> None:
        """Close internal client connections."""
        if self._internal_client and not self._internal_client.is_closed:
            await self._internal_client.aclose()
            self._internal_client = None

    def _build_headers(self) -> Dict[str, str]:
        """Construct headers without exposing credentials to callers or unhandled logs."""
        token = self.settings.get_cloudflare_token()
        headers = {
            "Accept": "application/json",
            "User-Agent": f"CyberPulse-Backend/{self.settings.APP_VERSION}",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def _request(
        self,
        method: str,
        endpoint_path: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an HTTP request against Cloudflare Radar with selective retry logic.

        - Retries on network timeouts and HTTP 5xx.
        - Fails immediately without retry on 401, 403, 400.
        """
        token = self.settings.get_cloudflare_token()
        if not token:
            raise CloudflareAuthError(
                "Cloudflare API token is not configured or is using placeholder."
            )

        client = await self._get_client()
        url = f"{self.settings.CLOUDFLARE_API_BASE_URL.rstrip('/')}/{endpoint_path.lstrip('/')}"
        headers = self._build_headers()
        clean_params = {k: v for k, v in (params or {}).items() if v is not None}
        clean_params.setdefault("format", "json")

        max_retries = self.settings.RADAR_MAX_RETRIES
        attempt = 0

        while True:
            try:
                logger.debug(f"Requesting Cloudflare Radar: {method} {endpoint_path}")
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=clean_params,
                )

                # 1. Success check
                if response.status_code == 200:
                    try:
                        data = response.json()
                    except Exception as err:
                        raise CloudflareResponseError(
                            f"Failed to parse upstream JSON response: {err}"
                        ) from err

                    if not isinstance(data, dict):
                        raise CloudflareResponseError("Invalid upstream response: expected JSON object")

                    if not data.get("success", False):
                        errors = data.get("errors", [])
                        raise CloudflareResponseError(f"Cloudflare returned failure envelope: {errors}")

                    return data

                # 2. Authentication failures (DO NOT RETRY)
                if response.status_code in (401, 403):
                    logger.error(f"Cloudflare authentication failed with status {response.status_code}")
                    raise CloudflareAuthError(
                        f"Cloudflare authentication failed (HTTP {response.status_code}). Verify API token permissions."
                    )

                # 3. Rate limiting (DO NOT INDISCRIMINATELY RETRY)
                if response.status_code == 429:
                    retry_after_header = response.headers.get("Retry-After")
                    retry_after = int(retry_after_header) if retry_after_header and retry_after_header.isdigit() else 60
                    logger.warning(f"Cloudflare Radar rate limit reached (HTTP 429). Retry-After: {retry_after}s")
                    raise CloudflareRateLimitError(
                        "Upstream Cloudflare Radar rate limit exceeded.",
                        retry_after=retry_after,
                    )

                # 4. Server errors (HTTP 5xx - retryable)
                if response.status_code >= 500:
                    if attempt < max_retries:
                        attempt += 1
                        delay = 0.5 * (2 ** (attempt - 1))
                        logger.warning(
                            f"Cloudflare 5xx server error ({response.status_code}). "
                            f"Retrying attempt {attempt}/{max_retries} in {delay:.1f}s..."
                        )
                        await asyncio.sleep(delay)
                        continue
                    raise CloudflareUpstreamError(
                        f"Cloudflare server error (HTTP {response.status_code}) after {max_retries} retries."
                    )

                # 5. Other 4xx client errors
                raise CloudflareClientError(
                    f"Unexpected client error from Cloudflare Radar (HTTP {response.status_code}): {response.text[:200]}"
                )

            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as net_err:
                if attempt < max_retries:
                    attempt += 1
                    delay = 0.5 * (2 ** (attempt - 1))
                    logger.warning(
                        f"Transient network error ({type(net_err).__name__}). "
                        f"Retrying attempt {attempt}/{max_retries} in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                    continue
                raise CloudflareUpstreamError(
                    f"Network connectivity error to Cloudflare Radar: {net_err}"
                ) from net_err

    # --------------------------------------------------------------------------
    # Documented Endpoints
    # --------------------------------------------------------------------------
    async def get_layer3_timeseries(
        self, date_range: str = "7d", agg_interval: str = "1h"
    ) -> Dict[str, Any]:
        """Fetch Layer 3 DDoS attack timeseries."""
        return await self._request(
            "GET",
            "attacks/layer3/timeseries",
            params={"dateRange": date_range, "aggInterval": agg_interval},
        )

    async def get_layer7_timeseries(
        self, date_range: str = "7d", agg_interval: str = "1h"
    ) -> Dict[str, Any]:
        """Fetch Layer 7 DDoS attack timeseries."""
        return await self._request(
            "GET",
            "attacks/layer7/timeseries",
            params={"dateRange": date_range, "aggInterval": agg_interval},
        )

    async def get_top_target_locations(
        self, date_range: str = "7d", limit: int = 10
    ) -> Dict[str, Any]:
        """Fetch top target countries attacked at Layer 3."""
        return await self._request(
            "GET",
            "attacks/layer3/top/locations/target",
            params={"dateRange": date_range, "limit": limit},
        )

    async def get_top_origin_locations(
        self, date_range: str = "7d", limit: int = 10
    ) -> Dict[str, Any]:
        """Fetch top origin countries for Layer 3 attacks."""
        return await self._request(
            "GET",
            "attacks/layer3/top/locations/origin",
            params={"dateRange": date_range, "limit": limit},
        )

    async def get_layer3_summary_protocol(
        self, date_range: str = "7d"
    ) -> Dict[str, Any]:
        """Fetch Layer 3 attack breakdown by protocol (TCP, UDP, ICMP, GRE, etc.) using documented dimension endpoint."""
        return await self._request(
            "GET",
            "attacks/layer3/summary/PROTOCOL",
            params={"dateRange": date_range},
        )
