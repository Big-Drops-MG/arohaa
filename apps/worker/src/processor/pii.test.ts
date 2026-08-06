import { describe, expect, it } from 'vitest'
// @ts-expect-error worker runtime is plain JS without type declarations
import { anonymizeEvent, hashEmail } from './pii.js'

describe('anonymizeEvent', () => {
  it('hashes emails in ordinary properties', () => {
    const event = anonymizeEvent({
      properties: JSON.stringify({ email: 'Lead@Example.com' }),
    })
    expect(JSON.parse(event.properties).email).toBe(
      hashEmail('lead@example.com'),
    )
  })

  it('leaves captured lead fields untouched', () => {
    const fields = {
      email: 'Lead@Example.com',
      first_name: 'David',
      dob: '03/09/1990',
    }
    const event = anonymizeEvent({
      properties: JSON.stringify({ fields }),
    })
    expect(JSON.parse(event.properties).fields).toEqual(fields)
  })

  it('still hashes user_id', () => {
    const event = anonymizeEvent({ user_id: 'lead@example.com' })
    expect(event.user_id).toBe(hashEmail('lead@example.com'))
  })
})
