import { describe, expect, it } from 'vitest'
import {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
  type LeadSessionSignalRow,
} from './field-signals.js'
import { scoreLeadFraud } from './score.js'
import type { FiBehaviorSummary } from './fi-batch.js'

function signal(
  partial: Partial<LeadSessionSignalRow> &
    Pick<LeadSessionSignalRow, 'workspaceId' | 'sessionId'>,
): LeadSessionSignalRow {
  return {
    fingerprint: 'fp-1',
    browser: 'Chrome',
    geoZip: '10001',
    geoState: 'NY',
    geoCountry: 'United States',
    geoCountryCode: 'US',
    geoCity: 'New York',
    clientIpHash: 'ip-1',
    formSubmitted: true,
    props: JSON.stringify({
      _k: undefined,
      email: 'person@gmail.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      zip: '10001',
      state: 'NY',
    }),
    zipVal: '10001',
    submittedAtMs: Date.now(),
    ...partial,
  }
}

const measuredFi: FiBehaviorSummary = {
  fillDurationMs: 40_000,
  typedCount: 20,
  pasteCount: 0,
  pastedEmail: false,
  pastedName: false,
  pastedPhone: false,
  hasFormStarted: true,
  hasFieldInteraction: true,
  fiBehaviorKnown: true,
}

describe('field-signal scoring (warehouse = data leads)', () => {
  it('scores the same features for identical session signals', () => {
    const rows = [
      signal({ workspaceId: 'ws-a', sessionId: 's1' }),
      signal({
        workspaceId: 'ws-a',
        sessionId: 's2',
        props: JSON.stringify({
          email: 'bot@mailinator.com',
          first_name: 'asdf',
          last_name: 'qwer',
          zip: '00000',
        }),
        zipVal: '00000',
        geoZip: '10001',
      }),
    ]
    const velocity = computeLeadVelocityMaps(rows)
    const a = scoreLeadFraud(
      buildFeaturesFromLeadSessionSignal(rows[0]!, velocity, measuredFi),
    )
    const b = scoreLeadFraud(
      buildFeaturesFromLeadSessionSignal(rows[1]!, velocity, measuredFi),
    )
    expect(a.label).toBe('legit')
    expect(b.label).toBe('fraud')
    expect(a.score).toBeGreaterThanOrEqual(50)
    expect(b.score).not.toBeNull()
    expect(b.score!).toBeLessThan(50)
  })

  it('scopes velocity by workspace within a real time window', () => {
    const now = Date.now()
    const rows = [
      signal({
        workspaceId: 'ws-a',
        sessionId: 'a1',
        fingerprint: 'shared',
        submittedAtMs: now,
      }),
      signal({
        workspaceId: 'ws-a',
        sessionId: 'a2',
        fingerprint: 'shared',
        submittedAtMs: now - 60_000,
      }),
      signal({
        workspaceId: 'ws-b',
        sessionId: 'b1',
        fingerprint: 'shared',
        submittedAtMs: now,
      }),
    ]
    const velocity = computeLeadVelocityMaps(rows)
    const featuresA = buildFeaturesFromLeadSessionSignal(
      rows[0]!,
      velocity,
      measuredFi,
    )
    const featuresB = buildFeaturesFromLeadSessionSignal(
      rows[2]!,
      velocity,
      measuredFi,
    )
    expect(featuresA.fingerprintSessionsSameDay).toBe(2)
    expect(featuresB.fingerprintSessionsSameDay).toBe(1)
    expect(featuresA.velocityWindowKnown).toBe(true)
  })

  it('does not invent interaction when FI is absent', () => {
    const row = signal({ workspaceId: 'ws-a', sessionId: 's1' })
    const velocity = computeLeadVelocityMaps([row])
    const features = buildFeaturesFromLeadSessionSignal(row, velocity, null)
    expect(features.fiBehaviorKnown).toBe(false)
    expect(features.typedCount).toBe(0)
    expect(features.hasFieldInteraction).toBe(false)
  })
})
