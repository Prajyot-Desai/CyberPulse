import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Clock } from 'lucide-react';
import { TimeseriesPoint } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { EmptyState } from '../common/EmptyState';
import { calculateUtcDiurnalDistribution } from '../../utils/analytics';

interface UtcDiurnalChartProps {
  layer3Data?: TimeseriesPoint[];
  layer7Data?: TimeseriesPoint[];
  observationWindow: string;
}

interface DiurnalTooltipPayload {
  name: string;
  value: number | null;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: DiurnalTooltipPayload[];
  label?: string;
}

const CustomDiurnalTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: '#0c1018',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        {label} UTC
      </div>
      {payload.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '3px',
          }}
        >
          <span style={{ color: item.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: item.color,
                display: 'inline-block',
              }}
            />
            {item.name}:
          </span>
          <span style={{ fontWeight: 600 }}>
            {item.value !== null && item.value !== undefined ? item.value.toFixed(2) : 'No data'}
          </span>
        </div>
      ))}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '4px',
        }}
      >
        Mean of observations for this UTC hour
      </div>
    </div>
  );
};

export const UtcDiurnalChart: React.FC<UtcDiurnalChartProps> = ({
  layer3Data = [],
  layer7Data = [],
  observationWindow,
}) => {
  const l3Buckets = React.useMemo(
    () => calculateUtcDiurnalDistribution(layer3Data),
    [layer3Data]
  );
  const l7Buckets = React.useMemo(
    () => calculateUtcDiurnalDistribution(layer7Data),
    [layer7Data]
  );

  const hasObservations = React.useMemo(() => {
    const hasL3 = l3Buckets.some((b) => b.count > 0);
    const hasL7 = l7Buckets.some((b) => b.count > 0);
    return hasL3 || hasL7;
  }, [l3Buckets, l7Buckets]);

  // Combine into 24-hour chart array
  const chartData = React.useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const l3 = l3Buckets[hour];
      const l7 = l7Buckets[hour];
      const hourLabel = `${hour.toString().padStart(2, '0')}:00`;

      return {
        hour,
        hourLabel,
        layer3: l3?.average !== null ? Number(l3.average.toFixed(2)) : null,
        layer7: l7?.average !== null ? Number(l7.average.toFixed(2)) : null,
        l3Count: l3?.count || 0,
        l7Count: l7?.count || 0,
      };
    });
  }, [l3Buckets, l7Buckets]);

  return (
    <GlassCard
      title="UTC Hourly Activity Pattern (Diurnal Cycle)"
      subtitle={`Average normalized activity for each UTC hour (00:00–23:00) across past ${observationWindow}`}
      action={
        hasObservations && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            24 Discrete UTC Buckets
          </span>
        )
      }
    >
      {!hasObservations ? (
        <EmptyState
          icon={<Clock size={36} color="var(--accent-cyan)" />}
          title="No Diurnal Telemetry Available"
          description={`Cloudflare Radar observations for the past ${observationWindow} have not been recorded or synchronized yet. Diurnal distribution will populate automatically once time-series observations are synced.`}
          hint="Calculated across all UTC days in the selected observation window"
        />
      ) : (
        <div style={{ height: '320px', width: '100%', marginTop: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="hourLabel"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                fontFamily="var(--font-mono)"
              />
              <Tooltip content={<CustomDiurnalTooltip />} />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)',
                  paddingTop: '10px',
                }}
              />
              <Bar
                dataKey="layer3"
                name="Layer 3 Volumetric Mean"
                fill="#00e5ff"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
              <Bar
                dataKey="layer7"
                name="Layer 7 Application Mean"
                fill="#ff5e00"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
};
