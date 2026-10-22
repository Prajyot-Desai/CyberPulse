import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { TimeseriesPoint } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { EmptyState } from '../common/EmptyState';
import { Activity } from 'lucide-react';

interface TimeseriesChartProps {
  layer3Data?: TimeseriesPoint[];
  layer7Data?: TimeseriesPoint[];
  observationWindow: string;
}

export const TimeseriesChart: React.FC<TimeseriesChartProps> = ({
  layer3Data = [],
  layer7Data = [],
  observationWindow,
}) => {
  const hasData = layer3Data.length > 0 || layer7Data.length > 0;

  // Align timestamps into unified chart records sorted chronologically
  const chartData = React.useMemo(() => {
    if (!hasData) return [];

    const map = new Map<string, { timestamp: string; layer3?: number; layer7?: number }>();

    layer3Data.forEach((pt) => {
      map.set(pt.timestamp, { timestamp: pt.timestamp, layer3: pt.value });
    });

    layer7Data.forEach((pt) => {
      const existing = map.get(pt.timestamp);
      if (existing) {
        existing.layer7 = pt.value;
      } else {
        map.set(pt.timestamp, { timestamp: pt.timestamp, layer7: pt.value });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [layer3Data, layer7Data, hasData]);

  // Concise tick label tailored to the observation window
  const formatXAxisTick = (timestamp: string) => {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    if (observationWindow === '24h') {
      return (
        d.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          hour12: false,
        }) + ' UTC'
      );
    }
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  // Full unambiguous timestamp for tooltips (includes year, date, time, and UTC timezone)
  const formatTooltipTimestamp = (timestamp: string) => {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  };

  // Calculate sensible tick interval to prevent label overlap across different windows
  const tickInterval = React.useMemo(() => {
    const total = chartData.length;
    if (total <= 8) return 0; // Show all ticks when points are few
    // Aim for ~6 to 8 evenly distributed ticks across chart width
    return Math.max(1, Math.floor(total / 7));
  }, [chartData.length]);

  return (
    <GlassCard
      title="Aggregated Attack Activity Over Time"
      subtitle={`Chronological timeseries index over the past ${observationWindow}`}
      action={
        hasData && (
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Total Points: {chartData.length}
          </span>
        )
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<Activity size={32} color="var(--accent-orange)" />}
          title="No Timeseries Metrics Available"
          description={`Cloudflare Radar attack timeseries for the past ${observationWindow} have not been synced yet. Upstream data will automatically chart here once credentials are configured.`}
          hint="Radar Endpoints: /radar/attacks/layer3/timeseries & /layer7/timeseries"
        />
      ) : (
        <div style={{ height: '300px', width: '100%', marginTop: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorL3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorL7" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff5e00" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ff5e00" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxisTick}
                interval={tickInterval}
                minTickGap={25}
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <Tooltip
                labelFormatter={(label) => formatTooltipTimestamp(String(label))}
                formatter={(value: any, name: any) => [
                  typeof value === 'number' ? value.toFixed(2) : value,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: '#0c1018',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-sans)', paddingTop: '10px' }}
              />
              <Area
                type="monotone"
                dataKey="layer3"
                name="Layer 3 Volumetric"
                stroke="#00e5ff"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorL3)"
              />
              <Area
                type="monotone"
                dataKey="layer7"
                name="Layer 7 Application"
                stroke="#ff5e00"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorL7)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
};
