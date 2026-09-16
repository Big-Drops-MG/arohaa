import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  decryptFieldBlob,
  encryptFieldBlob,
  sealPropsForStorage,
  materializeOpaqueProps,
} from './field-blob.js'

describe('field-blob sealPropsForStorage', () => {
  const prevKey = process.env.AROHAA_FIELD_BLOB_KEY
  const prevSecret = process.env.AROHAA_INTERNAL_API_SECRET

  beforeEach(() => {
    process.env.AROHAA_FIELD_BLOB_KEY = Buffer.alloc(32, 7).toString('base64')
    delete process.env.AROHAA_INTERNAL_API_SECRET
  })

  afterEach(() => {
    if (prevKey === undefined) delete process.env.AROHAA_FIELD_BLOB_KEY
    else process.env.AROHAA_FIELD_BLOB_KEY = prevKey
    if (prevSecret === undefined) delete process.env.AROHAA_INTERNAL_API_SECRET
    else process.env.AROHAA_INTERNAL_API_SECRET = prevSecret
  })

  it('stores lead fields only as encrypted _k', () => {
    const sealed = sealPropsForStorage({
      fields: { email: 'a@b.com', phone: '5551234567', city: 'Austin' },
      stepIndex: 2,
      lead_complete: true,
    })
    expect(sealed.fields).toBeUndefined()
    expect(typeof sealed._k).toBe('string')
    expect(sealed.stepIndex).toBe(2)
    expect(sealed.lead_complete).toBe(true)
    expect(sealed.phone).toBeUndefined()

    const roundTrip = materializeOpaqueProps(sealed)
    expect(roundTrip.fields).toEqual({ email: 'a@b.com', city: 'Austin' })
  })

  it('keeps an existing _k blob encrypted at rest', () => {
    const blob = encryptFieldBlob({ email: 'x@y.com', zip: '90210' })
    expect(blob).toBeTruthy()
    const sealed = sealPropsForStorage({ _k: blob!, step: 1 })
    expect(sealed.fields).toBeUndefined()
    expect(typeof sealed._k).toBe('string')
    const decrypted = decryptFieldBlob(sealed._k as string)
    expect(decrypted).toMatchObject({ email: 'x@y.com', zip: '90210' })
  })
})
