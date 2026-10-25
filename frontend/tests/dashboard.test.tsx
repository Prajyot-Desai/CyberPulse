import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { RadarOverviewResponse, RadarStatusResponse, HealthResponse } from '../src/types/api';

const mockHealthResponse: HealthResponse = {
  status: 'ok',
  service: 'cyberpulse-backend',
  version: '0.1.0',
  timestamp: '2026-10-21T18:00:00Z',
};

const mockStatusResponse: RadarStatusResponse = {
  upstream_configured: true,
  upstream_base_url: 'https://api.cloudflare.com/client/v4/radar',
  last_successful_sync: '2026-10-21T18:00:00Z',
  cache_stats: {
    total_entries: 1,
    active_entries: 1,
    stale_entries: 0,
    hits: 5,
    misses: 1,
  },
  active_warning: null,
};

const mockFreshOverview: RadarOverviewResponse = {
  status: 'fresh',
  data_source: 'Cloudflare Radar API v4',
  observation_window: '7d',
  fetched_at: '2026-10-21T18:00:00Z',
  is_stale: false,
  metrics: {
    layer3_timeseries: [
      { timestamp: '2026-10-20T00:00:00Z', value: 120.5 },
      { timestamp: '2026-10-21T00:00:00Z', value: 240.8 },
    ],
    layer7_timeseries: [
      { timestamp: '2026-10-20T00:00:00Z', value: 85.0 },
      { timestamp: '2026-10-21T00:00:00Z', value: 130.2 },
    ],
    top_target_countries: [
      { country_code: 'US', country_name: 'United States', percentage: 42.5 },
      { country_code: 'DE', country_name: 'Germany', percentage: 15.2 },
    ],
    top_origin_countries: [
      { country_code: 'CN', country_name: 'China', percentage: 35.0 },
      { country_code: 'BR', country_name: 'Brazil', percentage: 12.0 },
    ],
    protocols: [
      { protocol: 'UDP', percentage: 65.0 },
      { protocol: 'TCP', percentage: 30.0 },
    ],
  },
  disclaimer: 'Simulated flows derived from aggregate data',
  warning: null,
};

