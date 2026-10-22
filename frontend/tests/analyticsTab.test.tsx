import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { HistoricalSummaryCards } from '../src/components/analytics/HistoricalSummaryCards';
import { UtcDiurnalChart } from '../src/components/analytics/UtcDiurnalChart';
import { SpikeCandidatesPanel } from '../src/components/analytics/SpikeCandidatesPanel';
import { TimeseriesChart } from '../src/components/charts/TimeseriesChart';
import { TimeseriesPoint, RadarOverviewResponse } from '../src/types/api';
import { calculateUtcDiurnalDistribution } from '../src/utils/analytics';

const mockOverviewWithSpikes: RadarOverviewResponse = {
  status: 'fresh',
  data_source: 'Cloudflare Radar API v4',
  observation_window: '7d',
  fetched_at: '2026-10-21T18:00:00Z',
  is_stale: false,
  metrics: {
    layer3_timeseries: [
      // 9 baseline points at 10, plus 1 spike at 100
      ...Array.from({ length: 9 }, (_, i) => ({
        timestamp: `2026-10-20T0${i}:00:00Z`,
        value: 10,
      })),
      { timestamp: '2026-10-20T10:00:00Z', value: 100 },
    ],
    layer7_timeseries: [
      // 9 baseline points at 5, plus 1 spike at 80 at 10:00 (coinciding with L3)
      ...Array.from({ length: 9 }, (_, i) => ({
        timestamp: `2026-10-20T0${i}:00:00Z`,
        value: 5,
      })),
      { timestamp: '2026-10-20T10:00:00Z', value: 80 },
    ],
    top_target_countries: [
      { country_code: 'US', country_name: 'United States', percentage: 50.0 },
    ],
    top_origin_countries: [
      { country_code: 'CN', country_name: 'China', percentage: 40.0 },
    ],
    protocols: [{ protocol: 'UDP', percentage: 70.0 }],
  },
  disclaimer: 'Disclaimed',
  warning: null,
};

