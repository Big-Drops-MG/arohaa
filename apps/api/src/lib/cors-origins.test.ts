import { describe, expect, it } from 'vitest'
import {
  isCorsOriginAllowed,
  resolveCorsOriginDecision,
} from './cors-origins.js'

describe('cors origin allow checks', () => {
  it('denies missing origin', () => {
    expect(isCorsOriginAllowed(undefined, new Set(['https://a.test']))).toBe(
      false,
    )
  })

  it('denies empty allowlist', () => {
    expect(isCorsOriginAllowed('https://a.test', new Set())).toBe(false)
  })

  it('allows exact origin match only', () => {
    const allowed = new Set(['https://a.test'])
    expect(isCorsOriginAllowed('https://a.test', allowed)).toBe(true)
    expect(isCorsOriginAllowed('https://evil.test', allowed)).toBe(false)
  })

  it('resolveCorsOriginDecision denies missing origin without DB work', async () => {
    await expect(resolveCorsOriginDecision(undefined)).resolves.toBe(false)
  })
})
