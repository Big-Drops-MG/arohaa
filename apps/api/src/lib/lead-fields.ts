import { isPhoneFieldKey } from './field-blob.js'

const TRUTHY = new Set(['on', 'true', '1', 'yes'])

const PEELABLE_BASE_RE =
  /^(?:car|driver|vehicle)_\d+_(?:year|make|model|gender|married|fault|dui|military|sr22|credit|homeowner|education|occupation|license|age)$/i

const EMAIL_KEY_RE = /^(email|e-mail|email_address|emailaddress)$/i
const ZIP_KEY_RE = /^(zip|zipcode|zip_code|postal)$/i

function isDigestValue(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value)
}

function isTruthyFlag(value: string): boolean {
  return TRUTHY.has(value.trim().toLowerCase())
}

function peelRadioKey(
  key: string,
  value: string,
): { base: string; option: string } | null {
  const idx = key.lastIndexOf('_')
  if (idx <= 0) return null
  const base = key.slice(0, idx)
  const option = key.slice(idx + 1)
  if (!option || !PEELABLE_BASE_RE.test(base)) return null

  const trimmed = value.trim()
  if (isTruthyFlag(trimmed)) return { base, option }
  if (trimmed.toLowerCase() === option.toLowerCase()) return { base, option }
  return null
}

export function normalizeLeadFields(
  raw: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (!key || isPhoneFieldKey(key)) continue
    const trimmed = String(value ?? '').trim()
    if (!trimmed) continue
    if (EMAIL_KEY_RE.test(key) && isDigestValue(trimmed)) continue

    const peeled = peelRadioKey(key, trimmed)
    if (peeled) {
      out[peeled.base] = peeled.option
      continue
    }

    if (isTruthyFlag(trimmed)) {
      out[key] = 'Yes'
      continue
    }

    out[key] = trimmed.slice(0, 500)
  }

  return out
}

export function pickLeadEmail(fields: Record<string, string>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (!EMAIL_KEY_RE.test(key)) continue
    if (!value || isDigestValue(value)) continue
    return value
  }
  return ''
}

export function pickLeadZip(fields: Record<string, string>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (!ZIP_KEY_RE.test(key)) continue
    const digits = value.replace(/\D/g, '').slice(0, 5)
    if (digits.length === 5) return digits
  }
  return ''
}

export function fieldsWithoutReserved(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (EMAIL_KEY_RE.test(key) || ZIP_KEY_RE.test(key)) continue
    out[key] = value
  }
  return out
}