describe('Historical Attack Analytics UI Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. HistoricalSummaryCards
  // ---------------------------------------------------------------------------
  describe('HistoricalSummaryCards', () => {
    it('displays peak, trough, trajectory, and spike counts for valid data', () => {
      const l3Points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
        { timestamp: '2026-10-20T02:00:00Z', value: 30 },
        { timestamp: '2026-10-20T03:00:00Z', value: 40 },
        { timestamp: '2026-10-20T04:00:00Z', value: 100 },
      ];

      render(
        <HistoricalSummaryCards
          layer3Data={l3Points}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      // Peak observation
      expect(screen.getByText('Peak Observation')).toBeInTheDocument();
      expect(screen.getByText('100.00')).toBeInTheDocument();

      // Trough observation
      expect(screen.getByText('Trough Observation')).toBeInTheDocument();
      expect(screen.getByText('10.00')).toBeInTheDocument();

      // Trajectory card
      expect(screen.getByText('Window Trajectory')).toBeInTheDocument();
      expect(screen.getByText(/Increasing/i)).toBeInTheDocument();

      // Spike card
      expect(screen.getByText('Spike Candidates')).toBeInTheDocument();

      // Does not describe observations as attack counts
      expect(screen.queryByText(/Total Attacks/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/168 Aggregates/i)).not.toBeInTheDocument();
    });

    it('renders unavailable states when data is empty', () => {
      render(
        <HistoricalSummaryCards
          layer3Data={[]}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      // Peak and Trough unavailable
      const unavailables = screen.getAllByText('Unavailable');
      expect(unavailables.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Insufficient Data')).toBeInTheDocument();
    });

    it('switches between Layer 3 and Layer 7 using the layer selector', () => {
      const l3Points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 50 },
        { timestamp: '2026-10-20T01:00:00Z', value: 100 },
      ];
      const l7Points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 25 },
      ];

      render(
        <HistoricalSummaryCards
          layer3Data={l3Points}
          layer7Data={l7Points}
          observationWindow="7d"
        />
      );

      // Layer 3 is active by default
      expect(screen.getByText('100.00')).toBeInTheDocument();

      // Click Layer 7 button
      const l7Btn = screen.getByRole('button', { name: /Layer 7 \(Application\)/i });
      fireEvent.click(l7Btn);

      // Now peak should show 25.00 from Layer 7
      expect(screen.getByText('25.00')).toBeInTheDocument();
      expect(screen.getByText('10.00')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. UtcDiurnalChart
  // ---------------------------------------------------------------------------
  describe('UtcDiurnalChart', () => {
    it('renders empty state when no observations exist', () => {
      render(
        <UtcDiurnalChart
          layer3Data={[]}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      expect(screen.getByText('No Diurnal Telemetry Available')).toBeInTheDocument();
    });

    it('renders diurnal chart title and subtitle explaining UTC mean when data exists', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T10:00:00Z', value: 50 },
        { timestamp: '2026-10-21T10:00:00Z', value: 70 },
      ];

      render(
        <UtcDiurnalChart
          layer3Data={points}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      expect(screen.getByText('UTC Hourly Activity Pattern (Diurnal Cycle)')).toBeInTheDocument();
      expect(screen.getByText(/Average normalized activity for each UTC hour/i)).toBeInTheDocument();
      expect(screen.getByText('24 Discrete UTC Buckets')).toBeInTheDocument();
    });

    it('preserves null values for unobserved hours and disables the default grey cursor rectangle', () => {
      // Single observation at 10:00 UTC; 00:00 UTC has no observations
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T10:00:00Z', value: 50 },
      ];

      const { container } = render(
        <UtcDiurnalChart
          layer3Data={points}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      // Verify that calculateUtcDiurnalDistribution returns null for 00:00 UTC (not 0.0)
      const buckets = calculateUtcDiurnalDistribution(points);
      expect(buckets[0].average).toBeNull();
      expect(buckets[0].count).toBe(0);

      // Ensure that recharts tooltip cursor rectangle is disabled (cursor={false})
      const cursor = container.querySelector('.recharts-tooltip-cursor');
      expect(cursor).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. TimeseriesChart
  // ---------------------------------------------------------------------------
  describe('TimeseriesChart', () => {
    it('renders empty state when no data exists', () => {
      render(
        <TimeseriesChart
          layer3Data={[]}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      expect(screen.getByText('No Timeseries Metrics Available')).toBeInTheDocument();
    });

    it('renders chart title and total points when timeseries data exists', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
      ];

      render(
        <TimeseriesChart
          layer3Data={points}
          layer7Data={[]}
          observationWindow="24h"
        />
      );

      expect(screen.getByText('Aggregated Attack Activity Over Time')).toBeInTheDocument();
      expect(screen.getByText('Total Points: 2')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SpikeCandidatesPanel
  // ---------------------------------------------------------------------------
  describe('SpikeCandidatesPanel', () => {
    it('displays statistical disclaimer distinguishing anomalies from confirmed incidents with readable ≥ symbol', () => {
      render(
        <SpikeCandidatesPanel
          layer3Data={[]}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      expect(
        screen.getByText(/Statistical Telemetry Notice:/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/not confirmed security incidents or verified attack events/i)
      ).toBeInTheDocument();
      // Ensure readable unicode ≥ is rendered, not raw LaTeX $\ge
      const matchingElements = screen.getAllByText(/robust modified z-score ≥ 2\.0/i);
      expect(matchingElements.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/\$\\ge/)).not.toBeInTheDocument();
    });

    it('displays insufficient data state when fewer than 2 observations exist', () => {
      render(
        <SpikeCandidatesPanel
          layer3Data={[{ timestamp: '2026-10-20T00:00:00Z', value: 10 }]}
          layer7Data={[]}
          observationWindow="7d"
        />
      );

      expect(
        screen.getByText('Insufficient Data for Statistical Deviation')
      ).toBeInTheDocument();
    });

    it('displays zero variance state when all observations are identical', () => {
      const identicalPoints = [
        { timestamp: '2026-10-20T00:00:00Z', value: 20 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
        { timestamp: '2026-10-20T02:00:00Z', value: 20 },
      ];

      render(
        <SpikeCandidatesPanel
          layer3Data={identicalPoints}
          layer7Data={identicalPoints}
          observationWindow="7d"
        />
      );

      expect(screen.getByText('Zero Variance Detected')).toBeInTheDocument();
      expect(
        screen.getByText(/All recorded observations across the selected observation window have identical values/i)
      ).toBeInTheDocument();
    });

    it('renders spike candidates with separate layer values without summing them', () => {
      render(
        <SpikeCandidatesPanel
          layer3Data={mockOverviewWithSpikes.metrics?.layer3_timeseries}
          layer7Data={mockOverviewWithSpikes.metrics?.layer7_timeseries}
          observationWindow="7d"
        />
      );

      // Coinciding spike at 10:00 UTC should be rendered with L3 and L7 separated
      expect(screen.getByText(/Coinciding L3 \+ L7/i)).toBeInTheDocument();
      expect(screen.getByText(/L3: 100.00 \| L7: 80.00/i)).toBeInTheDocument();
      // Values are not summed (100 + 80 = 180 should NOT appear as a total)
      expect(screen.queryByText('180.00')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Analytics Tab Integration in App
  // ---------------------------------------------------------------------------
  describe('Analytics Tab Integration in App', () => {
    it('navigates to Attack Analytics and renders dedicated analytics components without duplicating overview charts', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const u = url.toString();
        if (u.includes('/health')) return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        if (u.includes('/radar/status')) return { ok: true, json: async () => ({ upstream_configured: true }) } as Response;
        return { ok: true, json: async () => mockOverviewWithSpikes } as Response;
      });

      render(<App />);

      const analyticsTabBtn = screen.getByRole('button', { name: /Attack Analytics/i });
      fireEvent.click(analyticsTabBtn);

      await waitFor(() => {
        expect(screen.getByText('Attack Analytics & Telemetry')).toBeInTheDocument();
        // Summary cards
        expect(screen.getByText('Peak Observation')).toBeInTheDocument();
        expect(screen.getByText('Trough Observation')).toBeInTheDocument();
        expect(screen.getByText('Window Trajectory')).toBeInTheDocument();
        // Diurnal chart
        expect(screen.getByText('UTC Hourly Activity Pattern (Diurnal Cycle)')).toBeInTheDocument();
        // Spike candidates panel
        expect(screen.getByText('Statistical Anomaly & Spike Candidates')).toBeInTheDocument();
      });

      // Confirm CountriesChart and ProtocolChart are NOT duplicated in the Analytics tab
      expect(screen.queryByText('Transport Protocol Breakdown')).not.toBeInTheDocument();
      expect(screen.queryByText('Top Targeted Nations')).not.toBeInTheDocument();
    });

    it('updates analytical panels when observation window changes', async () => {
      let requestedWindow = '7d';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
        const u = url.toString();
        if (u.includes('/health')) return { ok: true, json: async () => ({ status: 'ok' }) } as Response;
        if (u.includes('/radar/status')) return { ok: true, json: async () => ({ upstream_configured: true }) } as Response;
        
        if (u.includes('dateRange=30d')) {
          requestedWindow = '30d';
        }
        return {
          ok: true,
          json: async () => ({
            ...mockOverviewWithSpikes,
            observation_window: requestedWindow,
          }),
        } as Response;
      });

      render(<App />);

      // Switch to Analytics tab
      const analyticsTabBtn = screen.getByRole('button', { name: /Attack Analytics/i });
      fireEvent.click(analyticsTabBtn);

      // Switch to 30 Days window
      const window30dBtn = screen.getByRole('button', { name: /30 Days/i });
      fireEvent.click(window30dBtn);

      await waitFor(() => {
        expect(screen.getByText(/Observation Window: 30d/i)).toBeInTheDocument();
      });
    });
  });
});
