import React, { useState } from 'react';
import { LocationMetric } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { EmptyState } from '../common/EmptyState';
import { Globe } from 'lucide-react';

interface CountriesChartProps {
  targetCountries?: LocationMetric[];
  originCountries?: LocationMetric[];
}

export const CountriesChart: React.FC<CountriesChartProps> = ({
  targetCountries = [],
  originCountries = [],
}) => {
  const [viewMode, setViewMode] = useState<'target' | 'origin'>('target');

  const activeList = viewMode === 'target' ? targetCountries : originCountries;
  const hasData = activeList.length > 0;

  return (
    <GlassCard
      title="Geographic Attack Distribution"
      subtitle="Observed proportion of macroscopic attacks by country"
      action={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            padding: '2px',
          }}
        >
          <button
            onClick={() => setViewMode('target')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: viewMode === 'target' ? 'var(--accent-orange)' : 'transparent',
              color: viewMode === 'target' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Target ({targetCountries.length})
          </button>
          <button
            onClick={() => setViewMode('origin')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: viewMode === 'origin' ? 'var(--accent-cyan)' : 'transparent',
              color: viewMode === 'origin' ? '#000' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Origin ({originCountries.length})
          </button>
        </div>
      }
    >
      {!hasData ? (
        <EmptyState
          icon={<Globe size={32} color="var(--accent-cyan)" />}
          title={`No ${viewMode === 'target' ? 'Target' : 'Origin'} Country Data`}
          description="Country rankings will appear once upstream Cloudflare Radar geographic endpoints are synchronized."
          hint="Radar Endpoints: /radar/attacks/layer3/top/locations/target & origin"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
          {activeList.map((item, idx) => (
            <div key={`${item.country_code}-${idx}`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: viewMode === 'target' ? 'var(--accent-orange)' : 'var(--accent-cyan)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {item.country_code}
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {item.country_name}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.percentage}%
                </span>
              </div>

              {/* Progress visual bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-full)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(item.percentage, 100)}%`,
                    backgroundColor: viewMode === 'target' ? 'var(--accent-orange)' : 'var(--accent-cyan)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
