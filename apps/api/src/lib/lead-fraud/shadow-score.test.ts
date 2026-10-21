import { describe, expect, it } from 'vitest'
import { createFinding } from './findings.js'
import { emptyFeatures } from './features.js'
import { scoreLeadFraud } from './score.js'

describe('lead shadow score wiring', () => {
  it('includes integrity/browser shadow findings in proposed delta', () => {
    const features = emptyFeatures({
      formSubmitted: true,
      email: 'person@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      formZipEntered: '94105',
      fiBehaviorKnown: true,
      velocityWindowKnown: true,
      hasFormStarted: true,
      hasFieldInteraction: true,
      typedCount: 12,
      fillDurationMs: 45_000,
      fingerprint: 'abc123',
      shadowExtraFindings: [
        createFinding({
          code: 'automation_indicator_observed',
          detail: 'webdriver',
          subject: 'visit',
          source: 'browser_consistency',
          shadow: true,
          proposedScoreDelta: 6,
          contributesToScore: false,
        }),
        createFinding({
          code: 'event_id_content_conflict',
          detail: 'conflict',
          subject: 'visit',
          source: 'telemetry_integrity',
          shadow: true,
          proposedScoreDelta: 10,
          contributesToScore: false,
        }),
      ],
    })

    const assessment = scoreLeadFraud(features)
    expect(assessment.scoreAvailable).toBe(true)
    expect(assessment.shadowProposedDelta).toBe(16)
    expect(assessment.shadowScore).toBe(
      Math.max(0, (assessment.score ?? 0) - 16),
    )
    expect(
      assessment.findings.some((f) => f.code === 'automation_indicator_observed'),
    ).toBe(true)
    expect(
      assessment.findings.some((f) => f.code === 'event_id_content_conflict'),
    ).toBe(true)
  })
})
