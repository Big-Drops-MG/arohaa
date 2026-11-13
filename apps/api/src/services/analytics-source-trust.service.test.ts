import { describe, expect, it } from 'vitest'
import { mapSourceTrustRawRow } from './analytics-source-trust.service.js'

describe('mapSourceTrustRawRow', () => {
  it('maps empty source and computes rates + reputation windows', () => {
    const row = mapSourceTrustRawRow({
      utm_source: '(none)',
      leads_total: '28',
      leads_7d: '28',
      leads_30d: '28',
      mismatch_total: '2',
      mismatch_7d: '2',
      mismatch_30d: '2',
      avg_trust: '75.2',
      avg_trust_7d: '75.2',
      avg_trust_30d: '75.2',
    })
    expect(row.utmSource).toBe('—')
    expect(row.trustScore).toBe(75)
    expect(row.trustScore7d).toBe(75)
    expect(row.mismatchRate7d).toBeCloseTo(2 / 28)
    expect(row.reputation7d).toBe('unknown')
    expect(row.reputation30d).toBe('unknown')
  })

  it('marks 7d cluster while 30d can stay clean', () => {
    const row = mapSourceTrustRawRow({
      utm_source: '559',
      leads_total: '22',
      leads_7d: '10',
      leads_30d: '22',
      mismatch_total: '10',
      mismatch_7d: '10',
      mismatch_30d: '10',
      avg_trust: '58',
      avg_trust_7d: '20',
      avg_trust_30d: '58',
    })
    expect(row.reputation7d).toBe('location_mismatch_cluster')
    expect(row.reputation30d).toBe('clean')
    expect(row.trustScore7d).toBe(20)
    expect(row.trustScore30d).toBe(58)
  })
})
