import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface StaleWarningBannerProps {
  warningMessage?: string | null;
  fetchedAt?: string | null;
}

export const StaleWarningBanner: React.FC<StaleWarningBannerProps> = ({
  warningMessage,
  fetchedAt,
}) => {
  const formattedTime = fetchedAt
    ? new Date(fetchedAt).toLocaleString()
    : 'Previous synchronization';

  return (
    <div
      role="alert"
      id="stale-data-alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(255, 171, 0, 0.08)',
        border: '1px solid rgba(255, 171, 0, 0.3)',
        color: 'var(--accent-amber)',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <div>
          <span style={{ fontWeight: 600 }}>Stale Data Warning: </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {warningMessage ||
              'Serving last known good cached statistics because live upstream Cloudflare Radar retrieval was throttled or delayed.'}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        <Clock size={12} />
        <span>Cached: {formattedTime}</span>
      </div>
    </div>
  );
};
