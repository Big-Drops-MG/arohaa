import { describe, expect, it } from 'vitest'
import {
  parseAnalyticsUtmFilter,
  utmFilterCacheKey,
  utmFilterParams,
  utmFilterSql,
} from './analytics-utm-filter.js'

describe('analytics utm filter', () => {
  it('parses dual source and medium params', () => {
    expect(
      parseAnalyticsUtmFilter({
        utm_source: 'google',
        utm_medium: 'S1',
      }),
    ).toEqual({ utm_source: 'google', utm_medium: 'S1' })
  })

  it('falls back to legacy dim/value', () => {
    expect(
      parseAnalyticsUtmFilter({
        utm_dim: 'utm_medium',
        utm_value: 'S1',
      }),
    ).toEqual({ utm_medium: 'S1' })
  })

  it('builds AND sql and params for both dimensions', () => {
    const filter = { utm_source: 'google', utm_medium: 'S1' }
    expect(utmFilterSql(filter)).toBe(
      ' AND utm_source = {utm_source:String} AND utm_medium = {utm_medium:String}',
    )
    expect(utmFilterParams(filter)).toEqual({
      utm_source: 'google',
      utm_medium: 'S1',
    })
    expect(utmFilterCacheKey(filter)).toBe('utm_source:google|utm_medium:S1')
  })
})
