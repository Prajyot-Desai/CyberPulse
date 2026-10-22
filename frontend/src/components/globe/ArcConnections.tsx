import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ThreatFlow } from '../../data/threatFlows';
import { latLonToVector3, createArcCurve } from '../../utils/coordinates';

interface ArcConnectionsProps {
  flows: ThreatFlow[];
  globeRadius?: number;
  showConnections?: boolean;
  isPaused?: boolean;
}

interface SingleArcProps {
  flow: ThreatFlow;
  globeRadius: number;
  isPaused: boolean;
}

const SingleArc: React.FC<SingleArcProps> = ({ flow, globeRadius, isPaused }) => {
  const pulseMeshRef = useRef<THREE.Mesh>(null);
  const originMarkerRef = useRef<THREE.Mesh>(null);
  const targetMarkerRef = useRef<THREE.Mesh>(null);

  // Surface positions of origin and target
  const { originV3, targetV3, curve, lineGeometry } = useMemo(() => {
    const oV3 = latLonToVector3(flow.origin.lat, flow.origin.lon, globeRadius * 1.003);
    const tV3 = latLonToVector3(flow.target.lat, flow.target.lon, globeRadius * 1.003);
    const c = createArcCurve(oV3, tV3, globeRadius);

    // Sample 50 points along the Bezier curve for smooth line rendering
    const points = c.getPoints(50);
    const geom = new THREE.BufferGeometry().setFromPoints(points);

    return { originV3: oV3, targetV3: tV3, curve: c, lineGeometry: geom };
  }, [flow, globeRadius]);

  const baseColor = useMemo(() => new THREE.Color(flow.color), [flow.color]);

  const lineMesh = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Line(lineGeometry, mat);
  }, [baseColor, lineGeometry]);

  useEffect(() => {
    return () => {
      lineGeometry.dispose();
      (lineMesh.material as THREE.Material).dispose();
    };
  }, [lineGeometry, lineMesh]);

  // Progress along the curve [0, 1]
  const progressRef = useRef(flow.pulsePhase);

  useFrame((_, delta) => {
    if (!isPaused) {
      progressRef.current = (progressRef.current + delta * flow.pulseSpeed) % 1.0;
    }

    if (pulseMeshRef.current) {
      const currentPoint = curve.getPointAt(progressRef.current);
      pulseMeshRef.current.position.copy(currentPoint);

      // Subtle scale pulse based on position along the arc
      const scale = 1.0 + Math.sin(progressRef.current * Math.PI) * 0.4;
      pulseMeshRef.current.scale.set(scale, scale, scale);
    }

    // Gentle marker ring pulse
    if (originMarkerRef.current && targetMarkerRef.current && !isPaused) {
      const ringScale = 1.0 + Math.sin(Date.now() * 0.004 + flow.pulsePhase * Math.PI) * 0.25;
      originMarkerRef.current.scale.set(ringScale, ringScale, ringScale);
      targetMarkerRef.current.scale.set(ringScale, ringScale, ringScale);
    }
  });

  return (
    <group name={`threat-flow-${flow.id}`}>
      {/* 1. Curved 3D Arc Line */}
      <primitive object={lineMesh} />

      {/* 2. Animated Pulse Bead (Packet travelling along the arc) */}
      <mesh ref={pulseMeshRef} position={originV3}>
        <sphereGeometry args={[0.024, 12, 12]} />
        <meshBasicMaterial
          color={baseColor}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Origin Geographic Marker (Orange ring + dot) */}
      <group position={originV3}>
        <mesh ref={originMarkerRef}>
          <ringGeometry args={[0.02, 0.04, 16]} />
          <meshBasicMaterial
            color={new THREE.Color(0xff5e00)}
            side={THREE.DoubleSide}
            transparent={true}
            opacity={0.8}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color(0xff5e00)} />
        </mesh>
      </group>

      {/* 4. Target Geographic Marker (Cyan ring + dot) */}
      <group position={targetV3}>
        <mesh ref={targetMarkerRef}>
          <ringGeometry args={[0.025, 0.05, 16]} />
          <meshBasicMaterial
            color={new THREE.Color(0x00e5ff)}
            side={THREE.DoubleSide}
            transparent={true}
            opacity={0.85}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color(0x00e5ff)} />
        </mesh>
      </group>
    </group>
  );
};

export const ArcConnections: React.FC<ArcConnectionsProps> = ({
  flows,
  globeRadius = 2.0,
  showConnections = true,
  isPaused = false,
}) => {
  if (!showConnections || flows.length === 0) {
    return null;
  }

  return (
    <group name="arc-connections-layer">
      {flows.map((flow) => (
        <SingleArc
          key={flow.id}
          flow={flow}
          globeRadius={globeRadius}
          isPaused={isPaused}
        />
      ))}
    </group>
  );
};
