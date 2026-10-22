/**
 * Type-safe API client for CyberPulse FastAPI backend.
 */

import { HealthResponse, ObservationWindow, RadarOverviewResponse, RadarStatusResponse } from '../types/api';

// Use configurable API base URL or fallback to relative proxy path
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isOffline: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function requestWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Link caller signal if provided
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Server error (HTTP ${response.status})`;
      try {
        const errorJson = await response.json();
        if (errorJson && typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        }
      } catch {
        // Fallback to status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new ApiError(errorMessage, response.status, false);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out or was cancelled by user.', undefined, true);
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Unable to connect to CyberPulse backend at 127.0.0.1:8000. Is the server running?',
        undefined,
        true
      );
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'An unknown network error occurred',
      undefined,
      false
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiService = {
  /**
   * Health check to confirm backend process is alive.
   */
  async checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
    // Check root /health (supported directly by FastAPI backend)
    return requestWithTimeout<HealthResponse>('/health', { signal });
  },

  /**
   * Retrieve normalized macroscopic DDoS overview metrics.
   */
  async getOverview(
    dateRange: ObservationWindow = '7d',
    signal?: AbortSignal
  ): Promise<RadarOverviewResponse> {
    const url = `${BASE_URL.replace(/\/$/, '')}/radar/overview?dateRange=${encodeURIComponent(dateRange)}`;
    return requestWithTimeout<RadarOverviewResponse>(url, { signal });
  },

  /**
   * Retrieve upstream configuration readiness and cache stats.
   */
  async getStatus(signal?: AbortSignal): Promise<RadarStatusResponse> {
    const url = `${BASE_URL.replace(/\/$/, '')}/radar/status`;
    return requestWithTimeout<RadarStatusResponse>(url, { signal });
  },
};
