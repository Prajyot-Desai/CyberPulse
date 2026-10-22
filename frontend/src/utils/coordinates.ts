import * as THREE from 'three';

/**
 * Coordinate Conversion and Arc Mathematics for CyberPulse 3D Globe
 *
 * Mathematical Convention:
 * - Spherical Earth with radius R > 0.
 * - Latitude (phi): -90 deg (South Pole) to +90 deg (North Pole).
 * - Longitude (lambda): -180 deg (West) to +180 deg (East).
 *
 * Three.js Right-Handed Coordinate System:
 * - +Y is UP (North Pole at (0, R, 0), South Pole at (0, -R, 0)).
 * - +Z points toward the Prime Meridian (lat: 0, lon: 0 at (0, 0, R)).
 * - +X points toward Longitude +90 deg East (Indian Ocean at (R, 0, 0)).
 * - -X points toward Longitude -90 deg West (Galapagos/Americas at (-R, 0, 0)).
 * - -Z points toward the International Date Line (lon: 180 deg at (0, 0, -R)).
 *
 * Formula:
 *   phi_rad = lat * (PI / 180)
 *   lambda_rad = lon * (PI / 180)
 *   x = R * cos(phi_rad) * sin(lambda_rad)
 *   y = R * sin(phi_rad)
 *   z = R * cos(phi_rad) * cos(lambda_rad)
 */

export interface GeoLocation {
  lat: number;
  lon: number;
}

/**
 * Converts geographic latitude and longitude (in degrees) to 3D Cartesian coordinates.
 *
 * @param lat Latitude in degrees (-90 to 90)
 * @param lon Longitude in degrees (-180 to 180)
 * @param radius Globe radius (> 0)
 * @returns THREE.Vector3 with exact coordinates on sphere surface of given radius
 */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  // Clamp latitude to [-90, 90]
  const clampedLat = Math.max(-90, Math.min(90, lat));
  // Wrap or clamp longitude to [-180, 180]
  const normalizedLon = ((((lon + 180) % 360) + 360) % 360) - 180;

  const phi = (clampedLat * Math.PI) / 180;
  const lambda = (normalizedLon * Math.PI) / 180;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosLambda = Math.cos(lambda);
  const sinLambda = Math.sin(lambda);

  const x = radius * cosPhi * sinLambda;
  const y = radius * sinPhi;
  const z = radius * cosPhi * cosLambda;

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts a 3D Cartesian coordinate on or near a sphere back to latitude and longitude.
 *
 * @param v 3D coordinate vector
 * @returns GeoLocation with latitude and longitude in degrees
 */
export function vector3ToLatLon(v: THREE.Vector3): GeoLocation {
  const length = v.length();
  if (length < 1e-6) {
    return { lat: 0, lon: 0 };
  }

  // Latitude from y
  const sinPhi = Math.max(-1, Math.min(1, v.y / length));
  const lat = (Math.asin(sinPhi) * 180) / Math.PI;

  // Longitude from atan2(x, z)
  const lon = (Math.atan2(v.x, v.z) * 180) / Math.PI;

  return { lat, lon };
}

/**
 * Calculates the great circle central angle between two points in radians.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Central angle in radians [0, PI]
 */
export function greatCircleAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const lambda1 = (lon1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda2 = (lon2 * Math.PI) / 180;

  const dPhi = phi2 - phi1;
  const dLambda = lambda2 - lambda1;

  // Haversine formula for numerical stability at small distances
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
  return c;
}

/**
 * Calculates the great circle surface distance between two locations on a sphere of radius R.
 */
export function greatCircleDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius: number
): number {
  return radius * greatCircleAngle(lat1, lon1, lat2, lon2);
}

/**
 * Calculates a smooth 3D CubicBezierCurve3 representing a curved threat vector arc
 * elevated above the globe between two geographic endpoints.
 *
 * @param start Surface 3D coordinate of origin
 * @param end Surface 3D coordinate of target
 * @param globeRadius Radius of the globe
 * @param altitudeScale Optional altitude scaling factor (default 1.0)
 * @returns THREE.CubicBezierCurve3
 */
export function createArcCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  globeRadius: number,
  altitudeScale: number = 1.0
): THREE.CubicBezierCurve3 {
  // Compute angular distance theta between start and end
  const dot = Math.max(-1, Math.min(1, start.dot(end) / (globeRadius * globeRadius)));
  const theta = Math.acos(dot);

  // If endpoints are essentially identical, return a degenerate curve
  if (theta < 1e-4) {
    return new THREE.CubicBezierCurve3(start.clone(), start.clone(), end.clone(), end.clone());
  }

  // Maximum arc elevation above globe surface at the midpoint
  const maxAltitude =
    globeRadius * Math.min(0.42, Math.max(0.08, theta * 0.22)) * altitudeScale;

  // Normalized start vector
  const u = start.clone().normalize();

  // Unit vector perpendicular to u in the plane of the great circle
  let v: THREE.Vector3;
  const sinTheta = Math.sin(theta);

  if (sinTheta > 1e-4) {
    v = end
      .clone()
      .normalize()
      .sub(u.clone().multiplyScalar(Math.cos(theta)))
      .divideScalar(sinTheta)
      .normalize();
  } else {
    // Endpoints are antipodal (theta ~ PI)
    const axis =
      Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    v = new THREE.Vector3().crossVectors(u, axis).normalize();
  }

  // Exact analytical control point height so that P(0.5) reaches exactly globeRadius + maxAltitude
  const targetApexRadius = globeRadius + maxAltitude;
  const cosHalfTheta = Math.cos(theta / 2);
  const cosQuarterTheta = Math.cos(theta / 4);

  const controlHeight = Math.max(
    globeRadius * 1.02,
    (targetApexRadius - 0.25 * globeRadius * cosHalfTheta) / (0.75 * cosQuarterTheta)
  );

  // Directions of control points at alpha = 0.25 and alpha = 0.75 along the spherical arc
  const c1Dir = new THREE.Vector3()
    .addScaledVector(u, Math.cos(0.25 * theta))
    .addScaledVector(v, Math.sin(0.25 * theta))
    .normalize();

  const c2Dir = new THREE.Vector3()
    .addScaledVector(u, Math.cos(0.75 * theta))
    .addScaledVector(v, Math.sin(0.75 * theta))
    .normalize();

  const c1 = c1Dir.multiplyScalar(controlHeight);
  const c2 = c2Dir.multiplyScalar(controlHeight);

  return new THREE.CubicBezierCurve3(start.clone(), c1, c2, end.clone());
}
