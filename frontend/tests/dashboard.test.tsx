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
});
