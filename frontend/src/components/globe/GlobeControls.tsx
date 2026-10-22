import React from 'react';
import { Play, Pause, Eye, EyeOff, RotateCcw, Compass, Info } from 'lucide-react';
import { LayerFilter } from '../../data/threatFlows';

export interface GlobeControlsProps {
  observationWindow: string;
  isPaused: boolean;
  onTogglePause: () => void;
  showConnections: boolean;
  onToggleConnections: () => void;
  activeLayer: LayerFilter;
  onLayerChange: (layer: LayerFilter) => void;
  onResetOrientation: () => void;
  isSimulatedNoticeVisible?: boolean;
}

export const GlobeControls: React.FC<GlobeControlsProps> = ({
  observationWindow,
  isPaused,
  onTogglePause,
  showConnections,
  onToggleConnections,
  activeLayer,
  onLayerChange,
  onResetOrientation,
  isSimulatedNoticeVisible = true,
}) => {
  return (
    <>
      {/* 1. Top Left HUD: Coordinate System & Window Specs */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={14} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            3D WebGL Spherical Projection
          </span>
        </div>
        <div>
          Window:{' '}
          <span style={{ color: 'var(--accent-orange)' }}>
            {observationWindow.toUpperCase()} Aggregation
          </span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>Orbit: Drag to rotate, scroll to zoom</div>
      </div>

      {/* 2. Top Right Actions: Play/Pause & Reset Orientation */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Reset Camera Button */}
        <button
          onClick={onResetOrientation}
          aria-label="Reset globe orientation"
          title="Reset globe orientation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(12, 17, 26, 0.85)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.15s ease',
          }}
        >
          <RotateCcw size={12} />
          <span>Reset View</span>
        </button>

        {/* Play / Pause Toggle Button */}
        <button
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume globe animation' : 'Pause globe animation'}
          title={isPaused ? 'Resume animation' : 'Pause animation'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isPaused ? 'rgba(255, 94, 0, 0.2)' : 'rgba(12, 17, 26, 0.85)',
            color: isPaused ? 'var(--accent-orange)' : 'var(--text-primary)',
            border: isPaused
              ? '1px solid rgba(255, 94, 0, 0.5)'
              : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.15s ease',
          }}
        >
          {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
          <span>{isPaused ? 'Paused' : 'Active'}</span>
        </button>
      </div>

      {/* 3. Mandatory Central Disclaimer Badge: Illustrative Demo Flows */}
      {isSimulatedNoticeVisible && (
        <div
          role="note"
          aria-label="Data integrity notice"
          style={{
            position: 'absolute',
            bottom: '62px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(8, 12, 19, 0.88)',
            border: '1px solid rgba(255, 94, 0, 0.35)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 14px',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            maxWidth: '92%',
          }}
        >
          <Info size={13} color="var(--accent-orange)" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Illustrative demo flows — not live attack events
          </span>
        </div>
      )}

      {/* 4. Bottom Interactive Toolbar: Layer Selection & Arc Toggle */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '16px',
          right: '16px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(10, 15, 24, 0.88)',
          border: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(8px)',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Layer Filter Buttons */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          role="group"
          aria-label="Threat vector layer filter"
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              marginRight: '2px',
            }}
          >
            Layer:
          </span>
          {(['all', 'layer3', 'layer7'] as const).map((layer) => {
            const isActive = activeLayer === layer;
            const label =
              layer === 'all'
                ? 'All Layers'
                : layer === 'layer3'
                  ? 'Layer 3/4'
                  : 'Layer 7';
            return (
              <button
                key={layer}
                onClick={() => onLayerChange(layer)}
                aria-pressed={isActive}
                aria-label={`Filter by ${label}`}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive
                    ? layer === 'layer7'
                      ? 'rgba(0, 229, 255, 0.2)'
                      : 'rgba(255, 94, 0, 0.2)'
                    : 'transparent',
                  color: isActive
                    ? layer === 'layer7'
                      ? 'var(--accent-cyan)'
                      : 'var(--accent-orange)'
                    : 'var(--text-secondary)',
                  border: isActive
                    ? layer === 'layer7'
                      ? '1px solid rgba(0, 229, 255, 0.45)'
                      : '1px solid rgba(255, 94, 0, 0.45)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Toggle Arcs Visibility */}
        <button
          onClick={onToggleConnections}
          aria-pressed={showConnections}
          aria-label={showConnections ? 'Hide threat arcs' : 'Show threat arcs'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: showConnections
              ? 'rgba(0, 229, 255, 0.14)'
              : 'rgba(255, 255, 255, 0.04)',
            color: showConnections ? 'var(--accent-cyan)' : 'var(--text-muted)',
            border: showConnections
              ? '1px solid rgba(0, 229, 255, 0.35)'
              : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {showConnections ? <Eye size={12} /> : <EyeOff size={12} />}
          <span>Arcs: {showConnections ? 'Visible' : 'Hidden'}</span>
        </button>
      </div>
    </>
  );
};
