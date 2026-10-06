import {
  FILL_TOO_FAST_MS,
  FILL_TOO_SLOW_MS,
  FP_REUSE_DAY_THRESHOLD,
  LEAD_FRAUD_CAPS,
  LEAD_FRAUD_MODEL_VERSION,
  LEAD_FRAUD_WEIGHTS as W,
  VELOCITY_DOMAIN_THRESHOLD,
  VELOCITY_FP_THRESHOLD,
  VELOCITY_IP_THRESHOLD,
  labelFromTrustScore,
} from './constants.js'
import {
  emailDomain,
  isDisposableEmailDomain,
  isRoleEmailLocalPart,
  isValidEmailFormat,
  looksLikeRandomEmailLocal,
} from './disposable-domains.js'
import { looksLikeNonsenseName } from './features.js'
import type { LeadFraudAssessment, LeadFraudFeatures } from './types.js'

type Bucket = {
  points: number
  cap: number
  reasons: string[]
}

function add(bucket: Bucket, points: number, reason: string): void {
  if (points <= 0) return
  const room = bucket.cap - bucket.points
  if (room <= 0) return
  const applied = Math.min(points, room)
  bucket.points += applied
  bucket.reasons.push(`${reason} (−${applied} trust)`)
}

function isBotUa(browser: string): boolean {
  const b = browser.toLowerCase()
  return b.includes('bot') || b.includes('crawler') || b.includes('spider')
}

/**
 * Scores lead trust from event-log behavior, email quality, device, and velocity.
 * `score` is trust 0–100 (higher = more legitimate).
 */
