import { describe, expect, it } from 'vitest'
import { findingsFromBrowserObservations } from './browser-consistency.js'
import { createFinding } from './findings.js'
import { emptyFeatures } from './features.js'
import { findingsFromPageIntegrity } from './page-integrity.js'
import { scoreLeadFraud } from './score.js'
import { emptyVisitSignals, scoreVisit } from './visit-score.js'
import {
  composeEvidenceToken,
  shadowEvidenceToken,
} from './evidence-token.js'

describe('assessment pipeline (event evidence → score → warehouse-ready)', () => {
  it('old clients without sdk_version keep coverage gaps, not auto-suspicion', () => {
    const browser = findingsFromBrowserObservations({ obs: null })
    const visit = scoreVisit(
      emptyVisitSignals({
        sessionId: 'old-client',
        workspaceId: 'w1',
        sdkVersion: '',
        signalsIncomplete: true,
        browserFindings: browser,
      }),
    )
    expect(visit.suspiciousVisit).toBe(false)
    expect(
      visit.findings.some((f) => f.code === 'visit_signals_incomplete'),
    ).toBe(true)
    expect(browser[0]?.availability).toBe('unavailable')
  })

  it('shadow detectors feed lead shadowScore without changing established score math alone', () => {
    const integrity = createFinding({
      code: 'session_token_expired',
      detail: 'expired',
      subject: 'visit',
      source: 'telemetry_integrity',
      shadow: true,
      proposedScoreDelta: 3,
    })
    const browser = findingsFromBrowserObservations({
      obs: { webdriver: true, automationHints: ['webdriver'] },
    })
    const page = findingsFromPageIntegrity({
      props: {
        context_accessible: true,
        script_origins: ['https://evil.example'],
        form_actions: [],
        iframe_origins: [],
      },
      baseline: { scriptOrigins: ['https://cdn.arohaa.net'] },
    })

    const features = emptyFeatures({
      formSubmitted: true,
      email: 'a@example.com',
      firstName: 'A',
      lastName: 'B',
      formZipEntered: '10001',
      fiBehaviorKnown: true,
      velocityWindowKnown: true,
      hasFormStarted: true,
      hasFieldInteraction: true,
      typedCount: 8,
      fillDurationMs: 20_000,
      fingerprint: 'fp1',
      shadowExtraFindings: [integrity, ...browser, ...page],
    })

    const beforeToken = composeEvidenceToken('c', 'fi:known', 'shadow:none')
    const afterToken = composeEvidenceToken(
      'c',
      'fi:known',
      shadowEvidenceToken(features.shadowExtraFindings),
    )
    expect(beforeToken).not.toBe(afterToken)

    const assessment = scoreLeadFraud(features)
    expect(assessment.scoreAvailable).toBe(true)
    expect(assessment.shadowProposedDelta).toBeGreaterThan(0)
    expect(assessment.shadowScore).not.toBeNull()
    expect(assessment.shadowScore).toBeLessThan(assessment.score ?? 100)
  })

  it('missing page baseline is not assessed rather than suspicious', () => {
    const withoutBaseline = findingsFromPageIntegrity({
      props: {
        context_accessible: true,
        script_origins: ['https://cdn.example.com'],
      },
      baseline: null,
    })
    expect(withoutBaseline).toEqual([])
    const explicit = createFinding({
      code: 'page_integrity_not_assessed',
      detail: 'no_approved_baseline',
      subject: 'visit',
      source: 'page_integrity',
      availability: 'unavailable',
      shadow: true,
    })
    expect(explicit.availability).toBe('unavailable')
  })
})
