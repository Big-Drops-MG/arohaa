import { describe, expect, it } from 'vitest'
import { hasBrowserOriginOrReferer } from './browser-origin.js'

describe('hasBrowserOriginOrReferer', () => {
  it('requires Origin or Referer', () => {
    expect(hasBrowserOriginOrReferer({})).toBe(false)
    expect(hasBrowserOriginOrReferer({ origin: 'https://a.test' })).toBe(true)
    expect(
      hasBrowserOriginOrReferer({ referer: 'https://a.test/page' }),
    ).toBe(true)
    expect(
      hasBrowserOriginOrReferer({ referrer: 'https://a.test/page' }),
    ).toBe(true)
  })
})
