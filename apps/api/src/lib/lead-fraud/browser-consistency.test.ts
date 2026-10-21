import { describe, expect, it } from 'vitest'
import { findingsFromBrowserObservations } from './browser-consistency.js'

describe('findingsFromBrowserObservations', () => {
  it('marks missing observations as unavailable coverage', () => {
    const findings = findingsFromBrowserObservations({ obs: null })
    expect(findings[0]?.code).toBe('browser_signals_unavailable')
    expect(findings[0]?.availability).toBe('unavailable')
    expect(findings[0]?.contributesToScore).toBe(false)
  })

  it('flags automation indicators in shadow mode', () => {
    const findings = findingsFromBrowserObservations({
      obs: { webdriver: true, automationHints: ['webdriver'] },
      serverOs: 'Windows',
    })
    expect(findings.some((f) => f.code === 'automation_indicator_observed')).toBe(
      true,
    )
    expect(findings.every((f) => f.shadow)).toBe(true)
  })

  it('does not treat a single touch attribute as fraud', () => {
    const findings = findingsFromBrowserObservations({
      obs: {
        touchPoints: 5,
        platform: 'iPhone',
        platformSupport: 'available',
      },
      serverOs: 'iOS',
      serverDevice: 'mobile',
    })
    expect(findings.some((f) => f.code === 'browser_environment_inconsistent')).toBe(
      false,
    )
  })
})
