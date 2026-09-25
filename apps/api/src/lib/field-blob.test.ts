import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  decryptFieldBlob,
  decryptJsonBlob,
  encryptFieldBlob,
  encryptJsonBlob,
  sealFiPropsForStorage,
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

  it('seals interaction payloads without stripping item arrays', () => {
    const payload = {
      v: 1,
      s: 1_700_000_000_000,
      f: 'offer',
      i: [{ t: 1200, ts: 1_700_000_001_200, k: 0, m: "typed '5' in [phone]" }],
    }
    const blob = encryptJsonBlob(payload)
    expect(blob).toBeTruthy()
    const sealed = sealFiPropsForStorage({ _k: blob! })
    expect(Object.keys(sealed)).toEqual(['_k'])
    expect(decryptJsonBlob(sealed._k as string)).toEqual(payload)
  })

  it('seals plaintext interaction items server-side', () => {
    const sealed = sealFiPropsForStorage({
      i: [{ t: 0, ts: 1, k: 2, m: 'clicked on [submit]' }],
      s: 1,
    })
    expect(typeof sealed._k).toBe('string')
    expect(sealed.i).toBeUndefined()
    const decrypted = decryptJsonBlob(sealed._k as string) as {
      i: unknown[]
      s: number
    }
    expect(decrypted.s).toBe(1)
    expect(decrypted.i).toHaveLength(1)
  })
})
