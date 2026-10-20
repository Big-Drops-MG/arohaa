import type { LeadFraudLabel, LeadSignalCoverage } from './types.js'

export const LEAD_FRAUD_MODEL_VERSION = 'v8'

export const ASSESSMENT_MAX_AGE_MS = 7 * 24 * 60 * 60_000

export type { LeadFraudLabel, LeadSignalCoverage }

export const LEAD_FRAUD_THRESHOLDS = {
  fraudBelowTrust: 50,
} as const

export const LEAD_FRAUD_WEIGHTS = {
  emptyFingerprint: 12,
  botUserAgent: 28,
  fingerprintReuse: 14,
  fillTooFastMs: 22,
  fillTooSlowMs: 4,
  pastedEmail: 6,
  pastedName: 8,
  pastedPhone: 5,
  pasteHeavy: 12,
  noTypingWithSubmit: 18,
  noFormStarted: 10,
  submitWithoutInteraction: 20,
  invalidEmailFormat: 25,
  disposableEmail: 30,
  roleEmail: 8,
  randomEmailLocal: 18,
  missingEmail: 20,
  missingName: 10,
  missingZip: 6,
  nonsenseName: 16,
  missingTrustedForm: 8,
  velocityFingerprint: 16,
  velocityIpHash: 12,
  velocityEmailDomain: 8,
  locationInconsistency: 10,
  knownProxyList: 8,
  hostingNetwork: 4,
  emptySubmittedLead: 22,
  contactRepeated: 6,
  samePhoneDifferentIdentity: 10,
} as const

export const LEAD_FRAUD_CAPS = {
  device: 35,
  behavior: 50,
  identity: 55,
  trust: 10,
  velocity: 28,
  consistency: 12,
  completeness: 22,
  contact: 16,
  network: 12,
} as const

export const FILL_TOO_FAST_MS = 3_000
export const FILL_TOO_SLOW_MS = 45 * 60_000
export const VELOCITY_WINDOW_HOURS = 24
export const VELOCITY_FP_THRESHOLD = 4
export const VELOCITY_IP_THRESHOLD = 8
export const VELOCITY_DOMAIN_THRESHOLD = 12
export const FP_REUSE_DAY_THRESHOLD = 3

export const PHONE_NORM_VERSION = 'phone_norm_v1'
export const EMAIL_NORM_VERSION = 'email_norm_v1'
export const CONTACT_HASH_VERSION = 'contact_hash_v1'

export function labelFromTrustScore(trustScore: number): LeadFraudLabel {
  return trustScore < LEAD_FRAUD_THRESHOLDS.fraudBelowTrust ? 'fraud' : 'legit'
}

export function isLeadFraudLabel(value: string): value is LeadFraudLabel {
  return value === 'legit' || value === 'fraud'
}

export function isLeadSignalCoverage(value: string): value is LeadSignalCoverage {
  return (
    value === 'sufficient' || value === 'partial' || value === 'insufficient'
  )
}
