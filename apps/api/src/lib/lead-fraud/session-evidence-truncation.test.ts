import { describe, expect, it } from 'vitest'
import { SESSION_EVIDENCE_EVENT_LIMIT } from './session-evidence-load.js'
import { emptyVisitSignals, scoreVisit } from './visit-score.js'

describe('session evidence truncation', () => {
  it('exposes a dedicated truncation finding when capped', () => {
    expect(SESSION_EVIDENCE_EVENT_LIMIT).toBe(500)
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: false,
        sdkVersion: '1.1.0',
        visibleMs: 1000,
        identityAvailable: true,
        arrivalStatsAvailable: true,
        similarBehaviorAvailable: false,
        evidenceTruncated: true,
      }),
    )
    expect(
      assessment.findings.some((f) => f.code === 'visit_evidence_truncated'),
    ).toBe(true)
    expect(
      assessment.findings.find((f) => f.code === 'visit_evidence_truncated')
        ?.availability,
    ).toBe('unavailable')
  })
})
