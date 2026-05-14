/**
 * Funções geométricas para cálculo de rotas GPS.
 */

export function getDistanceBetweenPointsKm(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371;
  const deltaLat = ((second.lat - first.lat) * Math.PI) / 180;
  const deltaLng = ((second.lng - first.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos((first.lat * Math.PI) / 180) *
      Math.cos((second.lat * Math.PI) / 180) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function calculateRouteDistanceKm(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += getDistanceBetweenPointsKm(coordinates[i - 1], coordinates[i]);
  }
  return total;
}
