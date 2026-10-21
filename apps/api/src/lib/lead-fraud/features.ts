import type { FiLogItem, LeadFraudFeatures } from './types.js'

const EMAIL_FIELD_RE = /\[(email|e-mail|email_address|emailaddress)\]/i
const NAME_FIELD_RE =
  /\[(first_name|firstname|fname|last_name|lastname|lname|name)\]/i
const PHONE_FIELD_RE =
  /\[(phone|mobile|tel|cell|telephone|phone_number|phonenumber)\]/i

export function parseFiBehavior(items: FiLogItem[]): {
  fillDurationMs: number | null
  typedCount: number
  pasteCount: number
  pastedEmail: boolean
  pastedName: boolean
  pastedPhone: boolean
  hasFormStarted: boolean
  hasFieldInteraction: boolean
} {
  let maxOffset = 0
  let typedCount = 0
  let pasteCount = 0
  let pastedEmail = false
  let pastedName = false
  let pastedPhone = false
  let hasFormStarted = false
  let hasFieldInteraction = false

  for (const item of items) {
    const msg = item.message || ''
    const lower = msg.toLowerCase()
    if (item.offsetMs > maxOffset) maxOffset = item.offsetMs

    if (lower.startsWith('form started')) hasFormStarted = true

    if (lower.startsWith('typed ') || item.kind === 0) {
      typedCount += 1
      hasFieldInteraction = true
    }
    if (lower.startsWith('pasted') || lower.includes('pasted in')) {
      pasteCount += 1
      hasFieldInteraction = true
      if (EMAIL_FIELD_RE.test(msg)) pastedEmail = true
      if (NAME_FIELD_RE.test(msg)) pastedName = true
      if (PHONE_FIELD_RE.test(msg)) pastedPhone = true
    }
    if (
      lower.startsWith('changed value') ||
      lower.startsWith('selected ') ||
      item.kind === 3 ||
      item.kind === 4
    ) {
      hasFieldInteraction = true
    }
  }

  return {
    fillDurationMs: items.length > 0 ? maxOffset : null,
    typedCount,
    pasteCount,
    pastedEmail,
    pastedName,
    pastedPhone,
    hasFormStarted,
    hasFieldInteraction,
  }
}

const NONSENSE_NAME_RE =
  /^(asdf+|qwer+|zxcv+|test|testing|abc|xxx|aaa|bbb|none|n\/a|na|foo|bar|spam|asdfgh|qwerty)$/i


export function looksLikeNonsenseName(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.length < 2) return true
  if (NONSENSE_NAME_RE.test(trimmed)) return true
  if (/^\d+$/.test(trimmed)) return true
  if (!/\p{L}/u.test(trimmed)) return true
  if (/^(.)\1{2,}$/u.test(trimmed)) return true
  return false
}

export function emptyFeatures(
  partial: Partial<LeadFraudFeatures> = {},
): LeadFraudFeatures {
  const formZipEntered = (
    partial.formZipEntered ??
    partial.zip ??
    ''
  ).trim()
  const {
    formZipEntered: _formZip,
    zip: _zip,
    ...rest
  } = partial
  void _formZip
  void _zip
  return {
    fingerprint: '',
    browser: '',
    formSubmitted: false,
    email: '',
    firstName: '',
    lastName: '',
    geoZip: '',
    stateField: '',
    geoState: '',
    geoCountry: '',
    geoCountryCode: '',
    geoCity: '',
    locationComparison: 'unavailable',
    locationComparisonDetail: '',
    networkClass: 'unavailable',
    networkAsn: null,
    networkOrg: '',
    networkEvidenceSource: '',
    networkEvidenceAsOf: '',
    networkDetail: '',
    trustedFormUrl: '',
    clientIpHash: '',
    fillDurationMs: null,
    typedCount: 0,
    pasteCount: 0,
    pastedEmail: false,
    pastedName: false,
    pastedPhone: false,
    hasFormStarted: false,
    hasFieldInteraction: false,
    fiBehaviorKnown: false,
    fingerprintSessionsSameDay: 0,
    fingerprintSubmits24h: 0,
    ipHashSubmits24h: 0,
    emailDomainSubmits24h: 0,
    emailDomainIsCommonConsumer: false,
    fieldCount: 0,
    velocityWindowKnown: false,
    contactMatchStatus: 'no_keys',
    contactMatchTruncated: false,
    contactRepeatedAcrossPages: false,
    contactRepeatedAcrossPartners: false,
    samePhoneDifferentNames: false,
    samePhoneDifferentEmails: false,
    contactLocationChanged: false,
    relatedMarkedInvalidCount: 0,
    evidenceToken: '',
    submitUtmSource: '',
    firstObservedUtmSource: '',
    submitUtmCampaign: '',
    firstObservedUtmCampaign: '',
    clickId: '',
    clickIdReuseCount24h: null,
    attributionConfidence: 'unknown',
    evidenceCutoffMs: 0,
    shadowExtraFindings: [],
    sdkVersion: '',
    sdkCapabilities: '',
    ...rest,
    formZipEntered,
    zip: formZipEntered,
    trustedFormEvidenceTier:
      rest.trustedFormEvidenceTier ??
      (rest.trustedFormUrl?.trim() || partial.trustedFormUrl?.trim()
        ? 'url_present'
        : 'missing'),
  }
}
