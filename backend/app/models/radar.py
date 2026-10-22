"""Typed Pydantic schemas for upstream Cloudflare Radar responses and internal API envelopes."""

from datetime import datetime, timezone
from enum import Enum
import math
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
from pydantic import BaseModel, ConfigDict, Field


# ------------------------------------------------------------------------------
# Enums
# ------------------------------------------------------------------------------
class DataStatus(str, Enum):
    """Indicates the operational health and provenance of returned data."""

    FRESH = "fresh"
    STALE = "stale"
    UNAVAILABLE = "unavailable"
    UNCONFIGURED = "unconfigured"


# ------------------------------------------------------------------------------
# Generic Upstream Envelope
# ------------------------------------------------------------------------------
T = TypeVar("T")


class CloudflareEnvelope(BaseModel, Generic[T]):
    """Standard envelope returned by all Cloudflare v4 APIs."""

    model_config = ConfigDict(extra="ignore")

    success: bool
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    result: Optional[T] = None


# ------------------------------------------------------------------------------
# Upstream Raw Models
# ------------------------------------------------------------------------------
class RawTimeseriesData(BaseModel):
    """Raw series point arrays (either directly or nested under serie_0)."""

    model_config = ConfigDict(extra="ignore")

    timestamps: List[str] = Field(default_factory=list)
    values: List[Union[str, float, int]] = Field(default_factory=list)


class RawTopLocationItem(BaseModel):
    """Individual item in top locations list."""

    model_config = ConfigDict(extra="ignore")

    # Documented Cloudflare target fields
    targetCountryAlpha2: Optional[str] = None
    targetCountryName: Optional[str] = None

    # Documented Cloudflare origin fields & aliases
    originCountryAlpha2: Optional[str] = None
    originCountryName: Optional[str] = None
    clientCountryAlpha2: Optional[str] = None
    clientCountryName: Optional[str] = None
    clientISOAlpha2: Optional[str] = None
    countryAlpha2: Optional[str] = None
    countryName: Optional[str] = None

    # Quantitative value (percentage proportion) and ranking
    value: Union[str, float, int] = 0.0
    rank: Optional[Union[int, str]] = None

    @property
    def resolved_code(self) -> str:
        """Resolve alpha2 country code from target, origin, or generic country code fields."""
        for candidate in (
            self.targetCountryAlpha2,
            self.originCountryAlpha2,
            self.clientCountryAlpha2,
            self.clientISOAlpha2,
            self.countryAlpha2,
        ):
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip().upper()
        return "XX"

    @property
    def resolved_name(self) -> str:
        """Resolve full country name from target, origin, or generic country name fields."""
        for candidate in (
            self.targetCountryName,
            self.originCountryName,
            self.clientCountryName,
            self.countryName,
        ):
            if candidate and isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        return "Unknown"

    @property
    def resolved_rank(self) -> Optional[int]:
        """Resolve ranking position as an integer if present."""
        if self.rank is None:
            return None
        try:
            return int(self.rank)
        except (ValueError, TypeError):
            return None

    @property
    def numeric_value(self) -> float:
        """Convert string or int percentage value to a safe float."""
        try:
            val = float(self.value)
            return val if math.isfinite(val) else 0.0
        except (ValueError, TypeError):
            return 0.0


class RawTopLocationsResult(BaseModel):
    """Result payload for /top/locations/* endpoints."""

    model_config = ConfigDict(extra="ignore")

    top_0: List[RawTopLocationItem] = Field(default_factory=list)
    top0: List[RawTopLocationItem] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


# ------------------------------------------------------------------------------
# Normalized Internal Models (Served to Frontend)
# ------------------------------------------------------------------------------
class TimeseriesPoint(BaseModel):
    """Single point in a chronological time series."""

    timestamp: str = Field(description="ISO-8601 timestamp")
    value: float = Field(description="Normalized attack volume index or percentage")


class LocationMetric(BaseModel):
    """Country-level attack proportion."""

    country_code: str = Field(description="ISO-3166-1 alpha-2 country code")
    country_name: str = Field(description="Full country or territory name")
    percentage: float = Field(description="Proportion of total attacks (0.0 - 100.0)")
    rank: Optional[int] = Field(default=None, description="Ranking position if available")


class ProtocolMetric(BaseModel):
    """Protocol distribution metric."""

    protocol: str = Field(description="Network protocol name (e.g. TCP, UDP, GRE, ICMP)")
    percentage: float = Field(description="Proportion of observed traffic (0.0 - 100.0)")


class RadarMetrics(BaseModel):
    """Aggregated DDoS intelligence dataset."""

    layer3_timeseries: List[TimeseriesPoint] = Field(
        default_factory=list, description="Layer 3/4 volumetric attack trend"
    )
    layer7_timeseries: List[TimeseriesPoint] = Field(
        default_factory=list, description="Layer 7 application attack trend"
    )
    top_target_countries: List[LocationMetric] = Field(
        default_factory=list, description="Top targeted destination countries"
    )
    top_origin_countries: List[LocationMetric] = Field(
        default_factory=list, description="Top attack origin countries"
    )
    protocols: List[ProtocolMetric] = Field(
        default_factory=list, description="Observed network protocol distribution"
    )


class RadarOverviewResponse(BaseModel):
    """Normalized response payload for /api/v1/radar/overview."""

    status: DataStatus = Field(description="Data freshness status: fresh, stale, unavailable, or unconfigured")
    data_source: str = Field(
        default="Cloudflare Radar API v4", description="Original data source"
    )
    observation_window: str = Field(
        default="7d", description="Time window of aggregated metrics"
    )
    fetched_at: Optional[datetime] = Field(
        default=None, description="UTC timestamp when data was fetched from Cloudflare"
    )
    is_stale: bool = Field(
        default=False, description="True if data is served from an expired cache fallback"
    )
    metrics: Optional[RadarMetrics] = Field(
        default=None, description="Structured aggregated metrics, null if unavailable"
    )
    disclaimer: str = Field(
        default=(
            "Simulated event visualizations on the globe are derived mathematically from "
            "aggregated origin-target metrics; individual attack events or coordinates are not provided by Cloudflare Radar."
        ),
        description="Data integrity disclaimer"
    )
    warning: Optional[str] = Field(
        default=None, description="Operational warning if data is stale, fallback, or unconfigured"
    )


class RadarStatusResponse(BaseModel):
    """System and upstream health reporting for /api/v1/radar/status."""

    upstream_configured: bool = Field(
        description="True if a valid Cloudflare API token is present"
    )
    upstream_base_url: str = Field(description="Cloudflare Radar base endpoint")
    last_successful_sync: Optional[datetime] = Field(
        default=None, description="UTC timestamp of the last successful upstream sync"
    )
    cache_stats: Dict[str, Any] = Field(
        default_factory=dict, description="In-memory cache operational statistics"
    )
    active_warning: Optional[str] = Field(
        default=None, description="Active system or upstream warning"
    )


class HealthResponse(BaseModel):
    """Response payload for /health."""

    status: str = Field(default="ok", description="Service status")
    service: str = Field(default="cyberpulse-backend", description="Service identifier")
    version: str = Field(default="0.1.0", description="API version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Current server UTC timestamp"
    )
