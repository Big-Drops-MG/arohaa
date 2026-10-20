import { describe, expect, it } from 'vitest'
import { compareEnteredZipToIpGeo } from './location-compare.js'

describe('compareEnteredZipToIpGeo', () => {
  it('marks consistent when entered ZIP state matches IP state', () => {
    const result = compareEnteredZipToIpGeo({
      formZipEntered: '10001',
      ipCountry: 'United States',
      ipCountryCode: 'US',
      ipStateCode: 'NY',
      ipCity: 'New York',
      ipPostal: '99999',
    })
    expect(result.result).toBe('consistent')
    expect(result.enteredStateCode).toBe('NY')
    expect(result.detail.toLowerCase()).not.toContain('99999')
  })

  it('marks inconsistency on different state', () => {
    const result = compareEnteredZipToIpGeo({
      formZipEntered: '10001',
      ipCountryCode: 'US',
      ipCountry: 'United States',
      ipStateCode: 'CA',
      ipCity: 'Los Angeles',
    })
    expect(result.result).toBe('inconsistency')
  })

  it('marks unavailable when entered ZIP missing', () => {
    const result = compareEnteredZipToIpGeo({
      formZipEntered: '',
      ipCountryCode: 'US',
      ipCountry: 'United States',
      ipStateCode: 'NY',
      ipCity: 'New York',
    })
    expect(result.result).toBe('unavailable')
  })

  it('marks inconsistency when country differs', () => {
    const result = compareEnteredZipToIpGeo({
      formZipEntered: '10001',
      ipCountryCode: 'CA',
      ipCountry: 'Canada',
      ipStateCode: 'ON',
      ipCity: 'Toronto',
    })
    expect(result.result).toBe('inconsistency')
  })

  it('marks minor_difference when only country agrees', () => {
    const result = compareEnteredZipToIpGeo({
      formZipEntered: '10001',
      ipCountryCode: 'US',
      ipCountry: 'United States',
      ipStateCode: '',
      ipCity: '',
    })
    expect(result.result).toBe('minor_difference')
  })
})
