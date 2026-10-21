import { afterEach, describe, expect, it } from 'vitest'
import {
  issueSessionToken,
  resolveSessionTokenSecret,
  verifySessionToken,
} from './session-token.js'

const prevSecret = process.env.SESSION_TOKEN_SECRET
const prevInternal = process.env.AROHAA_INTERNAL_API_SECRET
const prevNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (prevSecret === undefined) delete process.env.SESSION_TOKEN_SECRET
  else process.env.SESSION_TOKEN_SECRET = prevSecret
  if (prevInternal === undefined) delete process.env.AROHAA_INTERNAL_API_SECRET
  else process.env.AROHAA_INTERNAL_API_SECRET = prevInternal
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevNodeEnv
})

describe('session token', () => {
  it('derives a production secret from the internal API secret when none is dedicated', () => {
    delete process.env.SESSION_TOKEN_SECRET
    process.env.AROHAA_INTERNAL_API_SECRET = 'internal-secret-for-tests'
    process.env.NODE_ENV = 'production'
    const resolved = resolveSessionTokenSecret()
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.secret).not.toBe('internal-secret-for-tests')
    const issued = issueSessionToken({
      wid: '11111111-1111-4111-8111-111111111111',
      sid: 'session-abcdefgh',
      uid: 'user-abcdefgh',
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    expect(
      verifySessionToken(issued.token, {
        wid: '11111111-1111-4111-8111-111111111111',
        sid: 'session-abcdefgh',
      }).status,
    ).toBe('ok')
  })

  it('issues and verifies a bound token when secret is configured', () => {
    process.env.SESSION_TOKEN_SECRET = 'test-session-token-secret'
    const issued = issueSessionToken({
      wid: '11111111-1111-4111-8111-111111111111',
      lpId: 'lp_abcdefgh',
      sid: 'session-abcdefgh',
      uid: 'user-abcdefgh',
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const check = verifySessionToken(issued.token, {
      wid: '11111111-1111-4111-8111-111111111111',
      lpId: 'lp_abcdefgh',
      sid: 'session-abcdefgh',
    })
    expect(check.status).toBe('ok')
  })

  it('detects sid mismatch without blocking callers', () => {
    process.env.SESSION_TOKEN_SECRET = 'test-session-token-secret'
    const issued = issueSessionToken({
      wid: '11111111-1111-4111-8111-111111111111',
      sid: 'session-abcdefgh',
      uid: 'user-abcdefgh',
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const check = verifySessionToken(issued.token, {
      wid: '11111111-1111-4111-8111-111111111111',
      sid: 'session-otherxxxxx',
    })
    expect(check.status).toBe('mismatch')
    if (check.status === 'mismatch') {
      expect(check.field).toBe('sid')
    }
  })

  it('reports unavailable in production when secret is missing', () => {
    delete process.env.SESSION_TOKEN_SECRET
    delete process.env.FIELD_BLOB_KEY
    delete process.env.CONTACT_HASH_SECRET
    delete process.env.AROHAA_INTERNAL_API_SECRET
    process.env.NODE_ENV = 'production'
    expect(resolveSessionTokenSecret().ok).toBe(false)
    expect(
      issueSessionToken({
        wid: '11111111-1111-4111-8111-111111111111',
        sid: 'session-abcdefgh',
        uid: 'user-abcdefgh',
      }).ok,
    ).toBe(false)
    expect(
      verifySessionToken('anything', {
        wid: '11111111-1111-4111-8111-111111111111',
        sid: 'session-abcdefgh',
      }).status,
    ).toBe('unavailable')
  })
})
