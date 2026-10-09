import { describe, expect, it } from 'vitest'
import { emptyFeatures } from './features.js'
import { scoreLeadFraud } from './score.js'

describe('warehouse bulk classification', () => {
  it('classifies clean gmail lead as legit and disposable as fraud', () => {
    const legit = scoreLeadFraud(
      emptyFeatures({
        fingerprint: 'fp-1',
        browser: 'Chrome',
        formSubmitted: true,
        email: 'jane.doe@gmail.com',
        firstName: 'Jane',
        lastName: 'Doe',
        zip: '90210',
        hasFormStarted: true,
        hasFieldInteraction: true,
        typedCount: 12,
        fillDurationMs: 45_000,
        fieldCount: 5,
      }),
    )
    const fraud = scoreLeadFraud(
      emptyFeatures({
        fingerprint: '',
        browser: 'bot crawler',
        formSubmitted: true,
        email: 'x@mailinator.com',
        firstName: 'asdf',
        lastName: 'qwer',
        hasFormStarted: false,
        hasFieldInteraction: false,
        typedCount: 0,
        fillDurationMs: 500,
        fieldCount: 1,
      }),
    )

    expect(legit.label).toBe('legit')
    expect(fraud.label).toBe('fraud')
    expect(legit.score).toBeGreaterThanOrEqual(50)
    expect(fraud.score).toBeLessThan(50)
  })
})
