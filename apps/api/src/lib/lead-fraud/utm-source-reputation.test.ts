import { describe, expect, it } from 'vitest'
import { emptyFeatures } from './features.js'
import { scoreLeadFraud } from './score.js'
import {
  evaluateUtmSourceReputation,
  utmSourceReputationToken,
} from './utm-source-reputation.js'

describe('evaluateUtmSourceReputation', () => {
  it('never taints empty source', () => {
    const rep = evaluateUtmSourceReputation({
      source: '',
      submitCount: 20,
      locationMismatchCount: 20,
    })
    expect(rep.status).toBe('unknown')
  })

  it('stays unknown below min submits', () => {
    const rep = evaluateUtmSourceReputation({
      source: '164993',
      submitCount: 9,
      locationMismatchCount: 9,
    })
    expect(rep.status).toBe('unknown')
    expect(rep.rate).toBeCloseTo(1)
  })

  it('taints at 9/10 mismatch', () => {
    const rep = evaluateUtmSourceReputation({
      source: '164993',
      submitCount: 10,
      locationMismatchCount: 9,
    })
    expect(rep.status).toBe('location_mismatch_cluster')
    expect(rep.rate).toBeCloseTo(0.9)
  })

  it('stays clean at 5/10 mismatch', () => {
    const rep = evaluateUtmSourceReputation({
      source: 'good-src',
      submitCount: 10,
      locationMismatchCount: 5,
    })
    expect(rep.status).toBe('clean')
  })

  it('taints at exactly 70%', () => {
    const rep = evaluateUtmSourceReputation({
      source: 'edge',
      submitCount: 10,
      locationMismatchCount: 7,
    })
    expect(rep.status).toBe('location_mismatch_cluster')
  })
})

describe('utmSourceReputationToken', () => {
  it('encodes status and counts', () => {
    expect(
      utmSourceReputationToken({
        source: '164993',
        status: 'location_mismatch_cluster',
        submitCount: 28,
        locationMismatchCount: 28,
        rate: 1,
      }),
    ).toBe('utmrep:164993:location_mismatch_cluster:28:28')
  })

  it('returns none for empty', () => {
    expect(utmSourceReputationToken(null)).toBe('utmrep:none')
  })
})

describe('scoreLeadFraud utm source cluster', () => {
  it('applies -30 for location_mismatch_cluster', () => {
    const baseline = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'person@gmail.com',
        firstName: 'Sam',
        lastName: 'Lee',
        formZipEntered: '10001',
        fillDurationMs: 20_000,
        typedCount: 15,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 5,
        submitUtmSource: '164993',
        utmSourceReputation: 'unknown',
      }),
    )
    const tainted = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'person@gmail.com',
        firstName: 'Sam',
        lastName: 'Lee',
        formZipEntered: '10001',
        fillDurationMs: 20_000,
        typedCount: 15,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 5,
        submitUtmSource: '164993',
        utmSourceReputation: 'location_mismatch_cluster',
        utmSourceSubmitCount: 28,
        utmSourceMismatchCount: 28,
      }),
    )
    expect(baseline.score).not.toBeNull()
    expect(tainted.score).not.toBeNull()
    expect((baseline.score ?? 0) - (tainted.score ?? 0)).toBe(30)
    expect(
      tainted.findings.some(
        (f) => f.code === 'utm_source_location_mismatch_cluster',
      ),
    ).toBe(true)
  })

  it('with paste + location + cluster drops below fraud threshold', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'person@gmail.com',
        firstName: 'Sam',
        lastName: 'Lee',
        formZipEntered: '49061',
        locationComparison: 'inconsistency',
        locationComparisonDetail: 'Entered ZIP state MI vs IP geo state SC',
        pastedEmail: true,
        pastedName: true,
        pastedPhone: true,
        pasteCount: 3,
        fillDurationMs: 8_000,
        typedCount: 2,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 5,
        submitUtmSource: '164993',
        utmSourceReputation: 'location_mismatch_cluster',
        utmSourceSubmitCount: 28,
        utmSourceMismatchCount: 28,
      }),
    )
    expect(assessment.score).not.toBeNull()
    expect(assessment.score!).toBeLessThan(50)
    expect(assessment.label).toBe('fraud')
  })
})
