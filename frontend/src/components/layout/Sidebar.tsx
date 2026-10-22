import React from 'react';
import {
  Activity,
  Globe2,
  BarChart3,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Badge } from '../common/Badge';

export type NavTab = 'overview' | 'threats' | 'analytics' | 'sources' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  isOnline,
}) => {
  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: <Activity size={18} />,
      badge: null,
      isPrimary: true,
    },
    {
      id: 'threats' as NavTab,
      label: 'Global Threats',
      icon: <Globe2 size={18} />,
      badge: <Badge variant="orange">M4</Badge>,
      isPrimary: false,
    },
    {
      id: 'analytics' as NavTab,
      label: 'Attack Analytics',
      icon: <BarChart3 size={18} />,
      badge: null,
      isPrimary: false,
    },
    {
      id: 'sources' as NavTab,
      label: 'Data Sources',
      icon: <Database size={18} />,
      badge: <Badge variant="neutral">CF</Badge>,
      isPrimary: false,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: <Settings size={18} />,
      badge: null,
      isPrimary: false,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onCloseMobile();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            cursor: 'pointer',
          }}
        />
      )}

      {/* Sidebar Navigation Container */}
      <aside
        id="cyberpulse-sidebar"
        aria-label="Main Navigation"
        style={{
          width: isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
          transition: 'width var(--transition-speed) var(--transition-timing), transform var(--transition-speed)',
          flexShrink: 0,
        }}
        className={`sidebar-root ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Logo and Brand */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0' : '0 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 94, 0, 0.12)',
                border: '1px solid rgba(255, 94, 0, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-orange)',
                boxShadow: 'var(--shadow-glow-orange)',
                flexShrink: 0,
              }}
            >
              <Activity size={20} />
            </div>

            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '16px',
                      letterSpacing: '-0.02em',
                      color: 'var(--text-primary)',
                    }}
                  >
                    CyberPulse
                  </span>
                  <span className="pulse-indicator pulse-orange" />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  DDoS Intelligence
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="mobile-close-btn"
            aria-label="Close navigation"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'none',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav
          style={{
            flex: 1,
            padding: isCollapsed ? '16px 8px' : '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  width: '100%',
                  padding: isCollapsed ? '10px 0' : '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'var(--accent-orange-muted)' : 'transparent',
                  color: isActive ? 'var(--accent-orange)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(255, 94, 0, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all var(--transition-speed) ease',
                  textAlign: 'left',
                }}
                className="sidebar-nav-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && item.badge}
              </button>
            );
          })}
        </nav>

        {/* Footer info & collapse toggle */}
        <div
          style={{
            padding: isCollapsed ? '16px 8px' : '16px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Backend Status indicator */}
          {!isCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={14} color={isOnline ? 'var(--accent-green)' : 'var(--accent-red)'} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>FastAPI Core</span>
              </div>
              <Badge variant={isOnline ? 'success' : 'error'} pulse={isOnline}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: '8px',
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              transition: 'color var(--transition-speed)',
            }}
            className="collapse-toggle-btn"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
