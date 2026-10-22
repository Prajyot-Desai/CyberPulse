import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { NATURAL_EARTH_LAND } from '../../data/naturalEarthLand';
import { latLonToVector3 } from '../../utils/coordinates';

interface EarthSphereProps {
  radius?: number;
}

/**
 * Creates an in-memory 2D canvas texture of the Earth
 * featuring dark cyber-ocean, Natural Earth continental landmasses,
 * and subtle equirectangular graticule lines.
 */
function createEarthCanvasTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // 1. Fill deep cyber ocean background
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#060a14');
  oceanGrad.addColorStop(0.5, '#080d1a');
  oceanGrad.addColorStop(1, '#060a14');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle ocean graticule lines (parallels & meridians)
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
  ctx.lineWidth = 1;

  // Parallels every 30 degrees (from -60 to +60)
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Meridians every 30 degrees (from -180 to 180)
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 3. Draw continental landmasses from Natural Earth 110m polygons
  ctx.fillStyle = '#0f172a'; // Slate cyber land
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.28)'; // Glowing cyan coastline
  ctx.lineWidth = 1.5;

  for (const ring of NATURAL_EARTH_LAND) {
    if (ring.length < 3) continue;

    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      // Equirectangular projection mapping to canvas
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 4. Subtle continent cyber pattern / texture noise
  ctx.fillStyle = 'rgba(0, 229, 255, 0.015)';
  for (let y = 0; y < height; y += 8) {
    ctx.fillRect(0, y, width, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Custom Atmospheric Rim Glow Shader
 * Produces a soft cyan Fresnel corona around the edge of the globe.
 */
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize(normalMatrix * position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      // Grazing angle Fresnel intensity
      float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
      vec3 atmosphericCyan = vec3(0.0, 0.9, 1.0);
      vec3 deepNavy = vec3(0.02, 0.08, 0.25);
      vec3 finalColor = mix(deepNavy, atmosphericCyan, intensity);
      gl_FragColor = vec4(finalColor, intensity * 0.85);
    }
  `,
};

export const EarthSphere: React.FC<EarthSphereProps> = ({ radius = 2.0 }) => {
  // 1. Procedural Earth texture
  const earthTexture = useMemo(() => {
    return createEarthCanvasTexture();
  }, []);

  // Dispose texture on unmount
  useEffect(() => {
    return () => {
      earthTexture.dispose();
    };
  }, [earthTexture]);

  // 2. Vector Coastline Geometry (All 127 Natural Earth land rings in 1 draw call)
  const coastlineGeometry = useMemo(() => {
    const points: number[] = [];
    const surfaceRadius = radius * 1.002; // Slightly above sphere to avoid z-fighting

    for (const ring of NATURAL_EARTH_LAND) {
      if (ring.length < 2) continue;
      for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];

        // Skip wrap-around line crossing International Date Line
        if (Math.abs(lon1 - lon2) > 180) continue;

        const v1 = latLonToVector3(lat1, lon1, surfaceRadius);
        const v2 = latLonToVector3(lat2, lon2, surfaceRadius);

        points.push(v1.x, v1.y, v1.z);
        points.push(v2.x, v2.y, v2.z);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geom;
  }, [radius]);

  // Dispose coastline geometry on unmount
  useEffect(() => {
    return () => {
      coastlineGeometry.dispose();
    };
  }, [coastlineGeometry]);

  // 3. Graticule Lines Geometry (Equator, Parallels, Meridians)
  const graticuleGeometry = useMemo(() => {
    const points: number[] = [];
    const graticuleRadius = radius * 1.0015;

    // Equator & Parallels (every 30 degrees)
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 4) {
        const v1 = latLonToVector3(lat, lon, graticuleRadius);
        const v2 = latLonToVector3(lat, lon + 4, graticuleRadius);
        points.push(v1.x, v1.y, v1.z);
        points.push(v2.x, v2.y, v2.z);
      }
    }

    // Meridians (every 30 degrees)
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -85; lat < 85; lat += 4) {
        const v1 = latLonToVector3(lat, lon, graticuleRadius);
        const v2 = latLonToVector3(lat + 4, lon, graticuleRadius);
        points.push(v1.x, v1.y, v1.z);
        points.push(v2.x, v2.y, v2.z);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geom;
  }, [radius]);

  useEffect(() => {
    return () => {
      graticuleGeometry.dispose();
    };
  }, [graticuleGeometry]);

  return (
    <group name="earth-system">
      {/* 1. Base Earth Mesh with Texture */}
      <mesh name="earth-surface">
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={earthTexture}
          roughness={0.75}
          metalness={0.15}
          emissive={new THREE.Color(0x02050e)}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* 2. 3D Vector Coastlines (Cyan Cyber Contours) */}
      <lineSegments geometry={coastlineGeometry} name="earth-coastlines">
        <lineBasicMaterial
          color={new THREE.Color(0x00e5ff)}
          transparent={true}
          opacity={0.42}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* 3. Geographic Graticules (Latitude & Longitude Grid) */}
      <lineSegments geometry={graticuleGeometry} name="earth-graticules">
        <lineBasicMaterial
          color={new THREE.Color(0x5a687d)}
          transparent={true}
          opacity={0.22}
        />
      </lineSegments>

      {/* 4. Atmospheric Rim Glow Corona */}
      <mesh name="earth-atmosphere">
        <sphereGeometry args={[radius * 1.14, 48, 48]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent={true}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
