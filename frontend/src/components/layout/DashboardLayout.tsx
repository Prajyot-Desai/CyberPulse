import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';
import { DataStatus, ObservationWindow } from '../../types/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
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
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  title,
  description,
  dataStatus,
  isStale,
  isOnline,
  isLoading,
  isRefreshing,
  lastFetchedAt,
  observationWindow,
  onWindowChange,
  onRefresh,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isOnline={isOnline}
      />

      <div className="main-content">
        <Header
          title={title}
          description={description}
          dataStatus={dataStatus}
          isStale={isStale}
          isOnline={isOnline}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          lastFetchedAt={lastFetchedAt}
          observationWindow={observationWindow}
          onWindowChange={onWindowChange}
          onRefresh={onRefresh}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="content-body" id="main-content-region">
          {children}
        </main>
      </div>
    </div>
  );
};
