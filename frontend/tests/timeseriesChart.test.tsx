import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TimeseriesChart } from '../src/components/charts/TimeseriesChart';
import { TimeseriesPoint } from '../src/types/api';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 800, height: 400 }}>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<any>, { width: 800, height: 400 })
          : children}
      </div>
    ),
  };
});

describe('TimeseriesChart Component Integration', () => {
  it('renders chart component with 1d observation window and formats hourly UTC labels', () => {
    const points: TimeseriesPoint[] = [
      { timestamp: '2026-10-20T14:30:00Z', value: 12.5 },
      { timestamp: '2026-10-20T15:30:00Z', value: 25.0 },
    ];

    const { container } = render(
      <TimeseriesChart
        layer3Data={points}
        layer7Data={[]}
        observationWindow="1d"
      />
    );

    // Verify component rendered title, points badge, and observation window subtitle
    expect(screen.getByText('Aggregated Attack Activity Over Time')).toBeInTheDocument();
    expect(screen.getByText('Chronological timeseries index over the past 1d')).toBeInTheDocument();
    expect(screen.getByText('Total Points: 2')).toBeInTheDocument();

    // Verify tick labels rendered inside the Recharts XAxis
    // With 1d window, tickFormatter formats as 'HH:mm UTC'
    const tickElements = container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value');
    expect(tickElements.length).toBeGreaterThan(0);
    const tickTexts = Array.from(tickElements).map((el) => el.textContent);
    expect(tickTexts.some((text) => text?.includes('UTC'))).toBe(true);
    expect(tickTexts.some((text) => text?.includes('14:30') || text?.includes('15:30'))).toBe(true);
  });

  it('renders chart component with 7d observation window and formats calendar date labels without hourly UTC time', () => {
    const points: TimeseriesPoint[] = [
      { timestamp: '2026-10-20T14:30:00Z', value: 12.5 },
      { timestamp: '2026-10-21T14:30:00Z', value: 25.0 },
    ];

    const { container } = render(
      <TimeseriesChart
        layer3Data={points}
        layer7Data={[]}
        observationWindow="7d"
      />
    );

    expect(screen.getByText('Chronological timeseries index over the past 7d')).toBeInTheDocument();

    // Verify multi-day ticks render calendar date (e.g., Oct 20) and do NOT contain 'UTC' or ':'
    const tickElements = container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value');
    expect(tickElements.length).toBeGreaterThan(0);
    const tickTexts = Array.from(tickElements).map((el) => el.textContent);
    expect(tickTexts.every((text) => !text?.includes('UTC'))).toBe(true);
    expect(tickTexts.some((text) => text?.includes('20') || text?.includes('21'))).toBe(true);
  });
});
