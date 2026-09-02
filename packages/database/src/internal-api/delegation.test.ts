import { describe, expect, it } from 'vitest'
import {
  buildInternalUserDelegationPayload,
  delegationPayloadCanonical,
  signInternalUserDelegation,
  verifyInternalUserDelegation,
} from './delegation.js'

describe('internal user delegation', () => {
  const secret = 'test-secret'

  it('signs and verifies a canonical v1 payload', () => {
    const payload = buildInternalUserDelegationPayload({
      userId: 'user-1',
      landingPageId: 'lp-1',
      nonce: 'nonce-1',
      nowMs: 1_700_000_000_000,
    })
    expect(delegationPayloadCanonical(payload)).toBe(
      'v1|user-1|lp-1|funnel-leads|1700000120|nonce-1',
    )
    const sig = signInternalUserDelegation(secret, payload)
    expect(
      verifyInternalUserDelegation(secret, payload, sig, 1_700_000_000_000),
    ).toBe(true)
  })

  it('rejects expired delegations', () => {
    const payload = buildInternalUserDelegationPayload({
      userId: 'user-1',
      landingPageId: 'lp-1',
      nonce: 'nonce-1',
      nowMs: 1_700_000_000_000,
    })
    const sig = signInternalUserDelegation(secret, payload)
    expect(
      verifyInternalUserDelegation(secret, payload, sig, payload.exp * 1000 + 1),
    ).toBe(false)
  })

  it('rejects tampered signatures', () => {
    const payload = buildInternalUserDelegationPayload({
      userId: 'user-1',
      landingPageId: 'lp-1',
      nonce: 'nonce-1',
      nowMs: 1_700_000_000_000,
    })
    const sig = signInternalUserDelegation(secret, payload)
    expect(verifyInternalUserDelegation(secret, payload, `${sig}x`, 1_700_000_000_000)).toBe(
      false,
    )
  })

  it('rejects a different nonce with the same other fields', () => {
    const payload = buildInternalUserDelegationPayload({
      userId: 'user-1',
      landingPageId: 'lp-1',
      nonce: 'nonce-1',
      nowMs: 1_700_000_000_000,
    })
    const sig = signInternalUserDelegation(secret, payload)
    expect(
      verifyInternalUserDelegation(
        secret,
        { ...payload, nonce: 'nonce-2' },
        sig,
        1_700_000_000_000,
      ),
    ).toBe(false)
  })
})
