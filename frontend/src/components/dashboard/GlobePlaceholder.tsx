import React from 'react';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';
import { GlobeContainer } from '../globe/GlobeContainer';
import { RadarMetrics } from '../../types/api';

export interface GlobePlaceholderProps {
  observationWindow: string;
  metrics?: RadarMetrics | null;
}

export const GlobePlaceholder: React.FC<GlobePlaceholderProps> = ({
  observationWindow,
  metrics,
}) => {
  return (
    <GlassCard
      title="3D Geospatial Threat Visualizer"
      subtitle="Interactive 3D WebGL Globe displaying aggregate flow vectors derived from Cloudflare Radar"
      badge={<Badge variant="info">Interactive 3D Globe</Badge>}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            Projection: 3D Spherical
          </span>
        </div>
      }
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <GlobeContainer
        observationWindow={observationWindow}
        metrics={metrics}
        height="440px"
      />
    </GlassCard>
  );
};

export default GlobePlaceholder;
