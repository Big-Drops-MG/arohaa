import { createHash } from 'node:crypto'
import { CONTACT_HASH_VERSION } from './constants.js'
import {
  countryCodeFromGeo,
  normalizeEmail,
  normalizePhone,
  pickPhoneFromFieldMap,
  type PhoneValidity,
} from './contact-normalize.js'
import {
  decryptFieldBlob,
  isPhoneFieldKey,
  OPAQUE_PROP_KEY,
} from '../field-blob.js'
import { normalizeLeadFields, pickLeadEmail } from '../lead-fields.js'

export type ContactHashes = {
  phoneHash: string
  emailHash: string
  phoneE164: string
  phoneValidity: PhoneValidity
  emailNormalized: string
  hashVersion: string
}


function contactHashSecrets(): string[] {
  const primary =
    process.env.AROHAA_CONTACT_HASH_SECRET?.trim() ||
    process.env.AROHAA_INTERNAL_API_SECRET?.trim() ||
    process.env.AROHAA_FIELD_BLOB_KEY?.trim() ||
    ''
  const previous = process.env.AROHAA_CONTACT_HASH_SECRET_PREVIOUS?.trim() || ''
  const out: string[] = []
  if (primary) out.push(primary)
  if (previous && previous !== primary) out.push(previous)
  return out
}

function hashWithSecret(
  kind: 'phone' | 'email',
  canonical: string,
  secret: string,
): string {
  return createHash('sha256')
    .update(`${kind}:${CONTACT_HASH_VERSION}:${secret}:${canonical}`)
    .digest('hex')
}

export function hashContactValue(
  kind: 'phone' | 'email',
  canonical: string,
): string {
  const value = canonical.trim()
  if (!value) return ''
  const secrets = contactHashSecrets()
  if (secrets.length === 0) {
    return ''
  }
  return hashWithSecret(kind, value, secrets[0]!)
}

export function hashContactValueAll(
  kind: 'phone' | 'email',
  canonical: string,
): string[] {
  const value = canonical.trim()
  if (!value) return []
  return contactHashSecrets().map((secret) => hashWithSecret(kind, value, secret))
}

function mergePhoneBearingFields(
  props: Record<string, unknown> | undefined,
): Record<string, string> {
  const next = { ...(props ?? {}) }
  const out: Record<string, string> = {}
  const blob = next[OPAQUE_PROP_KEY]
  if (typeof blob === 'string' && blob.length > 0) {
    const fromBlob = decryptFieldBlob(blob)
    if (fromBlob) Object.assign(out, fromBlob)
  }
  const fields = next.fields
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
      if (
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
      ) {
        out[k] = String(v)
      }
    }
  }
  for (const [k, v] of Object.entries(next)) {
    if (k === 'fields' || k === OPAQUE_PROP_KEY) continue
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = String(v)
    }
  }
  return out
}

export function extractContactHashesFromProps(
  props: Record<string, unknown> | undefined,
  geo?: { country?: string; stateCode?: string },
): ContactHashes {
  const merged = mergePhoneBearingFields(props)
  const fields = normalizeLeadFields(merged)
  const emailRaw = pickLeadEmail(fields)
  const email = normalizeEmail(emailRaw)
  const phoneRaw =
    pickPhoneFromFieldMap(merged) ||
    pickPhoneFromFieldMap(
      Object.fromEntries(
        Object.entries(merged).filter(([k]) => isPhoneFieldKey(k)),
      ),
    )
  const phone = normalizePhone(
    phoneRaw,
    countryCodeFromGeo(geo?.country, geo?.stateCode),
  )
  const phoneHashes =
    phone.validity === 'structurally_valid' && phone.e164
      ? hashContactValueAll('phone', phone.e164)
      : []
  const emailHashes = email.normalized
    ? hashContactValueAll('email', email.normalized)
    : []
  return {
    phoneHash: phoneHashes[0] || '',
    emailHash: emailHashes[0] || '',
    phoneE164: phone.e164,
    phoneValidity: phone.validity,
    emailNormalized: email.normalized,
    hashVersion: CONTACT_HASH_VERSION,
  }
}

export function extractAllContactHashesFromProps(
  props: Record<string, unknown> | undefined,
  geo?: { country?: string; stateCode?: string },
): { phoneHashes: string[]; emailHashes: string[] } {
  const primary = extractContactHashesFromProps(props, geo)
  const phoneHashes =
    primary.phoneE164 && primary.phoneValidity === 'structurally_valid'
      ? hashContactValueAll('phone', primary.phoneE164)
      : primary.phoneHash
        ? [primary.phoneHash]
        : []
  const emailHashes = primary.emailNormalized
    ? hashContactValueAll('email', primary.emailNormalized)
    : primary.emailHash
      ? [primary.emailHash]
      : []
  return { phoneHashes, emailHashes }
}
