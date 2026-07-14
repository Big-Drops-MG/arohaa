import { describe, expect, it } from 'vitest'
import {
  addAnalyticsEtDays,
  analyticsDayKey,
  analyticsEtToUtcMs,
  analyticsHourKey,
  chDayBucketKey,
  chHourBucketKey,
  getAnalyticsEtParts,
  startOfAnalyticsEtDay,
} from './analytics-timezone.js'

describe('analytics timezone', () => {
  it('uses the correct Eastern offset in winter and summer', () => {
    expect(new Date(analyticsEtToUtcMs(2026, 1, 15, 12)).toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    )
    expect(new Date(analyticsEtToUtcMs(2026, 7, 15, 12)).toISOString()).toBe(
      '2026-07-15T16:00:00.000Z',
    )
  })

  it('uses 23-hour and 25-hour Eastern calendar days at DST transitions', () => {
    const springStart = startOfAnalyticsEtDay(
      new Date('2026-03-08T12:00:00.000Z'),
    )
    const fallStart = startOfAnalyticsEtDay(
      new Date('2026-11-01T12:00:00.000Z'),
    )

    expect(
      addAnalyticsEtDays(springStart, 1).getTime() - springStart.getTime(),
    ).toBe(23 * 60 * 60 * 1000)
    expect(
      addAnalyticsEtDays(fallStart, 1).getTime() - fallStart.getTime(),
    ).toBe(25 * 60 * 60 * 1000)
  })

  it('keeps both repeated fall-back hours as distinct timeline buckets', () => {
    const firstOneAm = new Date('2026-11-01T05:00:00.000Z')
    const secondOneAm = new Date('2026-11-01T06:00:00.000Z')

    expect(getAnalyticsEtParts(firstOneAm).hour).toBe(1)
    expect(getAnalyticsEtParts(secondOneAm).hour).toBe(1)
    expect(analyticsHourKey(firstOneAm)).not.toBe(analyticsHourKey(secondOneAm))
  })

  it('uses Eastern calendar keys for days and instant keys for rolling hours', () => {
    const instant = new Date('2026-07-14T02:30:00.000Z')

    expect(analyticsDayKey(instant)).toBe('2026-07-13')
    expect(analyticsHourKey(instant)).toBe('2026-07-14T02')
    expect(chDayBucketKey()).toContain("'America/New_York'")
    expect(chHourBucketKey()).toContain("'UTC'")
  })
})
