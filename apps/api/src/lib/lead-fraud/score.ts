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
import type {
  LeadFraudAssessment,
  LeadFraudFeatures,
  LeadFraudFinding,
  LeadSignalCoverage,
} from './types.js'

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

function pushFinding(
  findings: LeadFraudFinding[],
  code: string,
  detail: string,
): void {
  if (findings.some((f) => f.code === code && f.detail === detail)) return
  findings.push({ code, detail })
}

function resolveCoverage(features: LeadFraudFeatures): LeadSignalCoverage {
  const hasIdentity =
    Boolean(features.email.trim()) ||
    Boolean(features.firstName.trim()) ||
    Boolean(features.lastName.trim()) ||
    Boolean(features.formZipEntered.trim())
  if (!features.fiBehaviorKnown && !features.velocityWindowKnown && !hasIdentity) {
    return 'insufficient'
  }
  if (!features.fiBehaviorKnown || !features.velocityWindowKnown) {
    return 'partial'
  }
  return 'sufficient'
}


export function scoreLeadFraud(
  features: LeadFraudFeatures,
): LeadFraudAssessment {
  const findings: LeadFraudFinding[] = []
  const coverage = resolveCoverage(features)

  if (!features.fiBehaviorKnown) {
    pushFinding(
      findings,
      'session_signals_unknown',
      'Form interaction log was not available for this session',
    )
  }
  if (!features.velocityWindowKnown) {
    pushFinding(
      findings,
      'velocity_window_unknown',
      'Rolling velocity could not be assessed with a real time window',
    )
  }
  if (features.formSubmitted && !features.trustedFormUrl.trim()) {
    pushFinding(
      findings,
      'missing_evidence',
      'TrustedForm certificate URL was not present (capture only; not verified)',
    )
  }

  if (coverage === 'insufficient') {
    return {
      score: null,
      scoreAvailable: false,
      label: 'fraud',
      effectiveLabel: 'fraud',
      coverage,
      findings,
      reasons: findings.map((f) => f.detail),
      modelVersion: LEAD_FRAUD_MODEL_VERSION,
    }
  }

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
    pushFinding(findings, 'empty_fingerprint', 'Device fingerprint was empty')
  }
  if (isBotUa(features.browser)) {
    add(device, W.botUserAgent, 'Bot / crawler user agent')
    pushFinding(findings, 'bot_user_agent', 'Bot or crawler user agent')
  }
  if (features.fingerprintSessionsSameDay >= FP_REUSE_DAY_THRESHOLD) {
    add(
      device,
      W.fingerprintReuse,
      `Fingerprint reused across ${features.fingerprintSessionsSameDay} sessions today`,
    )
    pushFinding(
      findings,
      'fingerprint_reuse',
      `Fingerprint reused across ${features.fingerprintSessionsSameDay} sessions in 24h`,
    )
  }

  if (features.fiBehaviorKnown) {
    if (
      features.fillDurationMs != null &&
      features.fillDurationMs > 0 &&
      features.fillDurationMs < FILL_TOO_FAST_MS
    ) {
      add(behavior, W.fillTooFastMs, 'Form completed unusually quickly')
      pushFinding(findings, 'suspicious_session', 'Form completed unusually quickly')
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
    if (
      features.pasteCount >= 3 &&
      features.typedCount <= features.pasteCount
    ) {
      add(behavior, W.pasteHeavy, 'Paste-heavy input vs typing')
      pushFinding(findings, 'suspicious_session', 'Paste-heavy input vs typing')
    }
    if (
      features.formSubmitted &&
      features.typedCount === 0 &&
      features.pasteCount === 0
    ) {
      add(
        behavior,
        W.noTypingWithSubmit,
        'Submit with no typed or pasted field activity',
      )
      pushFinding(
        findings,
        'suspicious_session',
        'Submit with no typed or pasted field activity',
      )
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
      pushFinding(
        findings,
        'suspicious_session',
        'Submit without field interaction in event log',
      )
    }
  }

  const email = features.email.trim()
  if (email) {
    if (!isValidEmailFormat(email)) {
      add(identity, W.invalidEmailFormat, 'Invalid email format')
      pushFinding(findings, 'invalid_email_format', 'Invalid email format')
    } else {
      const domain = emailDomain(email)
      if (domain && isDisposableEmailDomain(domain)) {
        add(identity, W.disposableEmail, `Disposable email domain (${domain})`)
        pushFinding(
          findings,
          'disposable_email',
          `Disposable email domain (${domain})`,
        )
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
  if (features.formSubmitted && !features.formZipEntered.trim()) {
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

  if (features.velocityWindowKnown) {
    if (features.fingerprintSubmits24h >= VELOCITY_FP_THRESHOLD) {
      add(
        velocity,
        W.velocityFingerprint,
        `${features.fingerprintSubmits24h} submits from same fingerprint in 24h`,
      )
      pushFinding(
        findings,
        'velocity_fingerprint',
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
  }

  const formZip = features.formZipEntered.trim() || features.zip.trim()
  const geoZip = features.geoZip.trim()
  if (formZip && geoZip && formZip !== geoZip) {
    add(
      consistency,
      W.zipMismatch,
      `Form zip ${formZip} differs from geo zip ${geoZip}`,
    )
    pushFinding(
      findings,
      'location_inconsistency',
      `Entered ZIP ${formZip} differs from IP-derived ZIP ${geoZip}`,
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

  if (
    features.fiBehaviorKnown &&
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
    features.fiBehaviorKnown &&
    email &&
    isValidEmailFormat(email) &&
    isDisposableEmailDomain(emailDomain(email)) &&
    !features.hasFieldInteraction
  ) {
    trustScore = Math.min(trustScore, 20)
  }

  const reasons = [
    ...buckets.flatMap((b) => b.reasons),
    ...findings
      .filter((f) => f.code === 'session_signals_unknown')
      .map((f) => f.detail),
  ]
  const label = labelFromTrustScore(trustScore)

  return {
    score: trustScore,
    scoreAvailable: true,
    label,
    effectiveLabel: label,
    coverage,
    findings,
    reasons,
    modelVersion: LEAD_FRAUD_MODEL_VERSION,
  }
}
