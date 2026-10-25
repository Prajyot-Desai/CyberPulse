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

/**
 * Extract clean, human-readable message from FastAPI validation errors or error detail payloads.
 */
export function formatErrorDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    const trimmed = detail.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const dict = item as Record<string, unknown>;
          if (typeof dict.msg === 'string') {
            const loc = Array.isArray(dict.loc)
              ? dict.loc.filter((part) => part !== 'body' && part !== 'query').join('.')
              : '';
            return loc ? `${loc}: ${dict.msg}` : dict.msg;
          }
        }
        return null;
      })
      .filter((msg): msg is string => Boolean(msg && msg.length > 0));

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return null;
}

export async function requestWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> {
  // If caller signal is already aborted before we start, fail fast
  if (options.signal?.aborted) {
    throw new ApiError('Request was cancelled.', undefined, true);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort();
  };

  if (options.signal) {
    options.signal.addEventListener('abort', onCallerAbort, { once: true });
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
        const extractedDetail = formatErrorDetail(errorJson?.detail);
        if (extractedDetail) {
          errorMessage = extractedDetail;
        } else if (response.statusText) {
          errorMessage = response.statusText;
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

    const isAbort =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError') ||
      controller.signal.aborted;

    if (isAbort) {
      const message = timedOut
        ? 'Request timed out waiting for server response.'
        : 'Request was cancelled.';
      throw new ApiError(message, undefined, true);
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
    if (options.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
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
