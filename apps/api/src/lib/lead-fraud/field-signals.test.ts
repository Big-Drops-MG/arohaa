import { describe, expect, it } from 'vitest'
import {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
  type LeadSessionSignalRow,
} from './field-signals.js'
import { scoreLeadFraud } from './score.js'

function signal(
  partial: Partial<LeadSessionSignalRow> &
    Pick<LeadSessionSignalRow, 'workspaceId' | 'sessionId'>,
): LeadSessionSignalRow {
  return {
    fingerprint: 'fp-1',
    browser: 'Chrome',
    geoZip: '10001',
    geoState: 'NY',
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
    ...partial,
  }
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
      buildFeaturesFromLeadSessionSignal(rows[0]!, velocity),
    )
    const b = scoreLeadFraud(
      buildFeaturesFromLeadSessionSignal(rows[1]!, velocity),
    )
    expect(a.label).toBe('legit')
    expect(b.label).toBe('fraud')
    expect(a.score).toBeGreaterThanOrEqual(50)
    expect(b.score).toBeLessThan(50)
  })

  it('scopes velocity by workspace', () => {
    const rows = [
      signal({ workspaceId: 'ws-a', sessionId: 'a1', fingerprint: 'shared' }),
      signal({ workspaceId: 'ws-a', sessionId: 'a2', fingerprint: 'shared' }),
      signal({ workspaceId: 'ws-b', sessionId: 'b1', fingerprint: 'shared' }),
    ]
    const velocity = computeLeadVelocityMaps(rows)
    const featuresA = buildFeaturesFromLeadSessionSignal(rows[0]!, velocity)
    const featuresB = buildFeaturesFromLeadSessionSignal(rows[2]!, velocity)
    expect(featuresA.fingerprintSessionsSameDay).toBe(2)
    expect(featuresB.fingerprintSessionsSameDay).toBe(1)
  })
})
