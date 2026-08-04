import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  compositeLighthouseScore,
  rateWebVital,
  scoreWebVital,
} from './web-vitals-score.js'

describe('web-vitals-score', () => {
  it('rates LCP thresholds', () => {
    assert.equal(rateWebVital('LCP', 2000), 'good')
    assert.equal(rateWebVital('LCP', 3000), 'needs-improvement')
    assert.equal(rateWebVital('LCP', 5000), 'poor')
  })

  it('rates FCP thresholds', () => {
    assert.equal(rateWebVital('FCP', 1200), 'good')
    assert.equal(rateWebVital('FCP', 2200), 'needs-improvement')
    assert.equal(rateWebVital('FCP', 3500), 'poor')
  })

  it('scores good metrics near 90–100', () => {
    assert.ok(scoreWebVital('LCP', 2000) >= 90)
    assert.ok(scoreWebVital('FCP', 1200) >= 90)
    assert.ok(scoreWebVital('CLS', 0.05) >= 90)
    assert.ok(scoreWebVital('INP', 150) >= 90)
  })

  it('composites lighthouse score from available vitals', () => {
    const score = compositeLighthouseScore({
      FCP: 1200,
      LCP: 2000,
      CLS: 0.05,
      INP: 150,
    })
    assert.ok(score != null && score >= 90)
  })

  it('returns null when no vitals present', () => {
    assert.equal(compositeLighthouseScore({}), null)
  })
})
