import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ThreatFlow, LayerFilter } from '../../data/threatFlows';

export interface WebGLFallbackProps {
  observationWindow: string;
  flows: ThreatFlow[];
  showConnections: boolean;
  activeLayer: LayerFilter;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({
  observationWindow,
  flows,
  showConnections,
}) => {
  return (
    <div
      role="region"
      aria-label="Geospatial Telemetry 2D Fallback View"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '440px',
        backgroundColor: '#05070b',
        borderRadius: 'var(--radius-md)',
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

      {/* Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255, 94, 0, 0.12) 0%, rgba(0, 229, 255, 0.06) 50%, transparent 70%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* 2D Orthographic Vector Schematic */}
      <svg
        viewBox="0 0 400 400"
        width="300"
        height="300"
        style={{
          zIndex: 2,
          filter: 'drop-shadow(0 0 16px rgba(0, 229, 255, 0.18))',
        }}
        aria-label="2D Earth Telemetry Schematic"
        role="img"
      >
        <circle cx="200" cy="200" r="140" fill="#090f1d" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1.5" />
        <ellipse cx="200" cy="200" rx="140" ry="100" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <ellipse cx="200" cy="200" rx="140" ry="50" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <line x1="60" y1="200" x2="340" y2="200" stroke="rgba(0, 229, 255, 0.35)" strokeWidth="1" strokeDasharray="3 3" />
        <ellipse cx="200" cy="200" rx="100" ry="140" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <ellipse cx="200" cy="200" rx="50" ry="140" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <line x1="200" y1="60" x2="200" y2="340" stroke="rgba(0, 229, 255, 0.35)" strokeWidth="1" strokeDasharray="3 3" />

        {/* 2D Arcs */}
        {showConnections &&
          flows.slice(0, 5).map((flow, idx) => {
            const startX = 110 + idx * 20;
            const startY = 160 + (idx % 2) * 40;
            const endX = 270 - idx * 15;
            const endY = 170 + ((idx + 1) % 2) * 50;
            const midY = 90 + idx * 10;
            return (
              <g key={flow.id}>
                <path
                  d={`M ${startX} ${startY} Q 200 ${midY} ${endX} ${endY}`}
                  fill="none"
                  stroke={flow.color}
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                  opacity="0.8"
                />
                <circle cx={startX} cy={startY} r="3.5" fill="var(--accent-orange)" />
                <circle cx={endX} cy={endY} r="3.5" fill="var(--accent-cyan)" />
              </g>
            );
          })}
      </svg>

      {/* Informative WebGL Unavailable Banner */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          zIndex: 5,
          textAlign: 'center',
          backgroundColor: 'rgba(10, 15, 24, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 171, 0, 0.35)',
          padding: '10px 18px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '520px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertTriangle size={24} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
        <div style={{ textAlign: 'left' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '2px',
            }}
          >
            WebGL 3D Acceleration Unavailable
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            3D WebGL context could not be initialized in this browser or test environment.
            Displaying 2D aggregate threat vector fallback ({observationWindow.toUpperCase()} observation window).
          </p>
        </div>
      </div>
    </div>
  );
};
