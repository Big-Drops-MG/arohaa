import { describe, expect, it } from 'vitest'
import {
  behaviorEvidenceToken,
  composeEvidenceToken,
} from './evidence-token.js'

describe('evidence tokens', () => {
  it('changes when behavior becomes known', () => {
    const contact = 'ok|abc|def|1|0|t|s|full'
    const unknown = composeEvidenceToken(contact, behaviorEvidenceToken(null))
    const known = composeEvidenceToken(
      contact,
      behaviorEvidenceToken({
        fillDurationMs: 12_000,
        typedCount: 10,
        pasteCount: 0,
        pastedEmail: false,
        pastedName: false,
        pastedPhone: false,
        hasFormStarted: true,
        hasFieldInteraction: true,
        fiBehaviorKnown: true,
      }),
    )
    expect(unknown).toContain('fi:unknown')
    expect(known).toContain('fi:known')
    expect(unknown).not.toBe(known)
  })

  it('changes when typed count changes', () => {
    const base = {
      fillDurationMs: 12_000,
      typedCount: 10,
      pasteCount: 0,
      pastedEmail: false,
      pastedName: false,
      pastedPhone: false,
      hasFormStarted: true,
      hasFieldInteraction: true,
      fiBehaviorKnown: true as const,
    }
    const a = behaviorEvidenceToken(base)
    const b = behaviorEvidenceToken({ ...base, typedCount: 11 })
    expect(a).not.toBe(b)
  })
})
