import { describe, expect, it } from 'vitest'
import {
  newConflictEventId,
  serializeIntegrityFindings,
} from './event-integrity.js'
import { createFinding } from './lead-fraud/findings.js'

describe('event integrity conflict helpers', () => {
  it('creates a distinct conflict event id from the canonical id', () => {
    const canonical = '11111111-1111-4111-8111-111111111111'
    const a = newConflictEventId(canonical)
    const b = newConflictEventId(canonical)
    expect(a).not.toBe(canonical)
    expect(b).not.toBe(canonical)
    expect(a).not.toBe(b)
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('serializes findings for storage on conflict records', () => {
    const findings = [
      createFinding({
        code: 'event_id_content_conflict',
        detail: 'conflict',
        subject: 'visit',
        source: 'telemetry_integrity',
        shadow: true,
        proposedScoreDelta: 10,
      }),
    ]
    const raw = serializeIntegrityFindings(findings)
    const parsed = JSON.parse(raw) as Array<{ code: string; shadow?: boolean }>
    expect(parsed[0]?.code).toBe('event_id_content_conflict')
    expect(parsed[0]?.shadow).toBe(true)
  })
})
