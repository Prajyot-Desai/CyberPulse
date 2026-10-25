import React from 'react';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { sanitizeErrorMessage } from '../../utils/errors';

export interface ErrorBannerProps {
  title?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
  isLoading?: boolean;
  variant?: 'danger' | 'warning';
  id?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Telemetry Service Error',
  message,
  hint,
  onRetry,
  isLoading = false,
  variant = 'danger',
  id = 'api-error-alert',
}) => {
  const isWarning = variant === 'warning';
  const accentColor = isWarning ? 'var(--accent-amber)' : 'var(--accent-red)';
  const bgColor = isWarning ? 'rgba(255, 171, 0, 0.08)' : 'rgba(255, 51, 68, 0.1)';
  const borderColor = isWarning ? 'rgba(255, 171, 0, 0.3)' : 'rgba(255, 51, 68, 0.35)';
  const iconBg = isWarning ? 'rgba(255, 171, 0, 0.15)' : 'rgba(255, 51, 68, 0.2)';
  const sanitizedMessage = sanitizeErrorMessage(message);

  return (
    <div
      role="alert"
      id={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
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
            backgroundColor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {isWarning ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: accentColor }}>
            {title}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {sanitizedMessage}
          </div>
          {hint && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
              {hint}
            </div>
          )}
        </div>
      </div>

      {onRetry && (
        <Button
          variant={isWarning ? 'secondary' : 'danger'}
          size="sm"
          onClick={onRetry}
          isLoading={isLoading}
          icon={<RefreshCw size={13} />}
        >
          {isWarning ? 'Check Connection' : 'Retry Request'}
        </Button>
      )}
    </div>
  );
};
