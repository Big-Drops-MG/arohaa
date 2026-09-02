import { describe, expect, it } from 'vitest'
import {
  formatFingerprintAsMacId,
  paginateDisplayableLeads,
  type FunnelLeadRow,
} from '../services/analytics-funnel-leads.service.js'

function lead(sessionId: string): FunnelLeadRow {
  return {
    sessionId,
    macId: '',
    createdAt: '2026-01-01T00:00:00Z',
    submittedAt: null,
    zip: '90210',
    email: `${sessionId}@example.com`,
    utmSource: '',
    utmId: '',
    trustedFormUrl: '',
    formSubmitted: false,
    fields: {},
  }
}

describe('formatFingerprintAsMacId', () => {
  it('formats short fingerprints as colon-separated MAC-style ids', () => {
    expect(formatFingerprintAsMacId('2c88ce64')).toBe('2c:88:ce:64:00:00')
    expect(formatFingerprintAsMacId('c71d4fc')).toBe('c7:1d:4f:c0:00:00')
  })

  it('formats full 12-char fingerprints', () => {
    expect(formatFingerprintAsMacId('001a2b3c4d5e')).toBe('00:1a:2b:3c:4d:5e')
  })

  it('returns empty for blank input', () => {
    expect(formatFingerprintAsMacId('')).toBe('')
    expect(formatFingerprintAsMacId('---')).toBe('')
  })
})

describe('paginateDisplayableLeads', () => {
  it('returns empty page with zero total', () => {
    expect(paginateDisplayableLeads([], 15, 30)).toEqual({
      leads: [],
      total: 0,
      limit: 15,
      offset: 0,
      hasMore: false,
    })
  })

  it('pages through displayable leads with stable total', () => {
    const leads = Array.from({ length: 37 }, (_, i) => lead(`s${i}`))

    const page1 = paginateDisplayableLeads(leads, 15, 0)
    expect(page1.total).toBe(37)
    expect(page1.leads).toHaveLength(15)
    expect(page1.leads[0]?.sessionId).toBe('s0')
    expect(page1.hasMore).toBe(true)
    expect(page1.offset).toBe(0)

    const page2 = paginateDisplayableLeads(leads, 15, 15)
    expect(page2.total).toBe(37)
    expect(page2.leads).toHaveLength(15)
    expect(page2.leads[0]?.sessionId).toBe('s15')
    expect(page2.hasMore).toBe(true)
    expect(page2.offset).toBe(15)

    const page3 = paginateDisplayableLeads(leads, 15, 30)
    expect(page3.total).toBe(37)
    expect(page3.leads).toHaveLength(7)
    expect(page3.leads[0]?.sessionId).toBe('s30')
    expect(page3.hasMore).toBe(false)
    expect(page3.offset).toBe(30)
  })

  it('clamps offset past the end to the last page', () => {
    const leads = Array.from({ length: 20 }, (_, i) => lead(`s${i}`))
    const page = paginateDisplayableLeads(leads, 15, 100)
    expect(page.offset).toBe(15)
    expect(page.leads).toHaveLength(5)
    expect(page.leads[0]?.sessionId).toBe('s15')
    expect(page.hasMore).toBe(false)
    expect(page.total).toBe(20)
  })

  it('clamps limit to 50', () => {
    const leads = Array.from({ length: 60 }, (_, i) => lead(`s${i}`))
    const page = paginateDisplayableLeads(leads, 100, 0)
    expect(page.limit).toBe(50)
    expect(page.leads).toHaveLength(50)
    expect(page.hasMore).toBe(true)
  })
})
