import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EarthSphere } from './EarthSphere';
import { ArcConnections } from './ArcConnections';
import { ThreatFlow } from '../../data/threatFlows';

export interface GlobeSceneProps {
  flows: ThreatFlow[];
  showConnections: boolean;
  isPaused: boolean;
  resetTrigger: number;
}

export const GlobeScene: React.FC<GlobeSceneProps> = ({
  flows,
  showConnections,
  isPaused,
  resetTrigger,
}) => {
  const globeGroupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Auto-rotation around Y-axis
  useFrame((_, delta) => {
    if (globeGroupRef.current && !isPaused) {
      // Gentle rotation speed ~0.06 rad/s (approx 1 full rotation per 100 seconds)
      globeGroupRef.current.rotation.y += delta * 0.065;
    }
  });

  // Handle camera & globe orientation reset when resetTrigger changes
  useEffect(() => {
    if (resetTrigger === 0) return;

    if (globeGroupRef.current) {
      globeGroupRef.current.rotation.set(0, 0, 0);
    }

    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [resetTrigger]);

  return (
    <>
      {/* 1. Scene Lighting */}
      <ambientLight color="#101726" intensity={1.4} />
      <directionalLight position={[5, 4, 3]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-5, -2, -4]} intensity={1.2} color="#00e5ff" />
      <pointLight position={[0, 5, 0]} intensity={0.8} color="#00e5ff" />

      {/* 2. OrbitControls (Mouse drag to rotate, scroll/pinch to zoom) */}
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.06}
        enablePan={false}
        minDistance={2.8}
        maxDistance={8.0}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
      />

      {/* 3. Globe Group (Rotating Earth & Arcs) */}
      <group ref={globeGroupRef} name="globe-root">
        <EarthSphere radius={2.0} />
        <ArcConnections
          flows={flows}
          globeRadius={2.0}
          showConnections={showConnections}
          isPaused={isPaused}
        />
      </group>
    </>
  );
};
