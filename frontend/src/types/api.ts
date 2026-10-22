/**
 * CyberPulse API Contracts
 * Strictly mirrors the backend Pydantic models from `backend/app/models/radar.py`.
 */

export type DataStatus = 'fresh' | 'stale' | 'unavailable' | 'unconfigured';

export type ObservationWindow = '1d' | '7d' | '14d' | '30d';

export interface TimeseriesPoint {
  timestamp: string;
  value: number;
}

export interface LocationMetric {
  country_code: string;
  country_name: string;
  percentage: number;
}

export interface ProtocolMetric {
  protocol: string;
  percentage: number;
}

export interface RadarMetrics {
  layer3_timeseries: TimeseriesPoint[];
  layer7_timeseries: TimeseriesPoint[];
  top_target_countries: LocationMetric[];
  top_origin_countries: LocationMetric[];
  protocols: ProtocolMetric[];
}

export interface RadarOverviewResponse {
  status: DataStatus;
  data_source: string;
  observation_window: string;
  fetched_at: string | null;
  is_stale: boolean;
  metrics: RadarMetrics | null;
  disclaimer: string;
  warning: string | null;
}

export interface CacheStats {
  total_entries: number;
  active_entries: number;
  stale_entries: number;
  hits: number;
  misses: number;
}

export interface RadarStatusResponse {
  upstream_configured: boolean;
  upstream_base_url: string;
  last_successful_sync: string | null;
  cache_stats: CacheStats;
  active_warning: string | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface BackendConnectionState {
  isOnline: boolean;
  lastChecked: Date | null;
  error: string | null;
}
