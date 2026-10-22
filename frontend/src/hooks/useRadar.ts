import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, ApiError } from '../services/api';
import { HealthResponse, ObservationWindow, RadarOverviewResponse, RadarStatusResponse } from '../types/api';

export interface UseRadarReturn {
  overview: RadarOverviewResponse | null;
  status: RadarStatusResponse | null;
  health: HealthResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  error: string | null;
  observationWindow: ObservationWindow;
  setObservationWindow: (window: ObservationWindow) => void;
  refetch: () => Promise<void>;
  isStale: boolean;
  isUnconfigured: boolean;
  isUnavailable: boolean;
  lastFetchedAt: Date | null;
}

export function useRadar(initialWindow: ObservationWindow = '7d'): UseRadarReturn {
  const [observationWindow, setObservationWindow] = useState<ObservationWindow>(initialWindow);
  const [overview, setOverview] = useState<RadarOverviewResponse | null>(null);
  const [status, setStatus] = useState<RadarStatusResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Active abort controller for cancelling inflight requests on window switch
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (windowToFetch: ObservationWindow, isManualRefresh: boolean = false) => {
      // Abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        // Parallel requests to health, status, and overview
        const [healthRes, statusRes, overviewRes] = await Promise.all([
          apiService.checkHealth(controller.signal).catch((err) => {
            console.warn('Health check issue:', err);
            return null;
          }),
          apiService.getStatus(controller.signal).catch((err) => {
            console.warn('Status fetch issue:', err);
            return null;
          }),
          apiService.getOverview(windowToFetch, controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setHealth(healthRes);
          setStatus(statusRes);
          setOverview(overviewRes);
          setIsOffline(false);
          setLastFetchedAt(new Date());
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        if (err instanceof ApiError) {
          setError(err.message);
          setIsOffline(err.isOffline);
        } else {
          const msg = err instanceof Error ? err.message : 'Failed to fetch radar intelligence';
          setError(msg);
          setIsOffline(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  // Initial load and window change trigger
  useEffect(() => {
    fetchData(observationWindow, false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [observationWindow, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(observationWindow, true);
  }, [fetchData, observationWindow]);

  const isStale = Boolean(overview?.is_stale || overview?.status === 'stale');
  const isUnconfigured = Boolean(
    overview?.status === 'unconfigured' || status?.upstream_configured === false
  );
  const isUnavailable = Boolean(overview?.status === 'unavailable');

  return {
    overview,
    status,
    health,
    isLoading,
    isRefreshing,
    isOffline,
    error,
    observationWindow,
    setObservationWindow,
    refetch,
    isStale,
    isUnconfigured,
    isUnavailable,
    lastFetchedAt,
  };
}
