import React, { useState } from 'react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { NavTab } from './components/layout/Sidebar';
import { useRadar } from './hooks/useRadar';
import { StaleWarningBanner } from './components/dashboard/StaleWarningBanner';
import { OfflineBanner } from './components/dashboard/OfflineBanner';
import { MetricCards } from './components/metrics/MetricCards';
import { GlobePlaceholder } from './components/dashboard/GlobePlaceholder';
import { TimeseriesChart } from './components/charts/TimeseriesChart';
import { CountriesChart } from './components/charts/CountriesChart';
import { ProtocolChart } from './components/charts/ProtocolChart';
import { DataSourcePanel } from './components/dashboard/DataSourcePanel';
import { GlassCard } from './components/common/GlassCard';
import { Badge } from './components/common/Badge';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  const {
    overview,
    status,
    isLoading,
    isRefreshing,
    isOffline,
    observationWindow,
    setObservationWindow,
    refetch,
    isStale,
    lastFetchedAt,
  } = useRadar('7d');

  const getPageInfo = (): { title: string; description: string } => {
    switch (activeTab) {
      case 'threats':
        return {
          title: 'Global Threat Vectors',
          description: 'Geospatial vector paths and volumetric traffic flow distribution.',
        };
      case 'analytics':
        return {
          title: 'Attack Analytics & Telemetry',
          description: 'Historical Layer 3 and Layer 7 timeseries distributions.',
        };
      case 'sources':
        return {
          title: 'Intelligence Data Sources',
          description: 'Cloudflare Radar API status, cache performance, and audit verification.',
        };
      case 'settings':
        return {
          title: 'System Preferences & Configuration',
          description: 'Backend endpoint connectivity, polling interval, and simulation toggles.',
        };
      case 'overview':
      default:
        return {
          title: 'Global DDoS Intelligence',
          description: 'Real-time aggregated cyber intelligence telemetry powered by Cloudflare Radar.',
        };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={pageInfo.title}
      description={pageInfo.description}
      dataStatus={overview?.status}
      isStale={isStale}
      isOnline={!isOffline}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      lastFetchedAt={lastFetchedAt}
      observationWindow={observationWindow}
      onWindowChange={setObservationWindow}
      onRefresh={refetch}
    >
      {/* 1. Offline Banner if backend cannot be reached */}
      {isOffline && <OfflineBanner onRetry={refetch} isLoading={isRefreshing} />}

      {/* 2. Stale Data Warning Banner */}
      {!isOffline && isStale && (
        <StaleWarningBanner
          warningMessage={overview?.warning}
          fetchedAt={overview?.fetched_at}
        />
      )}

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics Row */}
          <MetricCards
            metrics={overview?.metrics || null}
            status={overview?.status}
            isLoading={isLoading}
            observationWindow={observationWindow}
          />

          {/* 3D Globe Visualizer */}
          <GlobePlaceholder
            observationWindow={observationWindow}
            metrics={overview?.metrics}
          />

          {/* Analytics Grid: Timeseries and Breakdowns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: '20px',
            }}
          >
            <TimeseriesChart
              layer3Data={overview?.metrics?.layer3_timeseries}
              layer7Data={overview?.metrics?.layer7_timeseries}
              observationWindow={observationWindow}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <CountriesChart
                targetCountries={overview?.metrics?.top_target_countries}
                originCountries={overview?.metrics?.top_origin_countries}
              />
              <ProtocolChart protocols={overview?.metrics?.protocols} />
            </div>
          </div>

          {/* Data Source & Integrity Panel */}
          <DataSourcePanel
            status={status}
            isOnline={!isOffline}
            observationWindow={observationWindow}
            disclaimer={overview?.disclaimer}
            fetchedAt={overview?.fetched_at}
          />
        </>
      )}

      {/* TAB: GLOBAL THREATS */}
      {activeTab === 'threats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <GlobePlaceholder
            observationWindow={observationWindow}
            metrics={overview?.metrics}
          />
        </div>
      )}

      {/* TAB: ATTACK ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <TimeseriesChart
            layer3Data={overview?.metrics?.layer3_timeseries}
            layer7Data={overview?.metrics?.layer7_timeseries}
            observationWindow={observationWindow}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '20px',
            }}
          >
            <CountriesChart
              targetCountries={overview?.metrics?.top_target_countries}
              originCountries={overview?.metrics?.top_origin_countries}
            />
            <ProtocolChart protocols={overview?.metrics?.protocols} />
          </div>
        </div>
      )}

      {/* TAB: DATA SOURCES */}
      {activeTab === 'sources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <DataSourcePanel
            status={status}
            isOnline={!isOffline}
            observationWindow={observationWindow}
            disclaimer={overview?.disclaimer}
            fetchedAt={overview?.fetched_at}
          />
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeTab === 'settings' && (
        <GlassCard
          title="System Preferences & Connectivity"
          subtitle="Client-side configuration and proxy mappings"
          badge={<Badge variant="neutral">Settings</Badge>}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Backend REST Proxy
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Directs API traffic from the Vite dev server to FastAPI.
              </div>
              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                Target: http://127.0.0.1:8000
              </code>
            </div>

            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Data Integrity Mode
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Strict policy preventing simulated flows from being mislabeled as observed events.
              </div>
              <Badge variant="success">STRICT AUDIT ENABLED</Badge>
            </div>
          </div>
        </GlassCard>
      )}
    </DashboardLayout>
  );
};

export default App;
