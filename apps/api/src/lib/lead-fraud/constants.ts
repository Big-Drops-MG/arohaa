import type { LeadFraudLabel } from './types.js'

/** Bumped when score semantics change (trust score, binary labels). */
export const LEAD_FRAUD_MODEL_VERSION = 'v2'

export type { LeadFraudLabel }

/** Trust score below this → Fraud; otherwise Legit. */
export const LEAD_FRAUD_THRESHOLDS = {
  fraudBelowTrust: 50,
} as const

/** Risk points subtracted from 100 to produce trust score. */
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
  zipMismatch: 10,
  emptySubmittedLead: 22,
} as const

export const LEAD_FRAUD_CAPS = {
  device: 35,
  behavior: 50,
  identity: 55,
  trust: 10,
  velocity: 28,
  consistency: 12,
  completeness: 22,
} as const

export const FILL_TOO_FAST_MS = 3_000
export const FILL_TOO_SLOW_MS = 45 * 60_000
export const VELOCITY_WINDOW_HOURS = 24
export const VELOCITY_FP_THRESHOLD = 4
export const VELOCITY_IP_THRESHOLD = 8
export const VELOCITY_DOMAIN_THRESHOLD = 12
export const FP_REUSE_DAY_THRESHOLD = 3

/**
 * @param trustScore 0–100 where higher is more trustworthy
 */
export function labelFromTrustScore(trustScore: number): LeadFraudLabel {
  return trustScore < LEAD_FRAUD_THRESHOLDS.fraudBelowTrust ? 'fraud' : 'legit'
}

export function isLeadFraudLabel(value: string): value is LeadFraudLabel {
  return value === 'legit' || value === 'fraud'
}
