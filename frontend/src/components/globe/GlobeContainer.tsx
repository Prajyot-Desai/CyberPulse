import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { RadarMetrics } from '../../types/api';
import {
  deriveFlowsFromMetrics,
  filterFlowsByLayer,
  LayerFilter,
} from '../../data/threatFlows';
import { isWebGLAvailable } from '../../utils/webgl';
import { GlobeScene } from './GlobeScene';
import { GlobeControls } from './GlobeControls';
import { WebGLFallback } from './WebGLFallback';

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WebGLErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('WebGL Globe Canvas caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export interface GlobeContainerProps {
  observationWindow: string;
  metrics?: RadarMetrics | null;
  height?: string;
}

export const GlobeContainer: React.FC<GlobeContainerProps> = ({
  observationWindow,
  metrics,
  height = '440px',
}) => {
  const [activeLayer, setActiveLayer] = useState<LayerFilter>('all');
  const [showConnections, setShowConnections] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Check prefers-reduced-motion media query
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
      } catch {
        return false;
      }
    }
    return false;
  });

  // Listen for reduced motion preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (!mediaQuery) return;
      const handleChange = (e: MediaQueryListEvent) => {
        if (e?.matches) setIsPaused(true);
      };
      mediaQuery.addEventListener?.('change', handleChange);
      return () => mediaQuery.removeEventListener?.('change', handleChange);
    } catch {
      // Ignore in environments where matchMedia is not fully supported
    }
  }, []);

  // Check WebGL availability
  const webGLSupported = useMemo(() => isWebGLAvailable(), []);

  // Derive all flows (from metrics or deterministic demo flows)
  const allFlows = useMemo(() => {
    return deriveFlowsFromMetrics(metrics);
  }, [metrics]);

  // Apply active layer filter
  const visibleFlows = useMemo(() => {
    return filterFlowsByLayer(allFlows, activeLayer);
  }, [allFlows, activeLayer]);

  const handleResetOrientation = () => {
    setResetTrigger((prev) => prev + 1);
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleToggleConnections = () => {
    setShowConnections((prev) => !prev);
  };

  return (
    <div
      id="globe-visualization-viewport"
      style={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: 'var(--radius-md)',
        backgroundColor: '#05070b',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
      }}
    >
      {webGLSupported ? (
        <WebGLErrorBoundary
          fallback={
            <WebGLFallback
              observationWindow={observationWindow}
              flows={visibleFlows}
              showConnections={showConnections}
              activeLayer={activeLayer}
            />
          }
        >
          {/* Three.js React Three Fiber Canvas */}
          <Canvas
            camera={{ position: [0, 0.9, 5.2], fov: 45, near: 0.1, far: 100 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'default',
            }}
            dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <Suspense fallback={null}>
              <GlobeScene
                flows={visibleFlows}
                showConnections={showConnections}
                isPaused={isPaused}
                resetTrigger={resetTrigger}
              />
            </Suspense>
          </Canvas>

          {/* Controls and Data Integrity Overlays */}
          <GlobeControls
            observationWindow={observationWindow}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            showConnections={showConnections}
            onToggleConnections={handleToggleConnections}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            onResetOrientation={handleResetOrientation}
            isSimulatedNoticeVisible={true}
          />
        </WebGLErrorBoundary>
      ) : (
        <>
          <WebGLFallback
            observationWindow={observationWindow}
            flows={visibleFlows}
            showConnections={showConnections}
            activeLayer={activeLayer}
          />
          <GlobeControls
            observationWindow={observationWindow}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            showConnections={showConnections}
            onToggleConnections={handleToggleConnections}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            onResetOrientation={handleResetOrientation}
            isSimulatedNoticeVisible={true}
          />
        </>
      )}
    </div>
  );
};
