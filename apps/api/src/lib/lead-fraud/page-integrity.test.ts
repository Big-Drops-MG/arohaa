import { describe, expect, it } from 'vitest'
import { findingsFromPageIntegrity } from './page-integrity.js'

describe('findingsFromPageIntegrity', () => {
  it('reports inaccessible context without claiming malware', () => {
    const findings = findingsFromPageIntegrity({
      props: { context_accessible: false },
      baseline: { scriptOrigins: ['https://cdn.example.com'] },
    })
    expect(findings[0]?.code).toBe('page_integrity_context_inaccessible')
    expect(findings[0]?.availability).toBe('unavailable')
  })

  it('flags unexpected script origins against baseline', () => {
    const findings = findingsFromPageIntegrity({
      props: {
        context_accessible: true,
        script_origins: ['https://evil.example'],
        form_actions: [],
        iframe_origins: [],
      },
      baseline: { scriptOrigins: ['https://cdn.arohaa.net'] },
    })
    expect(findings.some((f) => f.code === 'unexpected_script_origin')).toBe(true)
    expect(findings.every((f) => f.shadow)).toBe(true)
  })
})
