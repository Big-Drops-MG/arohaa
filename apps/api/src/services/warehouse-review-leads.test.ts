import { describe, expect, it } from 'vitest'
import {
  compareSessionRecencyDesc,
  newerTimestamp,
  selectReviewLeadsWithoutEvictingSeed,
} from './warehouse-review-leads.js'

describe('warehouse-review-leads', () => {
  it('keeps the newer lastAt when merging', () => {
    expect(newerTimestamp('2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(newerTimestamp('', '2026-02-01')).toBe('2026-02-01')
    expect(newerTimestamp('2026-03-01', undefined)).toBe('2026-03-01')
  })

  it('sorts empty timestamps after dated rows', () => {
    const rows = [
      { sessionId: 'a', createdAt: '' },
      { sessionId: 'b', createdAt: '2026-10-20 12:00:00' },
      { sessionId: 'c', createdAt: '2026-10-21 12:00:00' },
    ]
    rows.sort(compareSessionRecencyDesc)
    expect(rows.map((r) => r.sessionId)).toEqual(['c', 'b', 'a'])
  })

  it('never evicts seed leads when extras arrive', () => {
    const seed = Array.from({ length: 100 }, (_, i) => ({
      workspaceId: 'ws',
      sessionId: `seed-${String(i).padStart(3, '0')}`,
      createdAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
    }))
    const extras = Array.from({ length: 100 }, (_, i) => ({
      workspaceId: 'ws',
      sessionId: `elevated-${String(i).padStart(3, '0')}`,
      createdAt: `2026-10-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
    }))

    const merged = selectReviewLeadsWithoutEvictingSeed(seed, extras)

    expect(merged).toHaveLength(200)
    for (const lead of seed) {
      expect(
        merged.some(
          (row) =>
            row.workspaceId === lead.workspaceId &&
            row.sessionId === lead.sessionId,
        ),
      ).toBe(true)
    }
    expect(merged[0]?.sessionId.startsWith('elevated-')).toBe(true)
  })
})
