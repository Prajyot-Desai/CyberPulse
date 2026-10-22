import React, { useState } from 'react';
import { Eye, Compass, Maximize2 } from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { Badge } from '../common/Badge';

interface GlobePlaceholderProps {
  observationWindow: string;
}

export const GlobePlaceholder: React.FC<GlobePlaceholderProps> = ({ observationWindow }) => {
  const [activeLayer, setActiveLayer] = useState<'all' | 'layer3' | 'layer7'>('all');
  const [showSimulatedVectors, setShowSimulatedVectors] = useState(true);

  return (
    <GlassCard
      title="3D Geospatial Threat Visualizer"
      subtitle="Interactive 3D WebGL Globe displaying aggregate flow vectors derived from Cloudflare Radar"
      badge={<Badge variant="orange">Coming in Milestone 4</Badge>}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            Projection: Orthographic
          </span>
          <button
            aria-label="Maximize visualizer"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      }
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        id="globe-visualization-viewport"
        style={{
          position: 'relative',
          height: '420px',
          width: '100%',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#05070b',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background Grid Pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.6,
          }}
          aria-hidden="true"
        />

        {/* Ambient radial glow */}
        <div
          style={{
            position: 'absolute',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 94, 0, 0.12) 0%, rgba(0, 229, 255, 0.06) 50%, transparent 70%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        />

        {/* Central Geometric Cyber-Globe Wireframe SVG */}
        <svg
          viewBox="0 0 400 400"
          width="320"
          height="320"
          style={{
            zIndex: 2,
            filter: 'drop-shadow(0 0 16px rgba(0, 229, 255, 0.18))',
          }}
          aria-label="Abstract Globe Wireframe Graphic"
          role="img"
        >
          {/* Outer Ring & Meridian Lines */}
          <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(0, 229, 255, 0.35)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="4 4" />
          <circle cx="200" cy="200" r="115" fill="none" stroke="rgba(0, 229, 255, 0.12)" />

          {/* Latitude Lines */}
          <ellipse cx="200" cy="200" rx="140" ry="110" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="140" ry="60" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <line x1="60" y1="200" x2="340" y2="200" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Longitude Lines */}
          <ellipse cx="200" cy="200" rx="110" ry="140" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
          <ellipse cx="200" cy="200" rx="60" ry="140" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <line x1="200" y1="60" x2="200" y2="340" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Simulated Aggregate Flow Arcs (Preview) */}
          {showSimulatedVectors && (
            <g opacity="0.85">
              <path
                d="M 120 160 Q 200 80 280 150"
                fill="none"
                stroke="url(#orangeCyanGrad)"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
              <path
                d="M 100 240 Q 200 300 290 220"
                fill="none"
                stroke="rgba(255, 94, 0, 0.7)"
                strokeWidth="1.8"
                strokeDasharray="5 3"
              />
              <circle cx="120" cy="160" r="4" fill="var(--accent-orange)" />
              <circle cx="280" cy="150" r="4" fill="var(--accent-cyan)" />
              <circle cx="100" cy="240" r="3.5" fill="var(--accent-orange)" />
              <circle cx="290" cy="220" r="3.5" fill="var(--accent-red)" />
            </g>
          )}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="orangeCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff5e00" />
              <stop offset="100%" stopColor="#00e5ff" />
            </linearGradient>
          </defs>
        </svg>

        {/* HUD Overlay: Top Left Spec */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 5,
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={13} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>Three.js Canvas Frame</span>
          </div>
          <span>Window: {observationWindow.toUpperCase()} Aggregation</span>
        </div>

        {/* HUD Overlay: Top Right Engine Spec */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 5,
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}
        >
          <div style={{ color: 'var(--text-secondary)' }}>Shader: Aggregate Arc Pulse</div>
          <div style={{ color: 'var(--accent-orange)' }}>FPS Cap: 60 FPS Target</div>
        </div>

        {/* Central Coming Next Badge Banner */}
        <div
          style={{
            position: 'absolute',
            bottom: '68px',
            zIndex: 5,
            textAlign: 'center',
            backgroundColor: 'rgba(8, 12, 19, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 20px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            maxWidth: '480px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '2px',
            }}
          >
            3D Globe Visualization — Coming in Milestone 4
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Will render Three.js / React Three Fiber interactive globe with mathematically derived aggregate threat arcs.
          </p>
        </div>

        {/* Bottom Interactive Controls Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '16px',
            right: '16px',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(12, 17, 26, 0.8)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Layer switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Layer Filter:
            </span>
            {(['all', 'layer3', 'layer7'] as const).map((layer) => (
              <button
                key={layer}
                onClick={() => setActiveLayer(layer)}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: activeLayer === layer ? 'rgba(255, 94, 0, 0.2)' : 'transparent',
                  color: activeLayer === layer ? 'var(--accent-orange)' : 'var(--text-secondary)',
                  border: activeLayer === layer ? '1px solid rgba(255, 94, 0, 0.4)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {layer === 'all' ? 'All' : layer === 'layer3' ? 'Layer 3' : 'Layer 7'}
              </button>
            ))}
          </div>

          {/* Toggle Flow Vectors */}
          <button
            onClick={() => setShowSimulatedVectors((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: showSimulatedVectors ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: showSimulatedVectors ? 'var(--accent-cyan)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            <Eye size={12} />
            <span>Simulated Arcs: {showSimulatedVectors ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </GlassCard>
  );
};
