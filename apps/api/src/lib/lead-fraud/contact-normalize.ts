import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'
import {
  EMAIL_NORM_VERSION,
  PHONE_NORM_VERSION,
} from './constants.js'

export type PhoneValidity = 'missing' | 'malformed' | 'structurally_valid'

export type NormalizedPhone = {
  raw: string
  e164: string
  validity: PhoneValidity
  normVersion: string
}

export type NormalizedEmail = {
  raw: string
  normalized: string
  normVersion: string
}

const COUNTRY_NAME_TO_ISO: Record<string, CountryCode> = {
  'united states': 'US',
  usa: 'US',
  us: 'US',
  india: 'IN',
  'united kingdom': 'GB',
  uk: 'GB',
  canada: 'CA',
  australia: 'AU',
}

export function countryCodeFromGeo(
  country?: string | null,
  stateCode?: string | null,
): CountryCode | undefined {
  void stateCode
  const c = String(country || '')
    .trim()
    .toLowerCase()
  if (!c || c === 'unknown') return undefined
  if (c.length === 2) return c.toUpperCase() as CountryCode
  return COUNTRY_NAME_TO_ISO[c]
}

export function normalizeEmail(raw: string): NormalizedEmail {
  const trimmed = String(raw || '').trim()
  return {
    raw: trimmed,
    normalized: trimmed.toLowerCase(),
    normVersion: EMAIL_NORM_VERSION,
  }
}

export function normalizePhone(
  raw: string,
  defaultCountry?: CountryCode,
): NormalizedPhone {
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    return {
      raw: '',
      e164: '',
      validity: 'missing',
      normVersion: PHONE_NORM_VERSION,
    }
  }
  try {
    const parsed = parsePhoneNumberFromString(
      trimmed,
      defaultCountry || undefined,
    )
    if (parsed && parsed.isValid()) {
      return {
        raw: trimmed,
        e164: parsed.format('E.164'),
        validity: 'structurally_valid',
        normVersion: PHONE_NORM_VERSION,
      }
    }
  } catch {
    /* malformed */
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 10 && digits.length <= 15) {
    return {
      raw: trimmed,
      e164: digits.startsWith('+') ? digits : `+${digits}`,
      validity: 'structurally_valid',
      normVersion: PHONE_NORM_VERSION,
    }
  }
  return {
    raw: trimmed,
    e164: '',
    validity: 'malformed',
    normVersion: PHONE_NORM_VERSION,
  }
}

export function pickPhoneFromFieldMap(
  fields: Record<string, string>,
): string {
  for (const [key, value] of Object.entries(fields)) {
    const k = key.trim().toLowerCase()
    if (
      /^(phone|mobile|tel|cell|telephone|phone_number|phonenumber|mobile_number)$/i.test(
        k,
      ) ||
      (/phone|mobile|cell|(^|_)tel($|_)/i.test(k) &&
        !/consent|type|otp/i.test(k))
    ) {
      const v = String(value || '').trim()
      if (v) return v
    }
  }
  return ''
}