describe('Dashboard Component Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial dashboard branding and controls', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => mockFreshOverview } as Response;
    });

    render(<App />);

    expect(screen.getByText('CyberPulse')).toBeInTheDocument();
    expect(screen.getByText('DDoS Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Global DDoS Intelligence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('displays real metrics and country names when fresh data is returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => mockFreshOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('United States (US)')).toBeInTheDocument();
      expect(screen.getAllByText('UDP').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('65% of total observed traffic')).toBeInTheDocument();
    });
  });

  it('renders unconfigured state cleanly without fake numbers', async () => {
    const unconfiguredOverview: RadarOverviewResponse = {
      status: 'unconfigured',
      data_source: 'Cloudflare Radar API v4',
      observation_window: '7d',
      fetched_at: null,
      is_stale: false,
      metrics: null,
      disclaimer: 'Simulated flows',
      warning: 'Cloudflare API token is not configured in .env',
    };

    const unconfiguredStatus: RadarStatusResponse = {
      upstream_configured: false,
      upstream_base_url: 'https://api.cloudflare.com/client/v4/radar',
      last_successful_sync: null,
      cache_stats: { total_entries: 0, active_entries: 0, stale_entries: 0, hits: 0, misses: 0 },
      active_warning: null,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => unconfiguredStatus } as Response;
      return { ok: true, json: async () => unconfiguredOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      const unconfiguredBadges = screen.getAllByText('UNCONFIGURED');
      expect(unconfiguredBadges.length).toBeGreaterThan(0);
      const hintElements = screen.getAllByText('Awaiting Cloudflare API Token in .env');
      expect(hintElements.length).toBeGreaterThan(0);
    });
  });

  it('displays stale data warning banner when backend serves cached snapshot', async () => {
    const staleOverview: RadarOverviewResponse = {
      ...mockFreshOverview,
      status: 'stale',
      is_stale: true,
      warning: 'Serving cached data. Upstream sync failed: 429 Too Many Requests',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => staleOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert', { name: '' })).toBeInTheDocument();
      expect(screen.getByText(/Serving cached data/i)).toBeInTheDocument();
      expect(screen.getByText('STALE CACHE')).toBeInTheDocument();
    });
  });

  it('displays offline banner when backend is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('CyberPulse Backend Unreachable')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
    });
  });

  it('triggers manual refresh on refresh button click', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => mockFreshOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('United States (US)')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(6); // 3 initial + 3 on refresh
    });
  });

  it('displays actionable API error banner with retry button on HTTP 500 error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Internal Server Error' }),
      } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Telemetry Request Failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Request/i })).toBeInTheDocument();
    });
  });

  it('displays actionable banner when telemetry data is unavailable', async () => {
    const unavailableOverview: RadarOverviewResponse = {
      status: 'unavailable',
      data_source: 'Cloudflare Radar API v4',
      observation_window: '7d',
      fetched_at: null,
      is_stale: false,
      metrics: null,
      disclaimer: 'Simulated flows',
      warning: 'Upstream Cloudflare Radar data unavailable: Connection timeout',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => unavailableOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Telemetry Data Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Connection timeout/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Request/i })).toBeInTheDocument();
    });
  });

  it('preserves previously loaded metrics when subsequent refresh returns transient error', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;

      callCount += 1;
      if (callCount === 1) {
        // Initial success
        return { ok: true, json: async () => mockFreshOverview } as Response;
      }
      // Transient 500 on second call (manual refresh)
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Transient database error' }),
      } as Response;
    });

    render(<App />);

    // 1. Initial fresh data rendered
    await waitFor(() => {
      expect(screen.getByText('United States (US)')).toBeInTheDocument();
    });

    // 2. Trigger manual refresh which fails
    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    // 3. Error banner appears with retry button
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Telemetry Request Failed')).toBeInTheDocument();
      expect(screen.getByText(/Transient database error/i)).toBeInTheDocument();
    });

    // 4. Previously loaded metrics are still preserved on the screen
    expect(screen.getByText('United States (US)')).toBeInTheDocument();
  });

  it('displays active error banner when initially unconfigured and subsequent refresh fails with HTTP error', async () => {
    const unconfiguredOverview: RadarOverviewResponse = {
      status: 'unconfigured',
      data_source: 'Cloudflare Radar API v4',
      observation_window: '7d',
      fetched_at: null,
      is_stale: false,
      metrics: null,
      disclaimer: 'Simulated flows',
      warning: 'Cloudflare API token is not configured in .env',
    };

    const unconfiguredStatus: RadarStatusResponse = {
      upstream_configured: false,
      upstream_base_url: 'https://api.cloudflare.com/client/v4/radar',
      last_successful_sync: null,
      cache_stats: { total_entries: 0, active_entries: 0, stale_entries: 0, hits: 0, misses: 0 },
      active_warning: null,
    };

    let overviewFetchCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => unconfiguredStatus } as Response;

      overviewFetchCount += 1;
      if (overviewFetchCount === 1) {
        // Initial fetch returns unconfigured 200 OK
        return { ok: true, json: async () => unconfiguredOverview } as Response;
      }

      // Subsequent refresh fails with HTTP 500 error
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Failed upstream connection test' }),
      } as Response;
    });

    render(<App />);

    // 1. Initially displays the unconfigured token guidance banner
    await waitFor(() => {
      expect(screen.getByText('Cloudflare API Token Unconfigured')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Check Connection/i })).toBeInTheDocument();
    });

    // 2. Click "Check Connection" button on the banner
    const checkConnectionBtn = screen.getByRole('button', { name: /Check Connection/i });
    fireEvent.click(checkConnectionBtn);

    // 3. Active HTTP 500 error banner appears and replaces the standing unconfigured warning
    await waitFor(() => {
      expect(screen.getByText('Telemetry Request Failed')).toBeInTheDocument();
      expect(screen.getByText(/Failed upstream connection test/i)).toBeInTheDocument();
      expect(screen.queryByText('Cloudflare API Token Unconfigured')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Request/i })).toBeInTheDocument();
    });
  });

  it('displays partial telemetry warning banner and badge when backend returns partial status', async () => {
    const partialOverview: RadarOverviewResponse = {
      ...mockFreshOverview,
      status: 'partial',
      is_stale: false,
      warning: 'Partial telemetry: upstream sync failed for Layer 7 timeseries (Upstream request timed out).',
      metrics: {
        ...mockFreshOverview.metrics!,
        layer7_timeseries: [],
      },
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const u = url.toString();
      if (u.includes('/health')) return { ok: true, json: async () => mockHealthResponse } as Response;
      if (u.includes('/radar/status')) return { ok: true, json: async () => mockStatusResponse } as Response;
      return { ok: true, json: async () => partialOverview } as Response;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('PARTIAL RADAR')).toBeInTheDocument();
      expect(screen.getByText('Partial Telemetry Available')).toBeInTheDocument();
      expect(screen.getByText(/upstream sync failed for Layer 7 timeseries/i)).toBeInTheDocument();
      // Successful endpoints are still rendered
      expect(screen.getByText('United States (US)')).toBeInTheDocument();
    });
  });
});
