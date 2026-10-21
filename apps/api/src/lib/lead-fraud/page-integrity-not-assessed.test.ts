import { describe, expect, it } from 'vitest'
import { createFinding } from './findings.js'
import { findingsFromPageIntegrity } from './page-integrity.js'

describe('page integrity assessment status', () => {
  it('does not invent findings without a baseline (caller marks not assessed)', () => {
    const findings = findingsFromPageIntegrity({
      props: {
        context_accessible: true,
        script_origins: ['https://cdn.example.com'],
        form_actions: ['https://example.com/form'],
        iframe_origins: [],
      },
      baseline: null,
    })
    expect(findings).toEqual([])
  })

  it('uses explicit not_assessed finding when baseline is missing', () => {
    const finding = createFinding({
      code: 'page_integrity_not_assessed',
      detail: 'Page integrity not assessed: no_approved_baseline',
      subject: 'visit',
      source: 'page_integrity',
      availability: 'unavailable',
      contributesToScore: false,
      shadow: true,
    })
    expect(finding.availability).toBe('unavailable')
    expect(finding.contributesToScore).toBe(false)
  })
})
