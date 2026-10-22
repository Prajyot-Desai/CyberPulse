import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { TimeseriesPoint } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';
import {
  calculatePeakAndTrough,
  calculateWindowTrajectory,
  detectSpikeCandidates,
  calculateRobustBaselineStats,
} from '../../utils/analytics';

interface HistoricalSummaryCardsProps {
  layer3Data?: TimeseriesPoint[];
  layer7Data?: TimeseriesPoint[];
  observationWindow: string;
}

export const HistoricalSummaryCards: React.FC<HistoricalSummaryCardsProps> = ({
  layer3Data = [],
  layer7Data = [],
  observationWindow,
}) => {
  const [selectedLayer, setSelectedLayer] = useState<'layer3' | 'layer7'>('layer3');

  const activePoints = selectedLayer === 'layer3' ? layer3Data : layer7Data;
  const isL3 = selectedLayer === 'layer3';

  const peakTrough = calculatePeakAndTrough(activePoints);
  const trajectory = calculateWindowTrajectory(activePoints);
  const spikeResult = detectSpikeCandidates(activePoints, 2.0);
  const robustStats = calculateRobustBaselineStats(activePoints);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  };

  // Trajectory direction and badge
  const getTrajectoryDisplay = () => {
    if (trajectory.status === 'insufficient_data') {
      return {
        value: 'Insufficient Data',
        subtext: 'Requires at least 4 chronological points',
        badge: <Badge variant="neutral">Unavailable</Badge>,
      };
    }
    if (trajectory.status === 'zero_baseline') {
      return {
        value: 'Zero Baseline',
        subtext: 'Opening quartile mean is 0.0 (no percentage base)',
        badge: <Badge variant="warning">Zero Base</Badge>,
      };
    }
    const change = trajectory.percentageChange ?? 0;
    const formattedChange = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

    if (change > 1.0) {
      return {
        value: `Increasing (${formattedChange})`,
        subtext: `Q1: ${trajectory.initialQuarterMean?.toFixed(2)} → Q4: ${trajectory.finalQuarterMean?.toFixed(2)}`,
        badge: <Badge variant="orange">Rising Trend</Badge>,
      };
    }
    if (change < -1.0) {
      return {
        value: `Decreasing (${formattedChange})`,
        subtext: `Q1: ${trajectory.initialQuarterMean?.toFixed(2)} → Q4: ${trajectory.finalQuarterMean?.toFixed(2)}`,
        badge: <Badge variant="success">Falling Trend</Badge>,
      };
    }
    return {
      value: `Flat (${formattedChange})`,
      subtext: `Q1: ${trajectory.initialQuarterMean?.toFixed(2)} ≈ Q4: ${trajectory.finalQuarterMean?.toFixed(2)}`,
      badge: <Badge variant="neutral">Stable</Badge>,
    };
  };

  const trajectoryDisplay = getTrajectoryDisplay();

  const getSpikeDisplay = () => {
    if (spikeResult.status === 'insufficient_data') {
      return {
        value: 'Unavailable',
        subtext: 'Requires at least 2 valid observations',
        badge: <Badge variant="neutral">N/A</Badge>,
      };
    }
    if (spikeResult.status === 'zero_variance') {
      return {
        value: 'Zero Variance',
        subtext: 'All observations have identical values (σ = 0)',
        badge: <Badge variant="warning">Static</Badge>,
      };
    }
    return {
      value: `${spikeResult.candidates.length} Candidate${spikeResult.candidates.length === 1 ? '' : 's'}`,
      subtext: `Baseline Median: ${robustStats.median?.toFixed(2)}, MAD scale: ${robustStats.scale?.toFixed(2)}`,
      badge: (
        <Badge variant={spikeResult.candidates.length > 0 ? 'warning' : 'neutral'}>
          {spikeResult.candidates.length > 0 ? 'Anomalies Detected' : 'Nominal'}
        </Badge>
      ),
    };
  };

  const spikeDisplay = getSpikeDisplay();

  const cards = [
    {
      id: 'summary-peak-card',
      title: 'Peak Observation',
      value: peakTrough ? peakTrough.peak.value.toFixed(2) : 'Unavailable',
      subtext: peakTrough ? formatTimestamp(peakTrough.peak.timestamp) : 'No valid observations',
      icon: <TrendingUp size={18} color="var(--accent-red)" />,
      badge: (
        <Badge variant={isL3 ? 'info' : 'orange'}>
          {isL3 ? 'L3 Network' : 'L7 App'}
        </Badge>
      ),
      tag: 'Maximum Value',
    },
    {
      id: 'summary-trough-card',
      title: 'Trough Observation',
      value: peakTrough ? peakTrough.trough.value.toFixed(2) : 'Unavailable',
      subtext: peakTrough ? formatTimestamp(peakTrough.trough.timestamp) : 'No valid observations',
      icon: <TrendingDown size={18} color="var(--accent-green)" />,
      badge: (
        <Badge variant={isL3 ? 'info' : 'orange'}>
          {isL3 ? 'L3 Network' : 'L7 App'}
        </Badge>
      ),
      tag: 'Minimum Value',
    },
    {
      id: 'summary-trajectory-card',
      title: 'Window Trajectory',
      value: trajectoryDisplay.value,
      subtext: trajectoryDisplay.subtext,
      icon: <Activity size={18} color="var(--accent-cyan)" />,
      badge: trajectoryDisplay.badge,
      tag: 'Within-Window Q1 vs Q4',
    },
    {
      id: 'summary-spikes-card',
      title: 'Spike Candidates',
      value: spikeDisplay.value,
      subtext: spikeDisplay.subtext,
      icon: <Zap size={18} color="var(--accent-amber)" />,
      badge: spikeDisplay.badge,
      tag: 'Robust z ≥ 2.0',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Controls Bar: Layer Selector and Telemetry Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Telemetry Layer:
          </span>
          <div
            role="group"
            aria-label="Select Telemetry Layer for Summary Analysis"
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
            }}
          >
            <button
              id="analytics-layer3-btn"
              onClick={() => setSelectedLayer('layer3')}
              aria-pressed={selectedLayer === 'layer3'}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: selectedLayer === 'layer3' ? 'var(--accent-cyan)' : 'transparent',
                color: selectedLayer === 'layer3' ? '#000000' : 'var(--text-secondary)',
                border: 'none',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-speed)',
              }}
            >
              Layer 3 (Network)
            </button>
            <button
              id="analytics-layer7-btn"
              onClick={() => setSelectedLayer('layer7')}
              aria-pressed={selectedLayer === 'layer7'}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: selectedLayer === 'layer7' ? 'var(--accent-orange)' : 'transparent',
                color: selectedLayer === 'layer7' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-speed)',
              }}
            >
              Layer 7 (Application)
            </button>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          Observation Window: {observationWindow} | Values are normalized telemetry indices
        </span>
      </div>

      {/* 4 Summary Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
        id="analytics-summary-grid"
      >
        {cards.map((card) => (
          <GlassCard
            key={card.id}
            className="metric-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  {card.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {card.badge}
                  {card.icon}
                </div>
              </div>

              <div
                style={{
                  fontSize: '20px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  marginBottom: '4px',
                }}
              >
                {card.value}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '11px',
                lineHeight: '1.4',
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span
                style={{
                  color: 'var(--text-secondary)',
                  wordBreak: 'break-word',
                  flex: 1,
                }}
              >
                {card.subtext}
              </span>
              {card.tag && (
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                  }}
                >
                  {card.tag}
                </span>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};
