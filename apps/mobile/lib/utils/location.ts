import type { LatLng, MapRegion, ProximityResult, UserLocation } from '../../constants/mapTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CHECK_IN_RADIUS_METERS = 200;
const WALK_SPEED_MPS = 1.4; // ~5 km/h
const EARTH_RADIUS_M = 6_371_000;

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(c));
}

// ---------------------------------------------------------------------------
// Bearing (degrees, 0 = north, clockwise)
// ---------------------------------------------------------------------------

export function bearingTo(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Proximity check (used for check-in gate)
// ---------------------------------------------------------------------------

export function checkProximity(
  userLocation: UserLocation,
  venueLat: number,
  venueLng: number,
  radiusMeters = CHECK_IN_RADIUS_METERS,
): ProximityResult {
  const user: LatLng = { lat: userLocation.lat, lng: userLocation.lng };
  const venue: LatLng = { lat: venueLat, lng: venueLng };
  const distanceMeters = haversineDistance(user, venue);
  const walkMinutes = Math.ceil(distanceMeters / WALK_SPEED_MPS / 60);
  const bearing = bearingTo(user, venue);
  return {
    distanceMeters,
    withinRadius: distanceMeters <= radiusMeters,
    bearing,
    walkMinutes,
  };
}

// ---------------------------------------------------------------------------
// Human-readable distance string
// ---------------------------------------------------------------------------

export function formatDistance(meters: number): string {
  if (meters < 50) return 'You\'re here';
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

export function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALK_SPEED_MPS / 60));
}

// ---------------------------------------------------------------------------
// Cardinal direction label from bearing
// ---------------------------------------------------------------------------

export function bearingToLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

// ---------------------------------------------------------------------------
// Map region that fits two points with padding
// ---------------------------------------------------------------------------

export function fitRegion(
  a: LatLng,
  b: LatLng,
  paddingFactor = 1.6,
): MapRegion {
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLng = Math.min(a.lng, b.lng);
  const maxLng = Math.max(a.lng, b.lng);
  const latDelta = Math.max((maxLat - minLat) * paddingFactor, 0.005);
  const lngDelta = Math.max((maxLng - minLng) * paddingFactor, 0.005);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

// ---------------------------------------------------------------------------
// Validate a proposed switch location
// Must be within 2km of original venue
// ---------------------------------------------------------------------------

export function validateProposedLocation(
  proposed: LatLng,
  original: LatLng,
  maxDistanceMeters = 2000,
): { valid: boolean; reason?: string } {
  const dist = haversineDistance(proposed, original);
  if (dist > maxDistanceMeters) {
    return {
      valid: false,
      reason: `Too far — proposed location is ${formatDistance(dist)} from the original venue. Max is ${formatDistance(maxDistanceMeters)}.`,
    };
  }
  return { valid: true };
}
