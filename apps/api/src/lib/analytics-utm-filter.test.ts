import { describe, expect, it } from 'vitest'
import {
  parseAnalyticsUtmFilter,
  utmFilterCacheKey,
  utmFilterParams,
  utmFilterSql,
} from './analytics-utm-filter.js'

describe('analytics utm filter', () => {
  it('parses multi source and s1 params', () => {
    expect(
      parseAnalyticsUtmFilter({
        utm_source: 'google,facebook',
        utm_s1: 'S1,S2',
      }),
    ).toEqual({
      utm_source: ['google', 'facebook'],
      utm_s1: ['S1', 'S2'],
    })
  })

  it('falls back to legacy dim/value for source and s1', () => {
    expect(
      parseAnalyticsUtmFilter({
        utm_dim: 'utm_s1',
        utm_value: 'S1',
      }),
    ).toEqual({ utm_s1: ['S1'] })
  })

  it('ignores legacy medium-only filters', () => {
    expect(
      parseAnalyticsUtmFilter({
        utm_dim: 'utm_medium',
        utm_value: 'cpc',
      }),
    ).toBeUndefined()
  })

  it('builds AND IN sql and array params', () => {
    const filter = {
      utm_source: ['google', 'facebook'],
      utm_s1: ['S1'],
    }
    expect(utmFilterSql(filter)).toBe(
      ' AND utm_source IN {utm_sources:Array(String)} AND utm_s1 IN {utm_s1s:Array(String)}',
    )
    expect(utmFilterParams(filter)).toEqual({
      utm_sources: ['google', 'facebook'],
      utm_s1s: ['S1'],
    })
    expect(utmFilterCacheKey(filter)).toBe(
      'utm_source:facebook,google|utm_s1:S1',
    )
  })

  it('applies the compiled segment as an extra AND clause with its params', () => {
    const filter = {
      segmentSql: '(city = {seg_p_0: String})',
      segmentParams: { seg_p_0: 'Pune' },
    }
    expect(utmFilterSql(filter)).toBe(' AND (city = {seg_p_0: String})')
    expect(utmFilterParams(filter)).toEqual({ seg_p_0: 'Pune' })
  })

  it('gives segmented and unsegmented requests distinct cache keys', () => {
    const unsegmented = { utm_source: ['google'] }
    const segmented = {
      utm_source: ['google'],
      segmentSql: '(city = {seg_p_0: String})',
      segmentParams: { seg_p_0: 'Pune' },
    }
    const otherSegment = {
      utm_source: ['google'],
      segmentSql: '(city = {seg_p_0: String})',
      segmentParams: { seg_p_0: 'Mumbai' },
    }

    expect(utmFilterCacheKey(segmented)).not.toBe(
      utmFilterCacheKey(unsegmented),
    )
    expect(utmFilterCacheKey(segmented)).not.toBe(
      utmFilterCacheKey(otherSegment),
    )
  })
})
