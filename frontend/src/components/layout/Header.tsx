import React, { useState, useEffect } from 'react';
import { RefreshCw, Menu, Clock } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { DataStatus, ObservationWindow } from '../../types/api';

interface HeaderProps {
  title: string;
  description: string;
  dataStatus?: DataStatus;
  isStale?: boolean;
  isOnline: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: Date | null;
  observationWindow: ObservationWindow;
  onWindowChange: (window: ObservationWindow) => void;
  onRefresh: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  description,
  dataStatus,
  isStale = false,
  isOnline,
  isLoading,
  isRefreshing,
  lastFetchedAt,
  observationWindow,
  onWindowChange,
  onRefresh,
  onToggleMobileMenu,
}) => {
  const windowOptions: { id: ObservationWindow; label: string }[] = [
    { id: '1d', label: '24 Hours' },
    { id: '7d', label: '7 Days' },
    { id: '14d', label: '14 Days' },
    { id: '30d', label: '30 Days' },
  ];

  const getStatusBadge = () => {
    if (!isOnline) {
      return (
        <Badge variant="error" pulse>
          OFFLINE
        </Badge>
      );
    }
    if (isLoading && !isRefreshing) {
      return (
        <Badge variant="info" pulse>
          SYNCING...
        </Badge>
      );
    }
    if (isStale || dataStatus === 'stale') {
      return (
        <Badge variant="warning" pulse>
          STALE CACHE
        </Badge>
      );
    }
    if (dataStatus === 'unconfigured') {
      return <Badge variant="neutral">UNCONFIGURED</Badge>;
    }
    if (dataStatus === 'unavailable') {
      return <Badge variant="error">UNAVAILABLE</Badge>;
    }
    if (dataStatus === 'fresh') {
      return (
        <Badge variant="success" pulse>
          LIVE RADAR
        </Badge>
      );
    }
    return <Badge variant="neutral">READY</Badge>;
  };

  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header
      id="cyberpulse-header"
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Title & Page Description */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onToggleMobileMenu}
          aria-label="Open navigation menu"
          className="mobile-hamburger-btn"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'none',
            padding: '6px',
          }}
        >
          <Menu size={22} />
        </button>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </h1>
            {getStatusBadge()}
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '1px',
            }}
          >
            {description}
          </p>
        </div>
      </div>

      {/* Controls: Time Window, Sync Timestamp, Manual Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Time Window Switcher */}
        <div
          role="group"
          aria-label="Select Observation Window"
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
          className="header-window-pills"
        >
          {windowOptions.map((opt) => {
            const isSelected = observationWindow === opt.id;
            return (
              <button
                key={opt.id}
                id={`window-btn-${opt.id}`}
                onClick={() => onWindowChange(opt.id)}
                aria-pressed={isSelected}
                style={{
                  padding: '5px 10px',
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
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Live clock display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
          className="header-sync-time"
          title={`Last data sync: ${lastFetchedAt ? lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not yet synced'}`}
        >
          <Clock size={13} />
          <span>{formatClockTime(currentTime)}</span>
        </div>

        {/* Manual Refresh Button */}
        <Button
          id="manual-refresh-btn"
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          isLoading={isRefreshing}
          disabled={isLoading || isRefreshing}
          icon={<RefreshCw size={14} />}
          title="Query latest statistics from backend"
          aria-label="Refresh Radar intelligence data"
        >
          <span>Refresh</span>
        </Button>
      </div>
    </header>
  );
};
