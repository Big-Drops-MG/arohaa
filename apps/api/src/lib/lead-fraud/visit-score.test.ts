import { describe, expect, it } from 'vitest'
import { createFinding } from './findings.js'
import { emptyVisitSignals, scoreVisit } from './visit-score.js'

describe('scoreVisit', () => {
  it('marks incomplete signals without treating them as fraud proof', () => {
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: true,
        identityAvailable: true,
        arrivalStatsAvailable: true,
      }),
    )
    expect(assessment.coverage).toBe('insufficient')
    expect(assessment.scoreAvailable).toBe(false)
    expect(assessment.findings.some((f) => f.code === 'visit_signals_incomplete')).toBe(
      true,
    )
    expect(assessment.suspiciousVisit).toBe(false)
  })

  it('records arrival_burst in shadow mode only when stats are available', () => {
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: false,
        sdkVersion: '1.1.0',
        visibleMs: 12_000,
        arrivalCount24h: 10,
        identityAvailable: true,
        arrivalStatsAvailable: true,
        similarBehaviorAvailable: false,
      }),
    )
    expect(assessment.suspiciousVisit).toBe(true)
    expect(assessment.findings.some((f) => f.code === 'arrival_burst')).toBe(true)
    expect(assessment.score).toBeNull()
    expect(assessment.shadowScore).not.toBeNull()
  })

  it('marks unimplemented pattern matching as unavailable, not zero', () => {
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: false,
        sdkVersion: '1.1.0',
        visibleMs: 1_000,
        identityAvailable: true,
        arrivalStatsAvailable: true,
        similarBehaviorAvailable: false,
        similarBehaviorRepeatCount: null,
      }),
    )
    expect(
      assessment.findings.some(
        (f) => f.code === 'repeated_behavior_pattern_unavailable',
      ),
    ).toBe(true)
    expect(assessment.findings.some((f) => f.code === 'repeated_behavior_pattern')).toBe(
      false,
    )
  })

  it('counts automation / integrity / page findings as suspicious visits', () => {
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: false,
        sdkVersion: '1.1.0',
        visibleMs: 8_000,
        identityAvailable: true,
        arrivalStatsAvailable: true,
        similarBehaviorAvailable: false,
        browserFindings: [
          createFinding({
            code: 'automation_indicator_observed',
            detail: 'webdriver',
            subject: 'visit',
            source: 'browser_consistency',
            availability: 'available',
            shadow: true,
            proposedScoreDelta: 6,
            observedAt: 'evt:1',
          }),
        ],
      }),
    )
    expect(assessment.suspiciousVisit).toBe(true)
  })

  it('does not treat query failures as clean zero arrivals', () => {
    const assessment = scoreVisit(
      emptyVisitSignals({
        sessionId: 's1',
        workspaceId: 'w1',
        signalsIncomplete: false,
        sdkVersion: '1.1.0',
        visibleMs: 8_000,
        identityAvailable: false,
        arrivalStatsAvailable: false,
        similarBehaviorAvailable: false,
        arrivalCount24h: null,
      }),
    )
    expect(assessment.coverage).toBe('partial')
    expect(
      assessment.findings.some((f) => f.code === 'visit_identity_unavailable'),
    ).toBe(true)
    expect(
      assessment.findings.some((f) => f.code === 'visit_arrival_stats_unavailable'),
    ).toBe(true)
    expect(assessment.findings.some((f) => f.code === 'arrival_burst')).toBe(false)
  })
})
