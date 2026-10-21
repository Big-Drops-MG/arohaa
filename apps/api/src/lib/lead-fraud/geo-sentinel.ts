
export function isValidCoordinate(value: number | null | undefined): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  )
}

export function isValidLongitude(value: number | null | undefined): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  )
}

export function isMissingLocationSentinel(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return latitude === 0 && longitude === 0
}

export function resolveStoredGeoPoint(input: {
  latitude: number | null | undefined
  longitude: number | null | undefined
}):
  | { status: 'available'; latitude: number; longitude: number }
  | { status: 'unavailable'; reason: string } {
  const { latitude, longitude } = input
  if (latitude == null || longitude == null) {
    return { status: 'unavailable', reason: 'missing' }
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { status: 'unavailable', reason: 'nonfinite' }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { status: 'unavailable', reason: 'out_of_range' }
  }
  if (isMissingLocationSentinel(latitude, longitude)) {
    return { status: 'unavailable', reason: 'sentinel_0_0' }
  }
  return { status: 'available', latitude, longitude }
}
