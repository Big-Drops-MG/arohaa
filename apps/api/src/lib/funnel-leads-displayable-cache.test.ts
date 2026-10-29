import { describe, expect, it } from 'vitest'
import {
  displayableLeadsWatermark,
  mergeDisplayableLeadsBySession,
  subtractMsFromClickHouseTimestamp,
} from './funnel-leads-displayable-cache.js'

describe('funnel-leads-displayable-cache', () => {
  it('merges by session and keeps newer rows', () => {
    const merged = mergeDisplayableLeadsBySession(
      [
        { sessionId: 'a', createdAt: '2026-01-01 00:00:00.000', zip: 'old' },
        { sessionId: 'b', createdAt: '2026-01-02 00:00:00.000', zip: 'b' },
      ],
      [
        { sessionId: 'a', createdAt: '2026-01-03 00:00:00.000', zip: 'new' },
        { sessionId: 'c', createdAt: '2026-01-04 00:00:00.000', zip: 'c' },
      ],
      100,
    )

    expect(merged.map((row) => row.sessionId)).toEqual(['c', 'a', 'b'])
    expect(merged.find((row) => row.sessionId === 'a')?.zip).toBe('new')
  })

  it('caps to max sessions by recency', () => {
    const merged = mergeDisplayableLeadsBySession(
      [
        { sessionId: 'old', createdAt: '2026-01-01 00:00:00.000' },
        { sessionId: 'mid', createdAt: '2026-01-02 00:00:00.000' },
      ],
      [{ sessionId: 'new', createdAt: '2026-01-03 00:00:00.000' }],
      2,
    )
    expect(merged.map((row) => row.sessionId)).toEqual(['new', 'mid'])
  })

  it('computes watermark and overlap since', () => {
    expect(
      displayableLeadsWatermark([
        { createdAt: '2026-01-01 00:00:00.000' },
        { createdAt: '2026-01-05 12:00:00.000' },
      ]),
    ).toBe('2026-01-05 12:00:00.000')

    const since = subtractMsFromClickHouseTimestamp(
      '2026-01-05 12:00:00.000',
      15 * 60 * 1000,
    )
    expect(since).toBe('2026-01-05 11:45:00.000')
  })
})
