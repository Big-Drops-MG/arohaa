import { describe, expect, it } from 'vitest'
import { sanitizeEventUrl } from '../types/event.js'

describe('sanitizeEventUrl', () => {
  it('strips query strings and keeps origin path hash', () => {
    expect(
      sanitizeEventUrl(
        'https://example.com/offer/step?token=abc&email=a@b.com#/details',
      ),
    ).toBe('https://example.com/offer/step#/details')
  })

  it('handles invalid URLs by cutting at ?', () => {
    expect(sanitizeEventUrl('not a url?secret=1')).toBe('not a url')
  })
})
