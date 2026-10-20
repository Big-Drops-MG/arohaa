import { describe, expect, it } from 'vitest'
import { normalizeEmail, normalizePhone } from './contact-normalize.js'

describe('contact normalize', () => {
  it('lowercases email without stripping plus tags', () => {
    const email = normalizeEmail('  Ada.Lovelace+promo@Example.COM ')
    expect(email.normalized).toBe('ada.lovelace+promo@example.com')
  })

  it('classifies missing and valid phones', () => {
    expect(normalizePhone('').validity).toBe('missing')
    const us = normalizePhone('(415) 555-2671', 'US')
    expect(us.validity).toBe('structurally_valid')
    expect(us.e164).toMatch(/^\+1/)
  })
})
