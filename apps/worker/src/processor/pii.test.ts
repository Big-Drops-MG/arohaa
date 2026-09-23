import { describe, expect, it } from 'vitest'
// @ts-expect-error worker runtime is plain JS without type declarations
import { anonymizeEvent, anonymizeHeatmapEvent, hashEmail } from './pii.js'

describe('anonymizeEvent', () => {
  it('hashes emails in ordinary properties', () => {
    const event = anonymizeEvent({
      properties: JSON.stringify({ email: 'Lead@Example.com' }),
    })
    expect(JSON.parse(event.properties).email).toBe(
      hashEmail('lead@example.com'),
    )
  })

  it('seals plaintext lead fields into _k when a blob key is available', () => {
    process.env.AROHAA_INTERNAL_API_SECRET = 'test-secret-for-pii'
    const fields = {
      email: 'Lead@Example.com',
      first_name: 'David',
      dob: '03/09/1990',
    }
    const event = anonymizeEvent({
      properties: JSON.stringify({ fields, step: 1 }),
    })
    const props = JSON.parse(event.properties)
    expect(props.fields).toBeUndefined()
    expect(typeof props._k).toBe('string')
    expect(props._k.length).toBeGreaterThan(20)
    expect(props.step).toBe(1)
    delete process.env.AROHAA_INTERNAL_API_SECRET
  })

  it('hashes all plaintext lead field values when no blob key is available', () => {
    delete process.env.AROHAA_FIELD_BLOB_KEY
    delete process.env.AROHAA_INTERNAL_API_SECRET
    const fields = {
      email: 'Lead@Example.com',
      first_name: 'David',
      address: '123 Main St',
      zip: '78701',
      phone_number: '5125551212',
    }
    const event = anonymizeEvent({
      properties: JSON.stringify({ fields }),
    })
    const props = JSON.parse(event.properties)
    expect(props.fields.email).toBe(hashEmail('lead@example.com'))
    expect(props.fields.first_name).toBe(hashEmail('David'))
    expect(props.fields.address).toBe(hashEmail('123 Main St'))
    expect(props.fields.zip).toBe(hashEmail('78701'))
    expect(props.fields.phone_number).toBe(hashEmail('5125551212'))
  })

  it('still hashes user_id', () => {
    const event = anonymizeEvent({ user_id: 'lead@example.com' })
    expect(event.user_id).toBe(hashEmail('lead@example.com'))
  })
})

describe('anonymizeHeatmapEvent', () => {
  it('strips query and hash from url', () => {
    const event = anonymizeHeatmapEvent({
      url: 'https://example.com/path?email=a@b.com&token=secret#frag',
      user_id: 'lead@example.com',
    })
    expect(event.url).toBe('https://example.com/path')
    expect(event.user_id).toBe(hashEmail('lead@example.com'))
  })
})
