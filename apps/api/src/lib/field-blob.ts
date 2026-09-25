import { createHash, createDecipheriv, createCipheriv, randomBytes } from 'node:crypto'

/** Boring prop key on the wire — not labeled as PII. */
export const OPAQUE_PROP_KEY = '_k'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function resolveRawKey(): Buffer | null {
  const fromEnv = process.env.AROHAA_FIELD_BLOB_KEY?.trim()
  if (fromEnv) {
    try {
      const buf = Buffer.from(fromEnv, 'base64')
      if (buf.length === 32) return buf
    } catch {
      /* fall through */
    }
    return createHash('sha256').update(fromEnv).digest()
  }
  const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()
  if (!secret) return null
  return createHash('sha256').update(`arohaa-field-blob:${secret}`).digest()
}

/** Base64 key material for SDK (always 32 bytes encoded). */
export function resolveFieldBlobKeyB64(): string | null {
  const key = resolveRawKey()
  return key ? key.toString('base64') : null
}

function encryptRaw(plaintext: Buffer): string | null {
  const key = resolveRawKey()
  if (!key) return null
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, enc, tag]).toString('base64')
}

function decryptRaw(blob: string): Buffer | null {
  const key = resolveRawKey()
  if (!key || !blob) return null
  try {
    const raw = Buffer.from(blob, 'base64')
    if (raw.length < IV_LEN + TAG_LEN + 1) return null
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(raw.length - TAG_LEN)
    const data = raw.subarray(IV_LEN, raw.length - TAG_LEN)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()])
  } catch {
    return null
  }
}

export function encryptFieldBlob(
  fields: Record<string, string>,
): string | null {
  return encryptRaw(Buffer.from(JSON.stringify(fields), 'utf8'))
}

export function decryptFieldBlob(
  blob: string,
): Record<string, string> | null {
  const dec = decryptRaw(blob)
  if (!dec) return null
  try {
    const parsed = JSON.parse(dec.toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = String(v)
      }
    }
    return out
  } catch {
    return null
  }
}

export function encryptJsonBlob(value: unknown): string | null {
  try {
    return encryptRaw(Buffer.from(JSON.stringify(value), 'utf8'))
  } catch {
    return null
  }
}

export function decryptJsonBlob(blob: string): unknown | null {
  const dec = decryptRaw(blob)
  if (!dec) return null
  try {
    return JSON.parse(dec.toString('utf8')) as unknown
  } catch {
    return null
  }
}

export const FI_EVENT_NAME = '_fi'


export function sealFiPropsForStorage(
  props: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(props ?? {}) }
  const existingBlob =
    typeof next[OPAQUE_PROP_KEY] === 'string'
      ? (next[OPAQUE_PROP_KEY] as string)
      : ''

  const plaintextPayload =
    next.i !== undefined || next.items !== undefined
      ? {
          v: typeof next.v === 'number' ? next.v : 1,
          s: typeof next.s === 'number' ? next.s : undefined,
          f: typeof next.f === 'string' ? next.f : undefined,
          i: Array.isArray(next.i)
            ? next.i
            : Array.isArray(next.items)
              ? next.items
              : undefined,
        }
      : null

  for (const key of Object.keys(next)) {
    delete next[key]
  }

  if (existingBlob) {
    const verified = decryptJsonBlob(existingBlob)
    if (verified !== null) {
      next[OPAQUE_PROP_KEY] = existingBlob
      return next
    }
  }

  if (plaintextPayload && plaintextPayload.i) {
    const sealed = encryptJsonBlob(plaintextPayload)
    if (sealed) next[OPAQUE_PROP_KEY] = sealed
  }

  return next
}

const PHONE_KEY_RE =
  /^(phone|mobile|tel|cell|telephone|phone_number|phonenumber|mobile_number)$/i

export function isPhoneFieldKey(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  if (PHONE_KEY_RE.test(n)) return true
  if (/phone|mobile|^tel$/i.test(n) && !/telephone_consent|phone_type/i.test(n)) {
    return /phone|mobile|tel|cell/i.test(n)
  }
  return false
}

export function stripPhoneFields(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (isPhoneFieldKey(k)) continue
    out[k] = v
  }
  return out
}

function coerceFieldMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'fields' || k === OPAQUE_PROP_KEY) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v)
    }
  }
  return out
}

export function materializeOpaqueProps(
  props: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(props ?? {}) }
  const blob = next[OPAQUE_PROP_KEY]
  delete next[OPAQUE_PROP_KEY]
  if (typeof blob === 'string' && blob.length > 0) {
    const fields = decryptFieldBlob(blob)
    if (fields) {
      next.fields = stripPhoneFields(fields)
    }
  }
  for (const key of Object.keys(next)) {
    if (key === 'fields') continue
    if (isPhoneFieldKey(key)) {
      delete next[key]
    }
  }
  return next
}


export function sealPropsForStorage(
  props: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(props ?? {}) }
  const existingBlob =
    typeof next[OPAQUE_PROP_KEY] === 'string'
      ? (next[OPAQUE_PROP_KEY] as string)
      : ''
  const fromBlob = existingBlob ? decryptFieldBlob(existingBlob) : null
  const fromFields = coerceFieldMap(next.fields)

  delete next[OPAQUE_PROP_KEY]
  delete next.fields

  for (const key of Object.keys(next)) {
    if (isPhoneFieldKey(key)) {
      delete next[key]
    }
  }

  const merged: Record<string, string> = {
    ...(fromBlob ?? {}),
    ...(fromFields ?? {}),
  }
  const stripped = stripPhoneFields(merged)
  if (Object.keys(stripped).length === 0) {
    if (existingBlob && !fromBlob && !fromFields) {
      next[OPAQUE_PROP_KEY] = existingBlob
    }
    return next
  }

  const sealed = encryptFieldBlob(stripped)
  if (sealed) {
    next[OPAQUE_PROP_KEY] = sealed
  } else if (existingBlob && !fromFields) {
    next[OPAQUE_PROP_KEY] = existingBlob
  }
  return next
}
