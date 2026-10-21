import { afterEach, describe, expect, it } from 'vitest'
import { hashContactValue, hashContactValueAll } from './contact-hash.js'

describe('contact hash secret migration', () => {
  const prevEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...prevEnv }
  })

  it('primary write uses current secret; lookup matches previous generation', () => {
    process.env.AROHAA_CONTACT_HASH_SECRET = 'secret-current'
    process.env.AROHAA_CONTACT_HASH_SECRET_PREVIOUS = 'secret-previous'

    const primary = hashContactValue('email', 'person@example.com')
    const all = hashContactValueAll('email', 'person@example.com')

    expect(primary).toBeTruthy()
    expect(all).toHaveLength(2)
    expect(all[0]).toBe(primary)
    expect(all[1]).not.toBe(primary)

    process.env.AROHAA_CONTACT_HASH_SECRET = 'secret-previous'
    delete process.env.AROHAA_CONTACT_HASH_SECRET_PREVIOUS
    const legacy = hashContactValue('email', 'person@example.com')

    process.env.AROHAA_CONTACT_HASH_SECRET = 'secret-current'
    process.env.AROHAA_CONTACT_HASH_SECRET_PREVIOUS = 'secret-previous'
    const lookup = hashContactValueAll('email', 'person@example.com')
    expect(lookup).toContain(legacy)
  })
})
