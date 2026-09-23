import { describe, expect, it } from 'vitest'
import { computePeriodChangePct } from './funnel-trend.js'

describe('computePeriodChangePct', () => {
  it('returns null when both periods are zero', () => {
    expect(computePeriodChangePct(0, 0)).toBeNull()
  })

  it('treats growth from zero as +100%', () => {
    expect(computePeriodChangePct(10, 0)).toBe(100)
  })

  it('computes percent change vs prior period', () => {
    expect(computePeriodChangePct(150, 100)).toBe(50)
    expect(computePeriodChangePct(50, 100)).toBe(-50)
  })
})
