import { describe, expect, it } from 'vitest'
import {
  emptyFeatures,
  looksLikeNonsenseName,
  parseFiBehavior,
} from './features.js'
import { scoreLeadFraud } from './score.js'
import {
  isCommonConsumerEmailDomain,
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
        formZipEntered: '90210',
        geoZip: '90210',
        trustedFormUrl: 'https://cert.trustedform.com/abc',
        fillDurationMs: 45_000,
        typedCount: 40,
        pasteCount: 0,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 8,
      }),
    )
    expect(assessment.label).toBe('legit')
    expect(assessment.scoreAvailable).toBe(true)
    expect(assessment.score).toBeGreaterThanOrEqual(80)
    expect(assessment.coverage).toBe('sufficient')
  })

  it('marks missing FI as session_signals_unknown without inventing interaction', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'jane.doe@gmail.com',
        firstName: 'Jane',
        lastName: 'Doe',
        formZipEntered: '90210',
        fiBehaviorKnown: false,
        velocityWindowKnown: true,
        fieldCount: 5,
      }),
    )
    expect(assessment.coverage).toBe('partial')
    expect(
      assessment.findings.some((f) => f.code === 'session_signals_unknown'),
    ).toBe(true)
    expect(assessment.scoreAvailable).toBe(true)
  })

  it('classifies paste-heavy automation via FI signals, not browser name', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: '',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'x@mailinator.com',
        firstName: 'asdf',
        lastName: 'test',
        formZipEntered: '',
        trustedFormUrl: '',
        fillDurationMs: 900,
        typedCount: 0,
        pasteCount: 4,
        pastedEmail: true,
        pastedName: true,
        hasFormStarted: false,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 1,
        fingerprintSubmits24h: 6,
      }),
    )
    expect(assessment.label).toBe('fraud')
    expect(assessment.score).not.toBeNull()
    expect(assessment.score!).toBeLessThan(50)
    expect(assessment.findings.some((f) => f.code === 'bot_user_agent')).toBe(
      false,
    )
    expect(assessment.reasons.length).toBeGreaterThan(2)
  })

  it('does not treat popular email-domain volume as suspicion', () => {
    expect(isCommonConsumerEmailDomain('gmail.com')).toBe(true)
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'jane.doe@gmail.com',
        firstName: 'Jane',
        lastName: 'Doe',
        formZipEntered: '90210',
        fillDurationMs: 20_000,
        typedCount: 20,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        emailDomainSubmits24h: 40,
        emailDomainIsCommonConsumer: true,
        fieldCount: 6,
      }),
    )
    expect(
      assessment.reasons.some((r) => /same email domain/i.test(r)),
    ).toBe(false)
  })

  it('does not flag non-ASCII letter names as nonsense', () => {
    expect(looksLikeNonsenseName('田中')).toBe(false)
    expect(looksLikeNonsenseName('José')).toBe(false)
    expect(looksLikeNonsenseName('asdf')).toBe(true)
    expect(looksLikeNonsenseName('12345')).toBe(true)
  })

  it('applies one bounded contact conflict deduction', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'jane.doe@gmail.com',
        firstName: 'Jane',
        lastName: 'Doe',
        formZipEntered: '90210',
        fillDurationMs: 20_000,
        typedCount: 20,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 6,
        contactMatchStatus: 'ok',
        samePhoneDifferentNames: true,
        samePhoneDifferentEmails: true,
        contactLocationChanged: true,
        contactRepeatedAcrossPages: true,
      }),
    )
    const contactReasons = assessment.reasons.filter((r) =>
      /Correlated identity conflicts/i.test(r),
    )
    expect(contactReasons).toHaveLength(1)
    expect(
      assessment.findings.some((f) => f.code === 'contact_repeated_across_pages'),
    ).toBe(true)
  })

  it('flags invalid email format as elevated risk', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'not-an-email',
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
      }),
    )
    expect(assessment.label).toBe('fraud')
    expect(assessment.reasons.some((r) => /Invalid email/i.test(r))).toBe(true)
  })

  it('treats missing entered ZIP as location comparison unavailable, not mismatch', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'info@company.com',
        firstName: 'Sam',
        lastName: 'Lee',
        formZipEntered: '',
        zip: '',
        geoZip: '90210',
        geoCountryCode: 'US',
        geoState: 'CA',
        locationComparison: 'unavailable',
        locationComparisonDetail: 'Entered ZIP missing',
        fillDurationMs: 12_000,
        typedCount: 10,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 5,
      }),
    )
    expect(
      assessment.findings.some((f) => f.code === 'location_inconsistency'),
    ).toBe(false)
    expect(
      assessment.findings.some((f) => f.code === 'location_comparison_unavailable'),
    ).toBe(true)
  })

  it('marks coverage partial and emits finding when matching is truncated', () => {
    const assessment = scoreLeadFraud(
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
        contactMatchStatus: 'ok',
        contactMatchTruncated: true,
      }),
    )
    expect(assessment.coverage).toBe('partial')
    expect(
      assessment.findings.some((f) => f.code === 'matching_truncated'),
    ).toBe(true)
  })

  it('does not treat location consistent as cancelling other risk', () => {
    const assessment = scoreLeadFraud(
      emptyFeatures({
        fingerprint: '',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'x@mailinator.com',
        firstName: 'asdf',
        lastName: 'test',
        formZipEntered: '90210',
        locationComparison: 'consistent',
        locationComparisonDetail: 'State agrees',
        networkClass: 'no_known_match',
        fillDurationMs: 500,
        typedCount: 0,
        pasteCount: 0,
        hasFormStarted: false,
        hasFieldInteraction: false,
        fiBehaviorKnown: true,
        velocityWindowKnown: true,
        fieldCount: 1,
      }),
    )
    expect(assessment.label).toBe('fraud')
    expect(
      assessment.findings.some((f) => f.code === 'location_consistent'),
    ).toBe(true)
  })
})
