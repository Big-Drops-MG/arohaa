import { describe, expect, it } from 'vitest'
import {
  hashPushEndpoint,
  signWebPushBody,
  verifyWebPushSignature,
} from '@workspace/database'

describe('web push signature auth', () => {
  it('accepts sha256=hmac signatures only when body matches', () => {
    const secret = 'wp_test_secret'
    const rawBody = '{"action":"subscribe"}'
    const hex = signWebPushBody(secret, rawBody)
    expect(
      verifyWebPushSignature({
        secret,
        rawBody,
        signatureHeader: `sha256=${hex}`,
      }),
    ).toBe(true)
    expect(
      verifyWebPushSignature({
        secret,
        rawBody,
        signatureHeader: `sha256=${hex.slice(0, -2)}aa`,
      }),
    ).toBe(false)
    expect(
      verifyWebPushSignature({
        secret,
        rawBody,
        signatureHeader: '',
      }),
    ).toBe(false)
  })

  it('hashes endpoints to a stable truncated digest', () => {
    const a = hashPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')
    const b = hashPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')
    const c = hashPushEndpoint('https://fcm.googleapis.com/fcm/send/xyz')
    expect(a).toBe(b)
    expect(a).toHaveLength(32)
    expect(a).not.toBe(c)
  })
})
