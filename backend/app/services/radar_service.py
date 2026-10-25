"""Service layer orchestrating Cloudflare Radar retrieval, normalization, caching, and stale fallback."""

import asyncio
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
from app.clients.cloudflare import (
    CloudflareAuthError,
    CloudflareClientError,
    CloudflareRadarClient,
    CloudflareRateLimitError,
    CloudflareResponseError,
    CloudflareUpstreamError,
)
from app.core.cache import InMemoryTTLCache, cache as default_cache
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.models.radar import (
    DataStatus,
    LocationMetric,
    ProtocolMetric,
    RadarMetrics,
    RadarOverviewResponse,
    RadarStatusResponse,
    RawTopLocationItem,
    TimeseriesPoint,
)


def sanitize_upstream_error(err: Optional[Exception]) -> str:
    """
    Return a concise, actionable, and safe error message suitable for public display.
    Never exposes raw response bodies, bearer tokens, internal URLs, or stack traces.
    """
    if err is None:
        return "Unknown upstream error"

    if isinstance(err, CloudflareAuthError):
        return "Upstream authentication failed (verify API token)"
    if isinstance(err, CloudflareRateLimitError):
        retry_after = getattr(err, "retry_after", None)
        if retry_after:
            return f"Upstream rate limit reached (retry after {retry_after}s)"
        return "Upstream rate limit reached"
    if isinstance(err, CloudflareUpstreamError):
        return "Upstream Cloudflare Radar service temporarily unavailable or timed out"
    if isinstance(err, CloudflareResponseError):
        return "Unexpected response format from upstream provider"
    if isinstance(err, CloudflareClientError):
        return "Upstream provider rejected query parameters"
    if isinstance(err, (asyncio.TimeoutError, TimeoutError)):
        return "Upstream request timed out"

    # Fallback generic message
    return "Upstream service temporarily unavailable"


