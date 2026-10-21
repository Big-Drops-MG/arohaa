import { describe, expect, it } from 'vitest'
import { createFinding } from './findings.js'
import { shadowEvidenceToken } from './evidence-token.js'

describe('shadowEvidenceToken stability', () => {
  it('ignores reconstructed wall-clock observedAt differences', () => {
    const a = [
      createFinding({
        code: 'automation_indicator_observed',
        detail: 'webdriver',
        subject: 'visit',
        source: 'browser_consistency',
        shadow: true,
        proposedScoreDelta: 6,
        observedAt: '2026-01-01T00:00:00.000Z',
        evidenceRefs: ['evt-1'],
      }),
    ]
    const b = [
      createFinding({
        code: 'automation_indicator_observed',
        detail: 'webdriver',
        subject: 'visit',
        source: 'browser_consistency',
        shadow: true,
        proposedScoreDelta: 6,
        observedAt: '2026-01-02T00:00:00.000Z',
        evidenceRefs: ['evt-1'],
      }),
    ]
    expect(shadowEvidenceToken(a, 'browser:evt-1')).toBe(
      shadowEvidenceToken(b, 'browser:evt-1'),
    )
  })

  it('changes when evidence refs or baseline version change', () => {
    const base = createFinding({
      code: 'unexpected_script_origin',
      detail: 'x',
      subject: 'visit',
      source: 'page_integrity',
      shadow: true,
      proposedScoreDelta: 4,
      evidenceRefs: ['evt-1', 'baseline:v1'],
      featureVersion: 'baseline:v1',
      observedAt: 'evt-1',
    })
    const next = {
      ...base,
      evidenceRefs: ['evt-1', 'baseline:v2'],
      featureVersion: 'baseline:v2',
    }
    expect(shadowEvidenceToken([base], 'k')).not.toBe(
      shadowEvidenceToken([next], 'k'),
    )
  })
})
