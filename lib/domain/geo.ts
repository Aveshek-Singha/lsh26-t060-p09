/**
 * Distance between two points on the city.
 *
 * Pure and dependency-free, so the workshop always gets *a* distance even when
 * the routing service is unreachable. A road route is strictly better and the
 * map fetches one when it can, but this is the floor that never fails.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * Haversine rather than a flat approximation: across Dhaka the difference is
 * small, but the formula is three lines and correct everywhere, so there is no
 * reason to approximate.
 */
export function straightLineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Dhaka traffic, as a working average.
 *
 * The city's average traffic speed is widely reported at well under 20 km/h in
 * daytime congestion. 18 km/h keeps an estimate honest rather than flattering:
 * a van told "12 minutes" and arriving in 30 is worse than no estimate at all.
 */
export const DHAKA_AVERAGE_KMH = 18;

/** Minutes to drive a road distance, rounded up to the nearest minute. */
export function driveMinutes(km: number, kmh: number = DHAKA_AVERAGE_KMH): number {
  if (km <= 0) return 0;
  return Math.max(1, Math.ceil((km / kmh) * 60));
}

/**
 * Road distance is longer than the straight line. For a dense city grid a
 * factor around 1.35 is the usual rule of thumb, applied only when no real
 * route is available and labelled as an estimate wherever it is shown.
 */
export const ROAD_FACTOR = 1.35;

export function estimatedRoadKm(straightKm: number): number {
  return straightKm * ROAD_FACTOR;
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