class RadarService:
    """Coordinates upstream retrieval, data normalization, TTL caching, and graceful failure handling."""

    def __init__(
        self,
        client: Optional[CloudflareRadarClient] = None,
        cache_instance: Optional[InMemoryTTLCache] = None,
        partial_cache_instance: Optional[InMemoryTTLCache] = None,
        settings: Optional[Settings] = None,
    ):
        self.settings = settings or get_settings()
        self.client = client or CloudflareRadarClient(settings=self.settings)
        self.cache = cache_instance or default_cache
        self.partial_cache = partial_cache_instance or InMemoryTTLCache(
            default_ttl_seconds=self.settings.CACHE_PARTIAL_TTL_SECONDS,
            max_stale_seconds=self.settings.CACHE_PARTIAL_TTL_SECONDS,
            time_func=getattr(self.cache, "_time_func", None),
        )
        self.last_successful_sync: Optional[datetime] = None
        self.last_error: Optional[str] = None

    # --------------------------------------------------------------------------
    # Data Normalizers
    # --------------------------------------------------------------------------
    @staticmethod
    def _normalize_timeseries(raw: Optional[Dict[str, Any]]) -> List[TimeseriesPoint]:
        """Convert varied Cloudflare timeseries shapes into a standardized list of Points."""
        if not raw or not isinstance(raw, dict):
            return []

        result = raw.get("result", {})
        if not isinstance(result, dict):
            return []

        timestamps: List[str] = []
        values: List[Any] = []

        # Case A: Directly under result: { "timestamps": [...], "values": [...] }
        if "timestamps" in result and "values" in result:
            timestamps = result.get("timestamps", [])
            values = result.get("values", [])
        else:
            # Case B: Nested under serie name (e.g. serie_0 or series_0)
            for key, val in result.items():
                if isinstance(val, dict) and "timestamps" in val and "values" in val:
                    timestamps = val.get("timestamps", [])
                    values = val.get("values", [])
                    break

        points: List[TimeseriesPoint] = []
        for ts, val in zip(timestamps, values):
            try:
                numeric_val = float(val) if val is not None else 0.0
            except (ValueError, TypeError):
                numeric_val = 0.0
            points.append(TimeseriesPoint(timestamp=str(ts), value=numeric_val))

        return points

    @staticmethod
    def _normalize_locations(raw: Optional[Dict[str, Any]]) -> List[LocationMetric]:
        """Extract top country metrics from top_0 arrays with defensive top0 compatibility."""
        if not raw or not isinstance(raw, dict):
            return []

        result = raw.get("result", {})
        if not isinstance(result, dict):
            return []

        # Official Cloudflare Radar responses wrap items in top_0; defensively support top0
        top_list = result.get("top_0")
        if top_list is None:
            top_list = result.get("top0", [])

        if not isinstance(top_list, list):
            return []

        locations: List[LocationMetric] = []
        for item in top_list:
            if isinstance(item, RawTopLocationItem):
                raw_item = item
            elif isinstance(item, dict):
                raw_item = RawTopLocationItem(**item)
            else:
                continue

            locations.append(
                LocationMetric(
                    country_code=raw_item.resolved_code,
                    country_name=raw_item.resolved_name,
                    percentage=round(raw_item.numeric_value, 2),
                    rank=raw_item.resolved_rank,
                )
            )

        return locations

    @staticmethod
    def _normalize_protocols(raw: Optional[Dict[str, Any]]) -> List[ProtocolMetric]:
        """Convert protocol summary distribution into standardized ProtocolMetrics.

        Supports the documented Cloudflare Radar dictionary structure under result.summary_0
        (e.g., {"UDP": "65.0", "TCP": "30.0"}) as well as legacy list representations.
        Excludes metadata ('meta', 'units') and non-protocol attributes.
        Preserves percentage semantics (values are proportions 0.0 - 100.0, not raw packet counts).
        """
        if not raw or not isinstance(raw, dict):
            return []

        result = raw.get("result", {})
        if not isinstance(result, dict):
            return []

        protocols: List[ProtocolMetric] = []

        # 1. Official Cloudflare Radar summary dimension format: result.summary_0 as dict
        summary_data = result.get("summary_0")
        if summary_data is None:
            summary_data = result.get("summary0")

        if isinstance(summary_data, dict):
            for proto_name, raw_val in summary_data.items():
                if str(proto_name).lower() in ("meta", "units"):
                    continue
                try:
                    num_val = float(raw_val) if raw_val is not None else 0.0
                    if not math.isfinite(num_val):
                        continue
                    protocols.append(
                        ProtocolMetric(
                            protocol=str(proto_name).strip().upper(),
                            percentage=round(num_val, 2),
                        )
                    )
                except (ValueError, TypeError):
                    continue
            return protocols

        # 2. Check if summary_data or result has a list representation
        items = summary_data if isinstance(summary_data, list) else result.get("protocol")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    name = item.get("metric") or item.get("protocol") or item.get("name")
                    if not name or str(name).lower() in ("meta", "units"):
                        continue
                    raw_val = item.get("value", 0.0)
                    try:
                        num_val = float(raw_val) if raw_val is not None else 0.0
                    except (ValueError, TypeError):
                        num_val = 0.0
                    protocols.append(
                        ProtocolMetric(
                            protocol=str(name).strip().upper(),
                            percentage=round(num_val, 2),
                        )
                    )
            return protocols

        # 3. Direct dictionary key-values under result (excluding metadata)
        for key, val in result.items():
            if key.lower() not in ("meta", "units", "summary_0", "summary0") and isinstance(
                val, (int, float, str)
            ):
                try:
                    num_val = float(val)
                    protocols.append(
                        ProtocolMetric(
                            protocol=str(key).strip().upper(),
                            percentage=round(num_val, 2),
                        )
                    )
                except (ValueError, TypeError):
                    continue

        return protocols

    # --------------------------------------------------------------------------
    # Core Operations
    # --------------------------------------------------------------------------
    async def get_overview(self, date_range: str = "7d") -> RadarOverviewResponse:
        """
        Retrieve normalized DDoS overview with TTL caching, lock deduplication, and stale fallback.
        """
        # 1. Check configuration
        if not self.settings.is_cloudflare_configured:
            return RadarOverviewResponse(
                status=DataStatus.UNCONFIGURED,
                observation_window=date_range,
                warning="Cloudflare API token is not configured in .env. Real-time statistics cannot be fetched.",
                metrics=None,
            )

        cache_key = f"radar_overview_{date_range}"

        # 2. Fast-path: Check fresh primary cache first, then short-lived partial cache
        cached_data = self.cache.get(cache_key)
        if cached_data is not None and isinstance(cached_data, RadarOverviewResponse):
            return cached_data

        cached_partial = self.partial_cache.get(cache_key)
        if cached_partial is not None and isinstance(cached_partial, RadarOverviewResponse):
            return cached_partial

        # 3. Synchronize concurrent requests using key lock
        lock = await self.cache.get_key_lock(cache_key)
        async with lock:
            # Re-check primary and partial caches after acquiring lock
            cached_data = self.cache.get(cache_key)
            if cached_data is not None and isinstance(cached_data, RadarOverviewResponse):
                return cached_data

            cached_partial = self.partial_cache.get(cache_key)
            if cached_partial is not None and isinstance(cached_partial, RadarOverviewResponse):
                return cached_partial

            # 4. Fetch upstream concurrently
            try:
                l3_task = self.client.get_layer3_timeseries(date_range=date_range)
                l7_task = self.client.get_layer7_timeseries(date_range=date_range)
                target_task = self.client.get_top_target_locations(date_range=date_range)
                origin_task = self.client.get_top_origin_locations(date_range=date_range)
                protocol_task = self.client.get_layer3_summary_protocol(date_range=date_range)

                results = await asyncio.gather(
                    l3_task,
                    l7_task,
                    target_task,
                    origin_task,
                    protocol_task,
                    return_exceptions=True,
                )

                l3_res, l7_res, target_res, origin_res, protocol_res = results

                # Check if critical requests succeeded or all failed
                dimension_map = [
                    ("Layer 3 timeseries", l3_res),
                    ("Layer 7 timeseries", l7_res),
                    ("Top target locations", target_res),
                    ("Top origin locations", origin_res),
                    ("Attack protocols", protocol_res),
                ]

                failed_dimensions = [
                    name for name, res in dimension_map if isinstance(res, Exception)
                ]

                if len(failed_dimensions) == len(results):
                    # All upstream requests failed -> trigger fallback/unavailable handling
                    raise next(res for _, res in dimension_map if isinstance(res, Exception))

                # Normalize each dimension, gracefully ignoring partial failures
                metrics = RadarMetrics(
                    layer3_timeseries=(
                        self._normalize_timeseries(l3_res)
                        if not isinstance(l3_res, Exception)
                        else []
                    ),
                    layer7_timeseries=(
                        self._normalize_timeseries(l7_res)
                        if not isinstance(l7_res, Exception)
                        else []
                    ),
                    top_target_countries=(
                        self._normalize_locations(target_res)
                        if not isinstance(target_res, Exception)
                        else []
                    ),
                    top_origin_countries=(
                        self._normalize_locations(origin_res)
                        if not isinstance(origin_res, Exception)
                        else []
                    ),
                    protocols=(
                        self._normalize_protocols(protocol_res)
                        if not isinstance(protocol_res, Exception)
                        else []
                    ),
                )

                now = datetime.now(timezone.utc)

                if failed_dimensions:
                    # Partial upstream failure:
                    # 1. Never silently label as fresh.
                    # 2. Clearly mark with PARTIAL status.
                    # 3. Preserve successful endpoints while missing series remain empty.
                    # 4. Do not cache partial payload into fresh cache.
                    # 5. Cache into short-lived partial cache to protect upstream from request amplification.
                    first_err = next(
                        res for _, res in dimension_map if isinstance(res, Exception)
                    )
                    sanitized_err = sanitize_upstream_error(first_err)
                    warning_msg = (
                        f"Partial telemetry available: upstream sync failed for "
                        f"{', '.join(failed_dimensions)} ({sanitized_err})."
                    )
                    self.last_error = warning_msg
                    logger.warning(
                        f"Partial upstream failure for date_range={date_range}: {failed_dimensions}"
                    )

                    partial_response = RadarOverviewResponse(
                        status=DataStatus.PARTIAL,
                        observation_window=date_range,
                        fetched_at=now,
                        is_stale=False,
                        metrics=metrics,
                        warning=warning_msg,
                    )

                    # Store in short-lived partial cache (default 30s, no stale retention beyond TTL)
                    self.partial_cache.set(
                        cache_key,
                        partial_response,
                        ttl_seconds=self.settings.CACHE_PARTIAL_TTL_SECONDS,
                        max_stale_seconds=self.settings.CACHE_PARTIAL_TTL_SECONDS,
                    )

                    return partial_response

                # All upstream calls succeeded
                self.last_successful_sync = now
                self.last_error = None

                response = RadarOverviewResponse(
                    status=DataStatus.FRESH,
                    observation_window=date_range,
                    fetched_at=now,
                    is_stale=False,
                    metrics=metrics,
                    warning=None,
                )

                # Store complete success in cache with fresh TTL and max stale age
                self.cache.set(
                    cache_key,
                    response,
                    ttl_seconds=self.settings.CACHE_TTL_SECONDS,
                    max_stale_seconds=self.settings.CACHE_MAX_STALE_SECONDS,
                )
                # Clear any lingering short-lived partial entry
                self.partial_cache.delete(cache_key)
                return response

            except Exception as err:
                sanitized_err = sanitize_upstream_error(err)
                self.last_error = sanitized_err
                logger.error(
                    f"Failed to fetch fresh Cloudflare Radar overview: "
                    f"{type(err).__name__}: {sanitized_err}"
                )

                # 5. Stale cache fallback check
                stale_val, is_stale, created_at = self.cache.get_with_status(cache_key)
                if stale_val is not None and isinstance(stale_val, RadarOverviewResponse):
                    logger.warning("Serving stale cached Radar overview due to upstream failure.")
                    # Return a copy marked with STALE status and descriptive warning
                    return RadarOverviewResponse(
                        status=DataStatus.STALE,
                        observation_window=stale_val.observation_window,
                        fetched_at=created_at or stale_val.fetched_at,
                        is_stale=True,
                        metrics=stale_val.metrics,
                        warning=f"Serving cached data. Upstream sync failed: {sanitized_err}",
                    )

                # 6. No cached data exists -> UNAVAILABLE
                return RadarOverviewResponse(
                    status=DataStatus.UNAVAILABLE,
                    observation_window=date_range,
                    fetched_at=None,
                    is_stale=False,
                    metrics=None,
                    warning=f"Upstream Cloudflare Radar data unavailable: {sanitized_err}",
                )

    def get_status(self) -> RadarStatusResponse:
        """Provide non-sensitive health and synchronization status."""
        return RadarStatusResponse(
            upstream_configured=self.settings.is_cloudflare_configured,
            upstream_base_url=self.settings.CLOUDFLARE_API_BASE_URL,
            last_successful_sync=self.last_successful_sync,
            cache_stats=self.cache.stats(),
            active_warning=self.last_error,
        )

    async def close(self) -> None:
        """Close associated client connections and resources."""
        if self.client:
            await self.client.close()
        self.partial_cache.clear()


_service_instance: Optional[RadarService] = None


def get_radar_service() -> RadarService:
    """Return a singleton instance of RadarService."""
    global _service_instance
    if _service_instance is None:
        _service_instance = RadarService()
    return _service_instance


async def close_radar_service() -> None:
    """Close the global singleton RadarService and its client if initialized."""
    global _service_instance
    if _service_instance is not None:
        await _service_instance.close()
        _service_instance = None