export function scoreLeadFraud(
  features: LeadFraudFeatures,
): LeadFraudAssessment {
  const device: Bucket = { points: 0, cap: LEAD_FRAUD_CAPS.device, reasons: [] }
  const behavior: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.behavior,
    reasons: [],
  }
  const identity: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.identity,
    reasons: [],
  }
  const trustBucket: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.trust,
    reasons: [],
  }
  const velocity: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.velocity,
    reasons: [],
  }
  const consistency: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.consistency,
    reasons: [],
  }
  const completeness: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.completeness,
    reasons: [],
  }

  if (!features.fingerprint.trim()) {
    add(device, W.emptyFingerprint, 'Empty device fingerprint')
  }
  if (isBotUa(features.browser)) {
    add(device, W.botUserAgent, 'Bot / crawler user agent')
  }
  if (features.fingerprintSessionsSameDay >= FP_REUSE_DAY_THRESHOLD) {
    add(
      device,
      W.fingerprintReuse,
      `Fingerprint reused across ${features.fingerprintSessionsSameDay} sessions today`,
    )
  }

  if (
    features.fillDurationMs != null &&
    features.fillDurationMs > 0 &&
    features.fillDurationMs < FILL_TOO_FAST_MS
  ) {
    add(behavior, W.fillTooFastMs, 'Form completed unusually quickly')
  }
  if (
    features.fillDurationMs != null &&
    features.fillDurationMs > FILL_TOO_SLOW_MS
  ) {
    add(behavior, W.fillTooSlowMs, 'Form session unusually long')
  }
  if (features.pastedEmail) {
    add(behavior, W.pastedEmail, 'Pasted into Email')
  }
  if (features.pastedName) {
    add(behavior, W.pastedName, 'Pasted into name field')
  }
  if (features.pastedPhone) {
    add(behavior, W.pastedPhone, 'Pasted into Phone')
  }
  if (features.pasteCount >= 3 && features.typedCount <= features.pasteCount) {
    add(behavior, W.pasteHeavy, 'Paste-heavy input vs typing')
  }
  if (features.formSubmitted && features.typedCount === 0 && features.pasteCount === 0) {
    add(behavior, W.noTypingWithSubmit, 'Submit with no typed or pasted field activity')
  }
  if (features.formSubmitted && !features.hasFormStarted) {
    add(behavior, W.noFormStarted, 'Submit without form-start event')
  }
  if (features.formSubmitted && !features.hasFieldInteraction) {
    add(
      behavior,
      W.submitWithoutInteraction,
      'Submit without field interaction in event log',
    )
  }

  const email = features.email.trim()
  if (email) {
    if (!isValidEmailFormat(email)) {
      add(identity, W.invalidEmailFormat, 'Invalid email format')
    } else {
      const domain = emailDomain(email)
      if (domain && isDisposableEmailDomain(domain)) {
        add(identity, W.disposableEmail, `Disposable email domain (${domain})`)
      }
      if (isRoleEmailLocalPart(email)) {
        add(identity, W.roleEmail, 'Role-based email local-part')
      }
      if (looksLikeRandomEmailLocal(email)) {
        add(identity, W.randomEmailLocal, 'Random / generated email local-part')
      }
    }
  } else if (features.formSubmitted) {
    add(identity, W.missingEmail, 'Submitted without email')
  }

  if (
    features.formSubmitted &&
    !features.firstName.trim() &&
    !features.lastName.trim()
  ) {
    add(identity, W.missingName, 'Submitted without name')
  }
  if (features.formSubmitted && !features.zip.trim()) {
    add(identity, W.missingZip, 'Submitted without zip')
  }
  if (
    looksLikeNonsenseName(features.firstName) ||
    looksLikeNonsenseName(features.lastName)
  ) {
    add(identity, W.nonsenseName, 'Nonsense name pattern')
  }

  if (features.formSubmitted && !features.trustedFormUrl.trim()) {
    add(trustBucket, W.missingTrustedForm, 'Missing TrustedForm certificate')
  }

  if (features.fingerprintSubmits24h >= VELOCITY_FP_THRESHOLD) {
    add(
      velocity,
      W.velocityFingerprint,
      `${features.fingerprintSubmits24h} submits from same fingerprint in 24h`,
    )
  }
  if (features.ipHashSubmits24h >= VELOCITY_IP_THRESHOLD) {
    add(
      velocity,
      W.velocityIpHash,
      `${features.ipHashSubmits24h} submits from same IP hash in 24h`,
    )
  }
  if (features.emailDomainSubmits24h >= VELOCITY_DOMAIN_THRESHOLD) {
    add(
      velocity,
      W.velocityEmailDomain,
      `${features.emailDomainSubmits24h} submits from same email domain in 24h`,
    )
  }

  if (features.zip && features.geoZip && features.zip !== features.geoZip) {
    add(
      consistency,
      W.zipMismatch,
      `Form zip ${features.zip} differs from geo zip ${features.geoZip}`,
    )
  }

  if (features.formSubmitted && features.fieldCount <= 1) {
    add(completeness, W.emptySubmittedLead, 'Submitted with almost empty fields')
  }

  const buckets = [
    device,
    behavior,
    identity,
    trustBucket,
    velocity,
    consistency,
    completeness,
  ]
  const riskPoints = buckets.reduce((sum, b) => sum + b.points, 0)
  let trustScore = Math.max(0, Math.min(100, 100 - Math.round(riskPoints)))

  // Extreme combo floors trust (forces Fraud)
  if (
    isBotUa(features.browser) &&
    !features.fingerprint.trim() &&
    features.fillDurationMs != null &&
    features.fillDurationMs < FILL_TOO_FAST_MS
  ) {
    trustScore = Math.min(trustScore, 15)
  }
  if (email && !isValidEmailFormat(email)) {
    trustScore = Math.min(trustScore, 35)
  }
  if (
    email &&
    isValidEmailFormat(email) &&
    isDisposableEmailDomain(emailDomain(email)) &&
    !features.hasFieldInteraction
  ) {
    trustScore = Math.min(trustScore, 20)
  }

  const reasons = buckets.flatMap((b) => b.reasons)
  const label = labelFromTrustScore(trustScore)

  return {
    score: trustScore,
    label,
    effectiveLabel: label,
    reasons,
    modelVersion: LEAD_FRAUD_MODEL_VERSION,
  }
}
