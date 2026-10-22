import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  latLonToVector3,
  vector3ToLatLon,
  greatCircleAngle,
  greatCircleDistance,
  createArcCurve,
} from '../src/utils/coordinates';

describe('Geospatial Coordinate Math & 3D Projections', () => {
  const GLOBE_RADIUS = 2.0;

  describe('latLonToVector3 Known Coordinates & Benchmarks', () => {
    it('maps Equator and Prime Meridian (0 deg lat, 0 deg lon) to (0, 0, R)', () => {
      const v = latLonToVector3(0, 0, GLOBE_RADIUS);
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y).toBeCloseTo(0, 5);
      expect(v.z).toBeCloseTo(GLOBE_RADIUS, 5);
      expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
    });

    it('maps North Pole (90 deg lat, 0 deg lon) to (0, R, 0)', () => {
      const v = latLonToVector3(90, 0, GLOBE_RADIUS);
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y).toBeCloseTo(GLOBE_RADIUS, 5);
      expect(v.z).toBeCloseTo(0, 5);
      expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
    });

    it('maps South Pole (-90 deg lat, 0 deg lon) to (0, -R, 0)', () => {
      const v = latLonToVector3(-90, 0, GLOBE_RADIUS);
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y).toBeCloseTo(-GLOBE_RADIUS, 5);
      expect(v.z).toBeCloseTo(0, 5);
      expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
    });

    it('maps Equator at 90 deg East to (R, 0, 0)', () => {
      const v = latLonToVector3(0, 90, GLOBE_RADIUS);
      expect(v.x).toBeCloseTo(GLOBE_RADIUS, 5);
      expect(v.y).toBeCloseTo(0, 5);
      expect(v.z).toBeCloseTo(0, 5);
      expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
    });

    it('maps Equator at -90 deg West to (-R, 0, 0)', () => {
      const v = latLonToVector3(0, -90, GLOBE_RADIUS);
      expect(v.x).toBeCloseTo(-GLOBE_RADIUS, 5);
      expect(v.y).toBeCloseTo(0, 5);
      expect(v.z).toBeCloseTo(0, 5);
      expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
    });

    it('maps Equator at 180 deg (Date Line) to (0, 0, -R)', () => {
      const vPos = latLonToVector3(0, 180, GLOBE_RADIUS);
      const vNeg = latLonToVector3(0, -180, GLOBE_RADIUS);
      expect(vPos.x).toBeCloseTo(0, 5);
      expect(vPos.y).toBeCloseTo(0, 5);
      expect(vPos.z).toBeCloseTo(-GLOBE_RADIUS, 5);
      expect(vNeg.z).toBeCloseTo(-GLOBE_RADIUS, 5);
    });

    it('preserves exact spherical radius across representative global locations', () => {
      const locations = [
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
        { name: 'London', lat: 51.5074, lon: -0.1278 },
        { name: 'New York', lat: 40.7128, lon: -74.006 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
        { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
        { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
        { name: 'Sao Paulo', lat: -23.5505, lon: -46.6333 },
      ];

      for (const loc of locations) {
        const v = latLonToVector3(loc.lat, loc.lon, GLOBE_RADIUS);
        expect(v.length()).toBeCloseTo(GLOBE_RADIUS, 5);
      }
    });

    it('handles edge cases: latitude clamping beyond +/-90 deg', () => {
      const vOverNorth = latLonToVector3(120, 0, GLOBE_RADIUS);
      expect(vOverNorth.y).toBeCloseTo(GLOBE_RADIUS, 5);

      const vOverSouth = latLonToVector3(-150, 0, GLOBE_RADIUS);
      expect(vOverSouth.y).toBeCloseTo(-GLOBE_RADIUS, 5);
    });

    it('handles edge cases: longitude wrap-around beyond +/-180 deg', () => {
      const vWrapped = latLonToVector3(0, 450, GLOBE_RADIUS); // 450 deg = 90 deg East
      expect(vWrapped.x).toBeCloseTo(GLOBE_RADIUS, 5);
      expect(vWrapped.z).toBeCloseTo(0, 5);
    });
  });

  describe('vector3ToLatLon Inversion and Round-Trip Accuracy', () => {
    it('accurately round-trips from lat/lon to Vector3 and back', () => {
      const testCoordinates = [
        { lat: 0, lon: 0 },
        { lat: 45, lon: 45 },
        { lat: -20, lon: 110 },
        { lat: 60, lon: -80 },
        { lat: -45, lon: -120 },
      ];

      for (const coord of testCoordinates) {
        const v = latLonToVector3(coord.lat, coord.lon, GLOBE_RADIUS);
        const roundTrip = vector3ToLatLon(v);
        expect(roundTrip.lat).toBeCloseTo(coord.lat, 3);
        expect(roundTrip.lon).toBeCloseTo(coord.lon, 3);
      }
    });

    it('safely handles zero-length vector without throwing or returning NaN', () => {
      const zeroVec = new THREE.Vector3(0, 0, 0);
      const res = vector3ToLatLon(zeroVec);
      expect(res.lat).toBe(0);
      expect(res.lon).toBe(0);
    });
  });

  describe('Great Circle Distance Calculations', () => {
    it('returns zero distance for identical points', () => {
      const d = greatCircleDistance(37.7749, -122.4194, 37.7749, -122.4194, GLOBE_RADIUS);
      expect(d).toBeCloseTo(0, 6);
    });

    it('returns half circumference (pi * R) for antipodal points', () => {
      const d = greatCircleDistance(0, 0, 0, 180, GLOBE_RADIUS);
      expect(d).toBeCloseTo(Math.PI * GLOBE_RADIUS, 5);
    });

    it('returns quarter circumference ((pi/2) * R) for 90-degree separation', () => {
      const angle = greatCircleAngle(0, 0, 0, 90);
      expect(angle).toBeCloseTo(Math.PI / 2, 5);
      const d = greatCircleDistance(0, 0, 0, 90, GLOBE_RADIUS);
      expect(d).toBeCloseTo((Math.PI / 2) * GLOBE_RADIUS, 5);
    });
  });

  describe('createArcCurve Threat Vector Trajectory Math', () => {
    it('starts exactly at the origin surface point (t = 0)', () => {
      const start = latLonToVector3(35.8617, 104.1954, GLOBE_RADIUS); // China
      const end = latLonToVector3(37.0902, -95.7129, GLOBE_RADIUS); // US
      const curve = createArcCurve(start, end, GLOBE_RADIUS);

      const t0 = curve.getPointAt(0);
      expect(t0.x).toBeCloseTo(start.x, 4);
      expect(t0.y).toBeCloseTo(start.y, 4);
      expect(t0.z).toBeCloseTo(start.z, 4);
      expect(t0.length()).toBeCloseTo(GLOBE_RADIUS, 4);
    });

    it('lands exactly at the target surface point (t = 1)', () => {
      const start = latLonToVector3(35.8617, 104.1954, GLOBE_RADIUS);
      const end = latLonToVector3(37.0902, -95.7129, GLOBE_RADIUS);
      const curve = createArcCurve(start, end, GLOBE_RADIUS);

      const t1 = curve.getPointAt(1);
      expect(t1.x).toBeCloseTo(end.x, 4);
      expect(t1.y).toBeCloseTo(end.y, 4);
      expect(t1.z).toBeCloseTo(end.z, 4);
      expect(t1.length()).toBeCloseTo(GLOBE_RADIUS, 4);
    });

    it('elevates the apex midpoint above the globe surface (t = 0.5)', () => {
      const start = latLonToVector3(51.1657, 10.4515, GLOBE_RADIUS); // Germany
      const end = latLonToVector3(37.0902, -95.7129, GLOBE_RADIUS); // US
      const curve = createArcCurve(start, end, GLOBE_RADIUS);

      const apex = curve.getPointAt(0.5);
      const apexRadius = apex.length();

      // Apex should be higher than globe radius
      expect(apexRadius).toBeGreaterThan(GLOBE_RADIUS);
      // Elevation should be restrained within sensible upper bounds
      expect(apexRadius).toBeLessThan(GLOBE_RADIUS * 1.5);
    });

    it('handles antipodal endpoints without NaN coordinates', () => {
      const start = latLonToVector3(0, 0, GLOBE_RADIUS);
      const end = latLonToVector3(0, 180, GLOBE_RADIUS);
      const curve = createArcCurve(start, end, GLOBE_RADIUS);

      const mid = curve.getPointAt(0.5);
      expect(Number.isNaN(mid.x)).toBe(false);
      expect(Number.isNaN(mid.y)).toBe(false);
      expect(Number.isNaN(mid.z)).toBe(false);
      expect(mid.length()).toBeGreaterThan(GLOBE_RADIUS);
    });
  });
});
