interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(from: Location, to: Location): number {
  const R = 6371; 
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
    Math.cos(toRad(to.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; 
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate ETA in minutes based on distance
 * Lagos average speed: 20-25 km/hr in traffic
 */
export function calculateETA(distanceKm: number): number {
  const avgSpeedKmPerHour = 20; 
  const hours = distanceKm / avgSpeedKmPerHour;
  const minutes = Math.ceil(hours * 60);

  return minutes;
}

/**
 * Format ETA for display
 */
export function formatETA(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (remainingMins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMins} minutes`;
}