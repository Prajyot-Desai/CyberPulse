import React from 'react';
import { Shield, Target, Radio, Network, Globe } from 'lucide-react';
import { RadarMetrics, DataStatus } from '../../types/api';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';

interface MetricCardsProps {
  metrics: RadarMetrics | null;
  status?: DataStatus;
  isLoading: boolean;
  observationWindow: string;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  metrics,
  status,
  isLoading,
  observationWindow,
}) => {
  // If no metrics are available (e.g. unconfigured, unavailable, or initial loading without cache)
  if (!metrics || status === 'unconfigured' || status === 'unavailable') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
        id="overview-metrics-grid"
      >
        {[
          { title: 'Layer 3/4 Attack Trend', icon: <Network size={18} /> },
          { title: 'Layer 7 Application Attacks', icon: <Shield size={18} /> },
          { title: 'Top Targeted Region', icon: <Target size={18} /> },
          { title: 'Top Origin Region', icon: <Globe size={18} /> },
          { title: 'Dominant Protocol', icon: <Radio size={18} /> },
        ].map((card, idx) => (
          <GlassCard key={idx} className="metric-skeleton-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {card.title}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{card.icon}</span>
            </div>
            <div style={{ minHeight: '52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div
                style={{
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                {isLoading ? 'SYNCING...' : status === 'unconfigured' ? 'UNCONFIGURED' : 'DATA UNAVAILABLE'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {status === 'unconfigured'
                  ? 'Awaiting Cloudflare API Token in .env'
                  : 'Upstream aggregate data pending'}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  // Real Available Metrics from Backend Response
  const l3PointsCount = metrics.layer3_timeseries?.length || 0;
  const l7PointsCount = metrics.layer7_timeseries?.length || 0;
  const topTarget = metrics.top_target_countries?.[0];
  const topOrigin = metrics.top_origin_countries?.[0];
  const dominantProtocol = metrics.protocols?.[0];

  const cards = [
    {
      title: 'Layer 3/4 Attack Trend',
      value: l3PointsCount > 0 ? `${l3PointsCount} Aggregates` : 'No data points',
      subtext: `Telemetry buckets for past ${observationWindow}`,
      icon: <Network size={20} color="var(--accent-cyan)" />,
      badge: <Badge variant="info">Network Layer</Badge>,
      tag: 'Macroscopic Index',
    },
    {
      title: 'Layer 7 HTTP Attacks',
      value: l7PointsCount > 0 ? `${l7PointsCount} Aggregates` : 'No data points',
      subtext: 'Mitigated WAF / DDoS HTTP requests',
      icon: <Shield size={20} color="var(--accent-orange)" />,
      badge: <Badge variant="orange">Application</Badge>,
      tag: 'Timeseries Trend',
    },
    {
      title: 'Top Targeted Country',
      value: topTarget ? `${topTarget.country_name} (${topTarget.country_code})` : 'Undisclosed',
      subtext: topTarget ? `${topTarget.percentage}% of observed attack volume` : 'Aggregate not reported',
      icon: <Target size={20} color="var(--accent-red)" />,
      badge: <Badge variant="error">Target</Badge>,
      tag: 'Geographic Ratio',
    },
    {
      title: 'Top Attack Origin',
      value: topOrigin ? `${topOrigin.country_name} (${topOrigin.country_code})` : 'Undisclosed',
      subtext: topOrigin ? `${topOrigin.percentage}% of total observed traffic` : 'Distribution pending',
      icon: <Globe size={20} color="var(--accent-cyan)" />,
      badge: <Badge variant="info">Origin</Badge>,
      tag: 'Source Location',
    },
    {
      title: 'Dominant Protocol',
      value: dominantProtocol ? dominantProtocol.protocol : 'Undisclosed',
      subtext: dominantProtocol ? `${dominantProtocol.percentage}% of total observed traffic` : 'Distribution pending',
      icon: <Radio size={20} color="var(--accent-green)" />,
      badge: <Badge variant="success">Protocol</Badge>,
      tag: 'Transport Layer',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
      }}
      id="overview-metrics-grid"
    >
      {cards.map((card, idx) => (
        <GlassCard
          key={idx}
          className="metric-card"
          style={{
            position: 'relative',
            overflow: 'hidden',
          }}
        >
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
              fontSize: '22px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            {card.value}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            <span>{card.subtext}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {card.tag}
            </span>
          </div>
        </GlassCard>
      ))}
    </div>
  );
};
