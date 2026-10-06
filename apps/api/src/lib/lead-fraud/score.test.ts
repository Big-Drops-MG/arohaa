import { describe, expect, it } from 'vitest'
import { emptyFeatures, parseFiBehavior } from './features.js'
import { scoreLeadFraud } from './score.js'
import {
  isValidEmailFormat,
  looksLikeRandomEmailLocal,
} from './disposable-domains.js'

describe('parseFiBehavior', () => {
  it('detects paste into email and fill duration', () => {
    const parsed = parseFiBehavior([
      { offsetMs: 0, message: 'form started', kind: 5 },
      { offsetMs: 800, message: "typed 'a' in [first_name]", kind: 0 },
      { offsetMs: 1200, message: 'pasted in [email]', kind: 1 },
      { offsetMs: 1800, message: 'form submitted', kind: 5 },
    ])
    expect(parsed.hasFormStarted).toBe(true)
    expect(parsed.pastedEmail).toBe(true)
    expect(parsed.typedCount).toBe(1)
    expect(parsed.fillDurationMs).toBe(1800)
  })
})

describe('email quality helpers', () => {
  it('validates email format', () => {
    expect(isValidEmailFormat('jane.doe@gmail.com')).toBe(true)
    expect(isValidEmailFormat('bad@@mail')).toBe(false)
    expect(isValidEmailFormat('no-at-sign')).toBe(false)
  })

  it('detects random local parts', () => {
    expect(looksLikeRandomEmailLocal('xq7km2p9abcd@gmail.com')).toBe(true)
    expect(looksLikeRandomEmailLocal('jane.doe@gmail.com')).toBe(false)
  })
})

describe('scoreLeadFraud', () => {
  it('gives high trust to a normal typed lead', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'abc123',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'jane.doe@gmail.com',
        firstName: 'Jane',
        lastName: 'Doe',
        zip: '90210',
        geoZip: '90210',
        trustedFormUrl: 'https://cert.trustedform.com/abc',
        fillDurationMs: 45_000,
        typedCount: 40,
        pasteCount: 0,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fieldCount: 8,
      }),
    )
    expect(assessment.label).toBe('legit')
    expect(assessment.score).toBeGreaterThanOrEqual(80)
  })

  it('classifies paste-heavy bot-like fill as fraud with low trust', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: '',
        browser: 'Googlebot',
        formSubmitted: true,
        email: 'x@mailinator.com',
        firstName: 'asdf',
        lastName: 'test',
        zip: '',
        trustedFormUrl: '',
        fillDurationMs: 900,
        typedCount: 0,
        pasteCount: 4,
        pastedEmail: true,
        pastedName: true,
        hasFormStarted: false,
        hasFieldInteraction: true,
        fieldCount: 1,
        fingerprintSubmits24h: 6,
      }),
    )
    expect(assessment.label).toBe('fraud')
    expect(assessment.score).toBeLessThan(50)
    expect(assessment.reasons.length).toBeGreaterThan(2)
  })

  it('flags invalid email format as fraud', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'not-an-email',
        firstName: 'Sam',
        lastName: 'Lee',
        zip: '10001',
        fillDurationMs: 20_000,
        typedCount: 15,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fieldCount: 5,
      }),
    )
    expect(assessment.label).toBe('fraud')
    expect(assessment.reasons.some((r) => /Invalid email/i.test(r))).toBe(true)
  })

  it('only returns legit or fraud', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'info@company.com',
        firstName: 'Sam',
        lastName: 'Lee',
        zip: '10001',
        geoZip: '90210',
        fillDurationMs: 12_000,
        typedCount: 10,
        pasteCount: 1,
        pastedEmail: true,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fieldCount: 5,
      }),
    )
    expect(['legit', 'fraud']).toContain(assessment.label)
    expect(assessment.effectiveLabel).toBe(assessment.label)
  })
})
