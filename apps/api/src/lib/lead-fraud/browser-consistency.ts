import {
  createFinding,
  type AssessmentFinding,
} from './findings.js'

type BrowserObs = {
  v?: number
  platform?: string
  platformSupport?: string
  webdriver?: boolean | null
  webdriverSupport?: string
  automationHints?: string[]
  automationSupport?: string
  touchPoints?: number
  languages?: string[]
  timezone?: string
  clientHints?: Record<string, string>
  clientHintsSupport?: string
  apiConsistency?: Array<{ check: string; ok: boolean; support?: string }>
}

export function findingsFromBrowserObservations(input: {
  obs: unknown
  serverBrowser?: string
  serverOs?: string
  serverDevice?: string
}): AssessmentFinding[] {
  const findings: AssessmentFinding[] = []
  if (input.obs == null) {
    findings.push(
      createFinding({
        code: 'browser_signals_unavailable',
        detail: 'Browser consistency observations were not provided by the SDK',
        subject: 'visit',
        severity: 'info',
        source: 'browser_consistency',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    )
    return findings
  }
  if (typeof input.obs !== 'object' || Array.isArray(input.obs)) {
    findings.push(
      createFinding({
        code: 'browser_signals_unavailable',
        detail: 'Browser observations payload was malformed',
        subject: 'visit',
        severity: 'info',
        source: 'browser_consistency',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    )
    return findings
  }

  const obs = input.obs as BrowserObs
  const hints = Array.isArray(obs.automationHints)
    ? obs.automationHints.filter((x) => typeof x === 'string')
    : []
  if (obs.webdriver === true || hints.length > 0) {
    findings.push(
      createFinding({
        code: 'automation_indicator_observed',
        detail: `Automation indicators observed: ${[obs.webdriver ? 'webdriver' : null, ...hints].filter(Boolean).join(', ')}`,
        subject: 'visit',
        severity: 'medium',
        source: 'browser_consistency',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 6,
      }),
    )
  }

  const serverOs = (input.serverOs || '').toLowerCase()
  const platform = (obs.platform || '').toLowerCase()
  const chPlatform = (obs.clientHints?.platform || '').toLowerCase()
  if (
    platform &&
    serverOs &&
    ((platform.includes('win') && serverOs.includes('mac')) ||
      (platform.includes('mac') && serverOs.includes('win')) ||
      (chPlatform.includes('windows') && serverOs.includes('mac')) ||
      (chPlatform.includes('mac') && serverOs.includes('win')))
  ) {
    findings.push(
      createFinding({
        code: 'browser_environment_inconsistent',
        detail: `Browser-reported platform (${obs.platform || chPlatform}) conflicts with server UA OS (${input.serverOs})`,
        subject: 'visit',
        severity: 'low',
        source: 'browser_consistency',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 3,
      }),
    )
  }

  const unavailableChecks: string[] = []
  if (obs.platformSupport === 'unavailable') unavailableChecks.push('platform')
  if (obs.webdriverSupport === 'unavailable') unavailableChecks.push('webdriver')
  if (obs.automationSupport === 'unavailable') {
    unavailableChecks.push('automation')
  }
  if (obs.clientHintsSupport === 'unavailable') {
    unavailableChecks.push('clientHints')
  }
  if (Array.isArray(obs.apiConsistency)) {
    for (const check of obs.apiConsistency) {
      if (check.support === 'unavailable' || check.ok === false) {
        unavailableChecks.push(check.check)
      }
    }
  }
  if (unavailableChecks.length >= 3) {
    findings.push(
      createFinding({
        code: 'browser_signals_unavailable',
        detail: `Multiple browser checks unavailable: ${unavailableChecks.slice(0, 6).join(', ')}`,
        subject: 'visit',
        severity: 'info',
        source: 'browser_consistency',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
      }),
    )
  }

  return findings
}
