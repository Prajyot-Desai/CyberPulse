import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';

interface OfflineBannerProps {
  onRetry: () => void;
  isLoading: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onRetry, isLoading }) => {
  return (
    <div
      role="alert"
      id="offline-backend-alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'rgba(255, 51, 68, 0.1)',
        border: '1px solid rgba(255, 51, 68, 0.35)',
        color: 'var(--text-primary)',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 51, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)',
            flexShrink: 0,
          }}
        >
          <WifiOff size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
            CyberPulse Backend Unreachable
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Cannot connect to local FastAPI server on <code>http://127.0.0.1:8000</code>. Ensure Uvicorn is running.
          </div>
        </div>
      </div>

      <Button
        variant="danger"
        size="sm"
        onClick={onRetry}
        isLoading={isLoading}
        icon={<RefreshCw size={13} />}
      >
        Retry Connection
      </Button>
    </div>
  );
};
