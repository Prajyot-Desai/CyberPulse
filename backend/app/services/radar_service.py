"""Service layer orchestrating Cloudflare Radar retrieval, normalization, caching, and stale fallback."""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.clients.cloudflare import (
    CloudflareAuthError,
    CloudflareClientError,
    CloudflareRadarClient,
    CloudflareRateLimitError,
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


class RadarService:
    """Coordinates upstream retrieval, data normalization, TTL caching, and graceful failure handling."""

    def __init__(
        self,
        client: Optional[CloudflareRadarClient] = None,
        cache_instance: Optional[InMemoryTTLCache] = None,
        settings: Optional[Settings] = None,
    ):
        self.settings = settings or get_settings()
        self.client = client or CloudflareRadarClient(settings=self.settings)
        self.cache = cache_instance or default_cache
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
        """Extract top country metrics from top_0 arrays."""
        if not raw or not isinstance(raw, dict):
            return []

        result = raw.get("result", {})
        if not isinstance(result, dict):
            return []

        top_list = result.get("top_0", [])
        if not isinstance(top_list, list):
            return []

        locations: List[LocationMetric] = []
        for item in top_list:
            if isinstance(item, dict):
                raw_item = RawTopLocationItem(**item)
                locations.append(
                    LocationMetric(
                        country_code=raw_item.resolved_code,
                        country_name=raw_item.resolved_name,
                        percentage=round(raw_item.numeric_value, 2),
                    )
                )

        return locations

    @staticmethod
    def _normalize_protocols(raw: Optional[Dict[str, Any]]) -> List[ProtocolMetric]:
        """Convert protocol summary distribution into standardized ProtocolMetrics."""
        if not raw or not isinstance(raw, dict):
            return []

        result = raw.get("result", {})
        if not isinstance(result, dict):
            return []

        protocols: List[ProtocolMetric] = []

        # Check if result is a list or dictionary of protocols
        items = result.get("protocol") or result.get("summary_0") or []
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    name = item.get("metric") or item.get("protocol") or "UNKNOWN"
                    raw_val = item.get("value", 0.0)
                    try:
                        val = float(raw_val)
                    except (ValueError, TypeError):
                        val = 0.0
                    protocols.append(ProtocolMetric(protocol=str(name).upper(), percentage=round(val, 2)))
        elif isinstance(result, dict):
            for key, val in result.items():
                if key != "meta" and isinstance(val, (int, float, str)):
                    try:
                        num_val = float(val)
                        protocols.append(ProtocolMetric(protocol=key.upper(), percentage=round(num_val, 2)))
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

        # 2. Fast-path: Check fresh cache
        cached_data = self.cache.get(cache_key)
        if cached_data is not None and isinstance(cached_data, RadarOverviewResponse):
            return cached_data

        # 3. Synchronize concurrent requests using key lock
        lock = await self.cache.get_key_lock(cache_key)
        async with lock:
            # Re-check cache after acquiring lock
            cached_data = self.cache.get(cache_key)
            if cached_data is not None and isinstance(cached_data, RadarOverviewResponse):
                return cached_data

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
                exceptions = [r for r in results if isinstance(r, Exception)]
                if len(exceptions) == len(results):
                    # All upstream requests failed
                    raise exceptions[0]

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

                # Store in cache
                self.cache.set(
                    cache_key,
                    response,
                    ttl_seconds=self.settings.CACHE_TTL_SECONDS,
                )
                return response

            except Exception as err:
                error_msg = f"{type(err).__name__}: {str(err)}"
                self.last_error = error_msg
                logger.error(f"Failed to fetch fresh Cloudflare Radar overview: {error_msg}")

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
                        warning=f"Serving cached data. Upstream sync failed: {str(err)}",
                    )

                # 6. No cached data exists -> UNAVAILABLE
                return RadarOverviewResponse(
                    status=DataStatus.UNAVAILABLE,
                    observation_window=date_range,
                    fetched_at=None,
                    is_stale=False,
                    metrics=None,
                    warning=f"Upstream Cloudflare Radar data unavailable: {str(err)}",
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


_service_instance: Optional[RadarService] = None


def get_radar_service() -> RadarService:
    """Return a singleton instance of RadarService."""
    global _service_instance
    if _service_instance is None:
        _service_instance = RadarService()
    return _service_instance
