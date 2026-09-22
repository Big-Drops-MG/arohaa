import { describe, expect, it } from 'vitest'
import {
  ingestHostnameMatchesLanding,
  ingestRequestMatchesLanding,
  normalizeLandingPageUrl,
} from './normalizeLandingPageUrl.js'

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

describe('ingestHostnameMatchesLanding', () => {
  it('matches primary and redirect hostnames', () => {
    expect(
      ingestHostnameMatchesLanding(
        'https://Example.com/x',
        'example.com',
        null,
      ),
    ).toBe(true)
    expect(
      ingestHostnameMatchesLanding(
        'https://thanks.example.com/done',
        'offer.example.com',
        'thanks.example.com',
      ),
    ).toBe(true)
    expect(
      ingestHostnameMatchesLanding('https://evil.com/', 'example.com', null),
    ).toBe(false)
  })
})

describe('ingestRequestMatchesLanding', () => {
  const landing = {
    landingOrigin: 'https://example.com',
    landingRedirectOrigin: 'https://thanks.example.com',
    landingNormalizedUrl: 'https://example.com/offer',
  }

  it('accepts matching Origin for the registered path', () => {
    expect(
      ingestRequestMatchesLanding({
        ...landing,
        requestOrigin: 'https://example.com',
        requestReferer: 'https://example.com/offer/step-2',
      }),
    ).toBe(true)
  })

  it('rejects a sibling path on the same origin (cross-LP claim)', () => {
    expect(
      ingestRequestMatchesLanding({
        ...landing,
        requestOrigin: 'https://example.com',
        requestReferer: 'https://example.com/other-offer',
      }),
    ).toBe(false)
  })

  it('accepts redirect origin', () => {
    expect(
      ingestRequestMatchesLanding({
        ...landing,
        requestOrigin: 'https://thanks.example.com',
        requestReferer: 'https://thanks.example.com/done',
      }),
    ).toBe(true)
  })

  it('ignores eventUrl from a different origin when Origin matches', () => {
    expect(
      ingestRequestMatchesLanding({
        ...landing,
        requestOrigin: 'https://example.com',
        eventUrl: 'https://evil.com/offer',
      }),
    ).toBe(true)
  })

  it('rejects missing Origin and Referer', () => {
    expect(
      ingestRequestMatchesLanding({
        ...landing,
        eventUrl: 'https://example.com/offer',
      }),
    ).toBe(false)
  })
})
