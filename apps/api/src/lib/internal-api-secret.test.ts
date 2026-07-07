import { afterEach, describe, expect, it } from 'vitest'
import {
  DEV_INTERNAL_API_SECRET,
  resolveInternalApiSecret,
  verifyInternalApiRequest,
} from './internal-api-secret.js'

describe('internal api secret', () => {
  const original = process.env.AROHAA_INTERNAL_API_SECRET
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AROHAA_INTERNAL_API_SECRET
    } else {
      process.env.AROHAA_INTERNAL_API_SECRET = original
    }
    process.env.NODE_ENV = originalNodeEnv
  })

  it('uses configured secret in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.AROHAA_INTERNAL_API_SECRET = 'prod-secret'
    expect(resolveInternalApiSecret()).toBe('prod-secret')
    expect(verifyInternalApiRequest('prod-secret')).toBe(true)
    expect(verifyInternalApiRequest('wrong')).toBe(false)
  })

  it('falls back to dev secret in development', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.AROHAA_INTERNAL_API_SECRET
    expect(resolveInternalApiSecret()).toBe(DEV_INTERNAL_API_SECRET)
  })
})
