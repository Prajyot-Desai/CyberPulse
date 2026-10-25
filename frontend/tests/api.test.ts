import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService, ApiError } from '../src/services/api';
import { RadarOverviewResponse, RadarStatusResponse } from '../src/types/api';

describe('apiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches health check successfully', async () => {
    const mockHealth = {
      status: 'ok',
      service: 'cyberpulse-backend',
      version: '0.1.0',
      timestamp: '2026-10-21T18:00:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealth,
    } as Response);

    const result = await apiService.checkHealth();
    expect(result).toEqual(mockHealth);
  });

  it('fetches overview with specified dateRange', async () => {
    const mockOverview: RadarOverviewResponse = {
      status: 'fresh',
      data_source: 'Cloudflare Radar API v4',
      observation_window: '7d',
      fetched_at: '2026-10-21T18:00:00Z',
      is_stale: false,
      metrics: {
        layer3_timeseries: [{ timestamp: '2026-10-21T00:00:00Z', value: 100 }],
        layer7_timeseries: [{ timestamp: '2026-10-21T00:00:00Z', value: 50 }],
        top_target_countries: [{ country_code: 'US', country_name: 'United States', percentage: 40 }],
        top_origin_countries: [{ country_code: 'CN', country_name: 'China', percentage: 30 }],
        protocols: [{ protocol: 'UDP', percentage: 60 }],
      },
      disclaimer: 'Simulated flows',
      warning: null,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverview,
    } as Response);

    const result = await apiService.getOverview('14d');
    expect(result).toEqual(mockOverview);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('dateRange=14d'),
      expect.any(Object)
    );
  });

  it('fetches status response successfully', async () => {
    const mockStatus: RadarStatusResponse = {
      upstream_configured: true,
      upstream_base_url: 'https://api.cloudflare.com/client/v4/radar',
      last_successful_sync: '2026-10-21T18:00:00Z',
      cache_stats: {
        total_entries: 2,
        active_entries: 2,
        stale_entries: 0,
        hits: 10,
        misses: 2,
      },
      active_warning: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    } as Response);

    const result = await apiService.getStatus();
    expect(result).toEqual(mockStatus);
  });

  it('handles backend connection failure as offline ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiService.getOverview()).rejects.toThrow(ApiError);
    await expect(apiService.getOverview()).rejects.toMatchObject({ isOffline: true });
  });

  it('handles HTTP error status codes gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({ detail: 'Upstream gateway error' }),
    } as Response);

    await expect(apiService.getOverview()).rejects.toThrow('Upstream gateway error');
  });

  it('extracts structured validation error messages from FastAPI 422 array details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({
        detail: [
          {
            loc: ['query', 'dateRange'],
            msg: "String should match pattern '^(1d|7d|14d|30d)$'",
            type: 'string_pattern_mismatch',
          },
        ],
      }),
    } as Response);

    await expect(apiService.getOverview('90d' as any)).rejects.toThrow(
      "dateRange: String should match pattern '^(1d|7d|14d|30d)$'"
    );
  });

  it('fails fast when caller signal is already aborted before fetch', async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(apiService.getOverview('7d', controller.signal)).rejects.toMatchObject({
      message: 'Request was cancelled.',
      isOffline: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('removes abort event listener from caller signal upon completion', async () => {
    const controller = new AbortController();
    const addListenerSpy = vi.spyOn(controller.signal, 'addEventListener');
    const removeListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    await apiService.checkHealth(controller.signal);

    expect(addListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
    expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
