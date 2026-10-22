import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobeControls, GlobeControlsProps } from '../src/components/globe/GlobeControls';

describe('GlobeControls Component', () => {
  const defaultProps: GlobeControlsProps = {
    observationWindow: '7d',
    isPaused: false,
    onTogglePause: vi.fn(),
    showConnections: true,
    onToggleConnections: vi.fn(),
    activeLayer: 'all',
    onLayerChange: vi.fn(),
    onResetOrientation: vi.fn(),
    isSimulatedNoticeVisible: true,
  };

  it('renders projection header and observation window specification', () => {
    render(<GlobeControls {...defaultProps} />);

    expect(screen.getByText('3D WebGL Spherical Projection')).toBeInTheDocument();
    expect(screen.getByText('7D Aggregation')).toBeInTheDocument();
  });

  it('renders mandatory illustrative flow data disclaimer note', () => {
    render(<GlobeControls {...defaultProps} />);

    const disclaimer = screen.getByText('Illustrative demo flows — not live attack events');
    expect(disclaimer).toBeInTheDocument();
  });

  it('toggles pause/active state and fires onTogglePause on click', () => {
    const onTogglePause = vi.fn();
    const { rerender } = render(
      <GlobeControls {...defaultProps} isPaused={false} onTogglePause={onTogglePause} />
    );

    const pauseBtn = screen.getByRole('button', { name: /Pause globe animation/i });
    expect(pauseBtn).toHaveTextContent('Active');

    fireEvent.click(pauseBtn);
    expect(onTogglePause).toHaveBeenCalledTimes(1);

    // Re-render in paused state
    rerender(<GlobeControls {...defaultProps} isPaused={true} onTogglePause={onTogglePause} />);
    const resumeBtn = screen.getByRole('button', { name: /Resume globe animation/i });
    expect(resumeBtn).toHaveTextContent('Paused');
  });

  it('triggers onResetOrientation when Reset View button is clicked', () => {
    const onResetOrientation = vi.fn();
    render(<GlobeControls {...defaultProps} onResetOrientation={onResetOrientation} />);

    const resetBtn = screen.getByRole('button', { name: /Reset globe orientation/i });
    fireEvent.click(resetBtn);

    expect(onResetOrientation).toHaveBeenCalledTimes(1);
  });

  it('toggles arc visibility and fires onToggleConnections on click', () => {
    const onToggleConnections = vi.fn();
    const { rerender } = render(
      <GlobeControls
        {...defaultProps}
        showConnections={true}
        onToggleConnections={onToggleConnections}
      />
    );

    const hideArcsBtn = screen.getByRole('button', { name: /Hide threat arcs/i });
    expect(hideArcsBtn).toHaveTextContent('Arcs: Visible');

    fireEvent.click(hideArcsBtn);
    expect(onToggleConnections).toHaveBeenCalledTimes(1);

    // Re-render with connections hidden
    rerender(
      <GlobeControls
        {...defaultProps}
        showConnections={false}
        onToggleConnections={onToggleConnections}
      />
    );
    const showArcsBtn = screen.getByRole('button', { name: /Show threat arcs/i });
    expect(showArcsBtn).toHaveTextContent('Arcs: Hidden');
  });

  it('renders layer filter buttons and calls onLayerChange when clicked', () => {
    const onLayerChange = vi.fn();
    render(
      <GlobeControls {...defaultProps} activeLayer="all" onLayerChange={onLayerChange} />
    );

    const layer3Btn = screen.getByRole('button', { name: /Filter by Layer 3\/4/i });
    fireEvent.click(layer3Btn);
    expect(onLayerChange).toHaveBeenCalledWith('layer3');

    const layer7Btn = screen.getByRole('button', { name: /Filter by Layer 7/i });
    fireEvent.click(layer7Btn);
    expect(onLayerChange).toHaveBeenCalledWith('layer7');
  });
});
