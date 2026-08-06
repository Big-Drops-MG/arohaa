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

export function encryptFieldBlob(
  fields: Record<string, string>,
): string | null {
  const key = resolveRawKey()
  if (!key) return null
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(fields), 'utf8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, enc, tag]).toString('base64')
}

export function decryptFieldBlob(
  blob: string,
): Record<string, string> | null {
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
    const dec = Buffer.concat([decipher.update(data), decipher.final()])
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
