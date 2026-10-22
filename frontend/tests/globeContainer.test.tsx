import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobeContainer } from '../src/components/globe/GlobeContainer';
import * as webglUtils from '../src/utils/webgl';

describe('GlobeContainer & WebGL Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders graceful WebGL fallback when WebGL is unsupported', () => {
    // Force WebGL check to false
    vi.spyOn(webglUtils, 'isWebGLAvailable').mockReturnValue(false);

    render(<GlobeContainer observationWindow="7d" />);

    // Fallback region must be present
    expect(screen.getByRole('region', { name: /Geospatial Telemetry 2D Fallback View/i })).toBeInTheDocument();
    expect(screen.getByText('WebGL 3D Acceleration Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/3D WebGL context could not be initialized/i)).toBeInTheDocument();

    // Data integrity note must still be prominently visible
    expect(screen.getByText('Illustrative demo flows — not live attack events')).toBeInTheDocument();
  });

  it('allows user interaction with layer filters and arc controls even in fallback mode', () => {
    vi.spyOn(webglUtils, 'isWebGLAvailable').mockReturnValue(false);

    render(<GlobeContainer observationWindow="7d" />);

    // Layer buttons work
    const layer3Btn = screen.getByRole('button', { name: /Filter by Layer 3\/4/i });
    fireEvent.click(layer3Btn);
    expect(layer3Btn).toHaveAttribute('aria-pressed', 'true');

    // Arc toggle works
    const toggleArcsBtn = screen.getByRole('button', { name: /Hide threat arcs/i });
    fireEvent.click(toggleArcsBtn);
    expect(screen.getByRole('button', { name: /Show threat arcs/i })).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion preference by starting paused', () => {
    vi.spyOn(webglUtils, 'isWebGLAvailable').mockReturnValue(false);

    // Mock matchMedia to report reduce motion
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<GlobeContainer observationWindow="7d" />);

    const resumeBtn = screen.getByRole('button', { name: /Resume globe animation/i });
    expect(resumeBtn).toHaveTextContent('Paused');
  });
});
