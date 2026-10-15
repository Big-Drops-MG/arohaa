import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { encryptJsonBlob } from '../field-blob.js'
import { extractRawFieldMap } from './field-signals.js'

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

describe('extractRawFieldMap', () => {
  it('reads sealed lead field blobs', () => {
    const blob = encryptJsonBlob({
      email: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      zip: '10001',
    })
    expect(
      extractRawFieldMap(JSON.stringify({ _k: blob })),
    ).toMatchObject({
      email: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      zip: '10001',
    })
  })

  it('ignores sealed FI log payloads', () => {
    const blob = encryptJsonBlob({
      v: 1,
      s: 1,
      f: 'form',
      i: [{ t: 1, k: 1, m: "pressed 'Control+v' in [email]" }],
    })
    expect(extractRawFieldMap(JSON.stringify({ _k: blob }))).toEqual({})
  })
})
