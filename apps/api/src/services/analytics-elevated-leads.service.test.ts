import { describe, expect, it } from 'vitest'
import {
  isElevatedRiskAssessment,
  toElevatedFunnelLead,
} from './analytics-elevated-leads.service.js'
import type { LeadFraudAssessment } from '../lib/lead-fraud/types.js'

describe('elevated-leads helpers', () => {
  it('maps raw session rows into funnel lead shape', () => {
    const lead = toElevatedFunnelLead({
      session_id: 'sess-1',
      fingerprint: 'abcdefghijklmnopqr',
      last_at: '2026-11-12 12:00:00.000',
      submitted_at: '2026-11-12 12:00:00.000',
      props: JSON.stringify({
        fields: {
          email: 'a@b.com',
          zip: '10001',
          first_name: 'Ada',
        },
      }),
      form_submitted: 1,
      sample_url: 'https://example.com/?utm_source=559',
      zip_val: '10001',
      client_ip: '1.2.3.4',
      utm_source: '559',
      utm_id: '',
      utm_s1: '',
    })
    expect(lead.sessionId).toBe('sess-1')
    expect(lead.email).toBe('a@b.com')
    expect(lead.zip).toBe('10001')
    expect(lead.utmSource).toBe('559')
    expect(lead.formSubmitted).toBe(true)
  })

  it('detects elevated assessments', () => {
    const fraud: LeadFraudAssessment = {
      score: 20,
      scoreAvailable: true,
      label: 'fraud',
      effectiveLabel: 'fraud',
      coverage: 'sufficient',
      findings: [],
      reasons: [],
      modelVersion: 'test',
    }
    expect(isElevatedRiskAssessment(fraud)).toBe(true)
    expect(
      isElevatedRiskAssessment({
        ...fraud,
        scoreAvailable: false,
      }),
    ).toBe(false)
  })
})
