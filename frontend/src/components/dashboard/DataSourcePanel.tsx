import React from 'react';
import { Database, ShieldCheck, Server, Lock } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';
import { RadarStatusResponse } from '../../types/api';

interface DataSourcePanelProps {
  status: RadarStatusResponse | null;
  isOnline: boolean;
  observationWindow: string;
  disclaimer?: string;
  fetchedAt?: string | null;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  status,
  isOnline,
  observationWindow,
  disclaimer,
  fetchedAt,
}) => {
  const isConfigured = Boolean(status?.upstream_configured);
  const cacheHits = status?.cache_stats?.hits ?? 0;
  const cacheMisses = status?.cache_stats?.misses ?? 0;
  const totalEntries = status?.cache_stats?.total_entries ?? 0;

  return (
    <GlassCard
      title="Data Source & Security Integrity"
      subtitle="Operational telemetry and upstream Cloudflare Radar synchronization parameters"
      badge={<Badge variant="info">Audit Verified</Badge>}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Source 1: Upstream Provider */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                Cloudflare Radar API v4
              </span>
            </div>
            <Badge variant={isConfigured ? 'success' : 'warning'}>
              {isConfigured ? 'TOKEN ACTIVE' : 'UNCONFIGURED'}
            </Badge>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
            Macroscopic threat intelligence aggregated across 330+ Cloudflare global data centers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Base URL:</span>
              <span style={{ color: 'var(--text-secondary)' }}>https://api.cloudflare.com/...</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Window:</span>
              <span style={{ color: 'var(--accent-orange)' }}>{observationWindow.toUpperCase()} Aggregation</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Client Token:</span>
              <span style={{ color: 'var(--text-secondary)' }}>Server-Side Managed (Hidden)</span>
            </div>
          </div>
        </div>

        {/* Source 2: Backend Core Cache & Performance */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={16} color="var(--accent-green)" />
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                FastAPI Core & In-Memory TTL Cache
              </span>
            </div>
            <Badge variant={isOnline ? 'success' : 'error'} pulse={isOnline}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Badge>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
            Asynchronous caching layer insulating upstream quotas and preventing client rate exhaustion.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Cache Strategy:</span>
              <span style={{ color: 'var(--text-secondary)' }}>15-min TTL + Stale Fallback</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Cache Hit / Miss:</span>
              <span style={{ color: 'var(--accent-green)' }}>{cacheHits} hits / {cacheMisses} misses ({totalEntries} items)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Last Sync:</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Source 3: Strict Data Integrity Policy */}
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <ShieldCheck size={16} color="var(--accent-orange)" />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              Data Integrity & Simulation Charter
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '10px' }}>
            {disclaimer ||
              'Cloudflare Radar provides aggregate statistics, not raw attack events or exact IP coordinates. Animated 3D globe pulse arcs represent simulated directional flows calculated mathematically from genuine origin-to-target ratios.'}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Lock size={12} color="var(--accent-green)" />
            <span>Zero fabrication policy strictly enforced.</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
