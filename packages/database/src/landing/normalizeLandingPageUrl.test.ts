import { describe, expect, it } from 'vitest'
import { normalizeLandingPageUrl } from './normalizeLandingPageUrl.js'

describe('normalizeLandingPageUrl', () => {
  it('normalizes https URLs and strips query/hash', () => {
    const result = normalizeLandingPageUrl(
      'https://Example.COM/path/?utm=1#section',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.normalizedUrl).toBe('https://example.com/path')
    expect(result.origin).toBe('https://example.com')
    expect(result.hostname).toBe('example.com')
  })

  it('rejects empty input', () => {
    const result = normalizeLandingPageUrl('   ')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/required/i)
  })

  it('rejects non-http protocols', () => {
    const result = normalizeLandingPageUrl('ftp://example.com')
    expect(result.ok).toBe(false)
  })
})
