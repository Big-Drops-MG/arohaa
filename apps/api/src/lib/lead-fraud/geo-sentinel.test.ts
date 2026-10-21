import { describe, expect, it } from 'vitest'
import {
  isMissingLocationSentinel,
  isValidCoordinate,
  resolveStoredGeoPoint,
} from './geo-sentinel.js'

describe('geo sentinel', () => {
  it('treats individual zero coordinates as valid', () => {
    expect(isValidCoordinate(0)).toBe(true)
    expect(
      resolveStoredGeoPoint({ latitude: 0, longitude: -75.5 }).status,
    ).toBe('available')
    expect(
      resolveStoredGeoPoint({ latitude: 51.5, longitude: 0 }).status,
    ).toBe('available')
  })

  it('treats (0,0) as the documented missing-location sentinel', () => {
    expect(isMissingLocationSentinel(0, 0)).toBe(true)
    expect(resolveStoredGeoPoint({ latitude: 0, longitude: 0 })).toEqual({
      status: 'unavailable',
      reason: 'sentinel_0_0',
    })
  })

  it('rejects nonfinite and out-of-range values', () => {
    expect(
      resolveStoredGeoPoint({ latitude: Number.NaN, longitude: 10 }).status,
    ).toBe('unavailable')
    expect(
      resolveStoredGeoPoint({ latitude: 100, longitude: 10 }).status,
    ).toBe('unavailable')
  })
})
