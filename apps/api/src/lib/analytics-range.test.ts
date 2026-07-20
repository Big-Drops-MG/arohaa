import { describe, expect, it } from 'vitest'
import {
  parseAnalyticsCustomRange,
  resolveAnalyticsWindow,
} from './analytics-range.js'
import {
  addAnalyticsEtDays,
  analyticsDayKey,
  analyticsMondayKey,
  parseAnalyticsEtDayKey,
  startOfAnalyticsEtDay,
} from './analytics-timezone.js'

describe('resolveAnalyticsWindow', () => {
  // Wednesday 2026-07-15 15:00 ET = 19:00 UTC (EDT)
  const wed = new Date('2026-07-15T19:00:00.000Z')
  // Monday 2026-07-20 10:00 ET ≈ 14:00 UTC (EDT)
  const mon = new Date('2026-07-20T14:00:00.000Z')

  it('resolves today as current ET calendar day with 24h chart span', () => {
    const window = resolveAnalyticsWindow('today', wed)
    expect(window.granularity).toBe('hour')
    expect(window.start.getTime()).toBe(startOfAnalyticsEtDay(wed).getTime())
    expect(window.end.getTime()).toBe(wed.getTime())
    expect(window.seriesEnd.getTime()).toBe(
      addAnalyticsEtDays(startOfAnalyticsEtDay(wed), 1).getTime(),
    )
    expect(
      (window.seriesEnd.getTime() - window.start.getTime()) / (60 * 60 * 1000),
    ).toBe(24)
  })

  it("resolves yesterday as yesterday's full ET calendar day", () => {
    const window = resolveAnalyticsWindow('yesterday', wed)
    const todayStart = startOfAnalyticsEtDay(wed)
    expect(analyticsDayKey(window.start)).toBe('2026-07-14')
    expect(window.end.getTime()).toBe(todayStart.getTime())
    expect(window.seriesEnd.getTime()).toBe(todayStart.getTime())
    expect(window.end.getTime() - window.start.getTime()).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it('resolves this_week as Mon→now for queries and Mon–Sun (7 days) for charts', () => {
    const window = resolveAnalyticsWindow('this_week', mon)
    const monday = startOfAnalyticsEtDay(
      parseAnalyticsEtDayKey(analyticsMondayKey(mon)),
    )
    expect(window.start.getTime()).toBe(monday.getTime())
    expect(window.end.getTime()).toBe(mon.getTime())
    expect(window.seriesEnd.getTime()).toBe(
      addAnalyticsEtDays(monday, 7).getTime(),
    )
    expect(
      (window.seriesEnd.getTime() - window.start.getTime()) /
        (24 * 60 * 60 * 1000),
    ).toBe(7)
  })

  it('resolves last 7 calendar days including today', () => {
    const window = resolveAnalyticsWindow('7d', wed)
    const todayStart = startOfAnalyticsEtDay(wed)
    expect(window.start.getTime()).toBe(
      addAnalyticsEtDays(todayStart, -6).getTime(),
    )
    expect(window.end.getTime()).toBe(wed.getTime())
    expect(
      (window.seriesEnd.getTime() - window.start.getTime()) /
        (24 * 60 * 60 * 1000),
    ).toBe(7)
  })

  it('resolves last_week as previous Mon–Sun', () => {
    const window = resolveAnalyticsWindow('last_week', mon)
    expect(
      (window.seriesEnd.getTime() - window.start.getTime()) /
        (24 * 60 * 60 * 1000),
    ).toBe(7)
  })

  it('resolves custom inclusive range', () => {
    const custom = parseAnalyticsCustomRange('2026-07-01', '2026-07-10')
    expect(custom).toEqual({ from: '2026-07-01', to: '2026-07-10' })
    const window = resolveAnalyticsWindow('custom', wed, custom)
    expect(window.rangeId).toBe('custom')
    expect(window.granularity).toBe('day')
    expect(
      (window.seriesEnd.getTime() - window.start.getTime()) /
        (24 * 60 * 60 * 1000),
    ).toBe(10)
  })

  it('rejects inverted custom range', () => {
    expect(
      parseAnalyticsCustomRange('2026-07-10', '2026-07-01'),
    ).toBeUndefined()
  })
})
