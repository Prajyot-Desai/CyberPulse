import React, { useState } from 'react';
import { Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TimeseriesPoint } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import {
  detectSpikeCandidates,
  findCorrelatedSpikeCandidates,
  getNormalizedEpochMs,
} from '../../utils/analytics';

interface SpikeCandidatesPanelProps {
  layer3Data?: TimeseriesPoint[];
  layer7Data?: TimeseriesPoint[];
  observationWindow: string;
}

type FilterTab = 'all' | 'layer3' | 'layer7' | 'correlated';

interface UnifiedCandidateRow {
  id: string;
  timestamp: string;
  layerType: 'layer3' | 'layer7' | 'correlated';
  displayValue: string;
  zScoreDisplay: string;
  isCorrelated: boolean;
}

export const SpikeCandidatesPanel: React.FC<SpikeCandidatesPanelProps> = ({
  layer3Data = [],
  layer7Data = [],
  observationWindow,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  const l3Result = React.useMemo(
    () => detectSpikeCandidates(layer3Data, 2.0),
    [layer3Data]
  );
  const l7Result = React.useMemo(
    () => detectSpikeCandidates(layer7Data, 2.0),
    [layer7Data]
  );
  const correlatedResult = React.useMemo(
    () => findCorrelatedSpikeCandidates(layer3Data, layer7Data, 2.0),
    [layer3Data, layer7Data]
  );

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

  // Build unified candidate rows using normalized epoch matching
  const unifiedRows = React.useMemo(() => {
    const correlatedEpochs = new Set<number>();
    for (const c of correlatedResult.candidates) {
      const ep = getNormalizedEpochMs(c.timestamp);
      if (ep !== null) correlatedEpochs.add(ep);
    }

    const rows: UnifiedCandidateRow[] = [];

    // Add correlated candidates
    for (const c of correlatedResult.candidates) {
      rows.push({
        id: `correlated-${c.timestamp}`,
        timestamp: c.timestamp,
        layerType: 'correlated',
        displayValue: `L3: ${c.layer3Value.toFixed(2)} | L7: ${c.layer7Value.toFixed(2)}`,
        zScoreDisplay: `L3: +${c.layer3Score.toFixed(2)} | L7: +${c.layer7Score.toFixed(2)}`,
        isCorrelated: true,
      });
    }

    // Add Layer 3 candidates that are not correlated
    for (const c of l3Result.candidates) {
      const ep = getNormalizedEpochMs(c.timestamp);
      if (ep === null || !correlatedEpochs.has(ep)) {
        rows.push({
          id: `l3-${c.timestamp}`,
          timestamp: c.timestamp,
          layerType: 'layer3',
          displayValue: `${c.value.toFixed(2)}`,
          zScoreDisplay: `+${c.score.toFixed(2)}`,
          isCorrelated: false,
        });
      }
    }

    // Add Layer 7 candidates that are not correlated
    for (const c of l7Result.candidates) {
      const ep = getNormalizedEpochMs(c.timestamp);
      if (ep === null || !correlatedEpochs.has(ep)) {
        rows.push({
          id: `l7-${c.timestamp}`,
          timestamp: c.timestamp,
          layerType: 'layer7',
          displayValue: `${c.value.toFixed(2)}`,
          zScoreDisplay: `+${c.score.toFixed(2)}`,
          isCorrelated: false,
        });
      }
    }

    // Sort chronologically ascending by epoch
    return rows.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
        return timeA - timeB;
      }
      return a.timestamp.localeCompare(b.timestamp);
    });
  }, [l3Result.candidates, l7Result.candidates, correlatedResult.candidates]);

  // Filter rows based on active tab
  const filteredRows = React.useMemo(() => {
    switch (filter) {
      case 'layer3':
        return unifiedRows.filter(
          (r) => r.layerType === 'layer3' || r.layerType === 'correlated'
        );
      case 'layer7':
        return unifiedRows.filter(
          (r) => r.layerType === 'layer7' || r.layerType === 'correlated'
        );
      case 'correlated':
        return unifiedRows.filter((r) => r.layerType === 'correlated');
      case 'all':
      default:
        return unifiedRows;
    }
  }, [unifiedRows, filter]);

  // Status checks for edge-case empty states
  const isInsufficient =
    l3Result.status === 'insufficient_data' && l7Result.status === 'insufficient_data';
  const isZeroVariance =
    l3Result.status === 'zero_variance' && l7Result.status === 'zero_variance';

  return (
    <GlassCard
      title="Statistical Anomaly & Spike Candidates"
      subtitle={`Observations exceeding threshold of robust modified z-score ≥ 2.0 (median & MAD baseline) across past ${observationWindow}`}
      badge={<Badge variant="warning">Robust Score ≥ 2.0</Badge>}
      action={
        <div
          role="group"
          aria-label="Filter Spike Candidates by Layer"
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          {[
            { id: 'all' as FilterTab, label: `All (${unifiedRows.length})` },
            {
              id: 'correlated' as FilterTab,
              label: `Coinciding (${correlatedResult.candidates.length})`,
            },
            {
              id: 'layer3' as FilterTab,
              label: `Layer 3 (${l3Result.candidates.length})`,
            },
            {
              id: 'layer7' as FilterTab,
              label: `Layer 7 (${l7Result.candidates.length})`,
            },
          ].map((tab) => {
            const isSelected = filter === tab.id;
            return (
              <button
                key={tab.id}
                id={`spike-filter-${tab.id}`}
                onClick={() => setFilter(tab.id)}
                aria-pressed={isSelected}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isSelected ? 'var(--accent-orange)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-speed)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      }
    >
      {/* Informative Disclaimer Callout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '10px 14px',
          backgroundColor: 'rgba(255, 171, 0, 0.08)',
          border: '1px solid rgba(255, 171, 0, 0.25)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.45',
        }}
      >
        <AlertTriangle size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>Statistical Telemetry Notice:</strong> Observations listed below represent statistical outliers (robust modified z-score ≥ 2.0) relative to the median & MAD baseline of the selected window. They are mathematical telemetry anomalies, not confirmed security incidents or verified attack events. Layer 3 and Layer 7 metrics represent distinct physical dimensions and are never summed.
        </span>
      </div>

      {/* Content: Insufficient Data, Zero Variance, Empty, or Table */}
      {isInsufficient ? (
        <EmptyState
          icon={<Zap size={36} color="var(--text-muted)" />}
          title="Insufficient Data for Statistical Deviation"
          description={`At least 2 valid observations are required across the ${observationWindow} observation window to calculate baseline median and MAD scale.`}
          hint="Awaiting telemetry synchronization"
        />
      ) : isZeroVariance ? (
        <EmptyState
          icon={<ShieldCheck size={36} color="var(--accent-green)" />}
          title="Zero Variance Detected"
          description="All recorded observations across the selected observation window have identical values. Robust dispersion scale is zero, so no statistical anomalies can be derived."
          hint="Telemetry observations are completely uniform"
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={36} color="var(--accent-green)" />}
          title="No Spike Candidates Detected"
          description={`All recorded observations for the past ${observationWindow} remain within 2.0 robust score threshold of the baseline median.`}
          hint="Baseline activity is nominal"
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '8px 12px' }}>Timestamp (UTC)</th>
                <th style={{ padding: '8px 12px' }}>Telemetry Layer</th>
                <th style={{ padding: '8px 12px' }}>Observed Value</th>
                <th style={{ padding: '8px 12px' }}>Statistical Deviation (Robust Score)</th>
                <th style={{ padding: '8px 12px' }}>Classification</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background-color var(--transition-speed)',
                  }}
                  className="spike-table-row"
                >
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {row.layerType === 'correlated' ? (
                      <Badge variant="warning" pulse>
                        Coinciding L3 + L7
                      </Badge>
                    ) : row.layerType === 'layer3' ? (
                      <Badge variant="info">Layer 3 (Network)</Badge>
                    ) : (
                      <Badge variant="orange">Layer 7 (Application)</Badge>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {row.displayValue}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent-amber)' }}>
                    {row.zScoreDisplay}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    {row.isCorrelated
                      ? 'Simultaneous dual-layer anomaly candidate'
                      : 'Univariate statistical outlier candidate'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
};
