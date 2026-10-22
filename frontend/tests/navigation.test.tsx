import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('Navigation and Layout Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'unconfigured',
        data_source: 'Cloudflare Radar API v4',
        observation_window: '7d',
        fetched_at: null,
        is_stale: false,
        metrics: null,
        disclaimer: 'Disclaimed',
        warning: 'Unconfigured',
      }),
    } as Response);
  });

  it('navigates to Global Threats tab and shows M4 roadmap notice', async () => {
    render(<App />);

    const threatsBtn = screen.getByRole('button', { name: /Global Threats/i });
    fireEvent.click(threatsBtn);

    await waitFor(() => {
      expect(screen.getByText('Global Threat Vectors')).toBeInTheDocument();
      expect(screen.getByText(/3D Globe Geospatial Engine Scheduled for Milestone 4/i)).toBeInTheDocument();
    });
  });

  it('navigates to Attack Analytics tab', async () => {
    render(<App />);

    const analyticsBtn = screen.getByRole('button', { name: /Attack Analytics/i });
    fireEvent.click(analyticsBtn);

    await waitFor(() => {
      expect(screen.getByText('Attack Analytics & Telemetry')).toBeInTheDocument();
    });
  });

  it('navigates to Data Sources tab', async () => {
    render(<App />);

    const sourcesBtn = screen.getByRole('button', { name: /Data Sources/i });
    fireEvent.click(sourcesBtn);

    await waitFor(() => {
      expect(screen.getByText('Intelligence Data Sources')).toBeInTheDocument();
      expect(screen.getByText('Data Source & Security Integrity')).toBeInTheDocument();
    });
  });

  it('navigates to Settings tab', async () => {
    render(<App />);

    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('System Preferences & Configuration')).toBeInTheDocument();
      expect(screen.getByText('Backend REST Proxy')).toBeInTheDocument();
    });
  });

  it('toggles sidebar collapse state without crashing', () => {
    render(<App />);

    const collapseBtn = screen.getByRole('button', { name: /Collapse sidebar/i });
    fireEvent.click(collapseBtn);

    const expandBtn = screen.getByRole('button', { name: /Expand sidebar/i });
    expect(expandBtn).toBeInTheDocument();
  });
});
