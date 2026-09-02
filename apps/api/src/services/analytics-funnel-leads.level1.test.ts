import { describe, expect, it } from 'vitest'
import {
  computeLevel1StatsFromLeads,
  type FunnelLeadRow,
} from './analytics-funnel-leads.service.js'

function lead(
  createdAt: string,
  formSubmitted: boolean,
  submittedAt: string | null = null,
): FunnelLeadRow {
  return {
    sessionId: 's1',
    macId: '',
    createdAt,
    submittedAt,
    zip: '90210',
    email: 'a@example.com',
    utmSource: '',
    utmId: '',
    trustedFormUrl: '',
    formSubmitted,
    fields: {},
  }
}

describe('computeLevel1StatsFromLeads', () => {
  it('returns empty best time when no submitted leads', () => {
    const stats = computeLevel1StatsFromLeads([
      lead('2026-01-01T14:00:00Z', false),
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0]?.id).toBe('best-time')
    expect(stats[0]?.enoughData).toBe(false)
    expect(stats[0]?.metricValue).toBe(0)
  })

  it('uses When column createdAt, not submittedAt', () => {
    const stats = computeLevel1StatsFromLeads([
      lead('2026-01-01T19:30:00Z', true, '2026-01-01T09:00:00Z'),
      lead('2026-01-02T19:45:00Z', true, '2026-01-02T09:00:00Z'),
      lead('2026-01-03T14:00:00Z', true, '2026-01-03T19:00:00Z'),
    ])
    expect(stats[0]?.enoughData).toBe(true)
    expect(stats[0]?.metricValue).toBe(2)
    expect(stats[0]?.value).toMatch(/ET/)
  })

  it('parses ClickHouse space-separated timestamps like the When column', () => {
    const stats = computeLevel1StatsFromLeads([
      lead('2026-01-01 19:30:00', true),
      lead('2026-01-02 19:45:00', true),
    ])
    expect(stats[0]?.enoughData).toBe(true)
    expect(stats[0]?.metricValue).toBe(2)
  })
})
