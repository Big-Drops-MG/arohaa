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
import { createFinding } from './findings.js'
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

function pushFinding(
  findings: LeadFraudFinding[],
  code: string,
  detail: string,
  opts?: {
    severity?: 'info' | 'low' | 'medium' | 'high'
    availability?: 'available' | 'unavailable' | 'unsupported'
    contributesToScore?: boolean
    shadow?: boolean
    evidenceRefs?: string[]
  },
): void {
  if (findings.some((f) => f.code === code && f.detail === detail)) return
  findings.push(
    createFinding({
      code,
      detail,
      subject: 'submission',
      severity: opts?.severity ?? 'info',
      source: 'lead_fraud_score',
      availability: opts?.availability ?? 'available',
      contributesToScore: opts?.contributesToScore ?? true,
      modelVersion: LEAD_FRAUD_MODEL_VERSION,
      shadow: opts?.shadow,
      evidenceRefs: opts?.evidenceRefs,
      observedAt: 'score:lead',
    }),
  )
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
  let coverage: LeadSignalCoverage =
    !features.fiBehaviorKnown || !features.velocityWindowKnown
      ? 'partial'
      : 'sufficient'
  if (
    coverage === 'sufficient' &&
    (features.contactMatchTruncated ||
      features.contactMatchStatus === 'unavailable' ||
      features.contactMatchStatus === 'no_tenant')
  ) {
    coverage = 'partial'
  }
  return coverage
}

export function scoreLeadFraud(
  features: LeadFraudFeatures,
): LeadFraudAssessment {
  const findings: LeadFraudFinding[] = [
    ...(features.shadowExtraFindings ?? []),
  ]
  const coverage = resolveCoverage(features)

  if (!features.fiBehaviorKnown) {
    pushFinding(
      findings,
      'session_signals_unknown',
      'Form interaction log was not available for this session',
      { availability: 'unavailable', contributesToScore: false, severity: 'info' },
    )
  }
  if (!features.velocityWindowKnown) {
    pushFinding(
      findings,
      'velocity_window_unknown',
      'Rolling velocity could not be assessed with a real time window',
      { availability: 'unavailable', contributesToScore: false, severity: 'info' },
    )
  }

  const tfTier =
    features.trustedFormEvidenceTier ||
    (features.trustedFormUrl.trim() ? 'url_present' : 'missing')
  if (features.formSubmitted && tfTier === 'missing') {
    pushFinding(
      findings,
      'missing_evidence',
      'TrustedForm certificate URL was not present (capture only; not verified)',
    )
  } else if (features.formSubmitted && tfTier === 'url_present') {
    pushFinding(
      findings,
      'trustedform_url_present',
      'TrustedForm URL present; certificate verification is a separate future capability',
    )
  }

  if (coverage === 'insufficient') {
    const shadowDelta = findings
      .filter((f) => f.shadow && typeof f.proposedScoreDelta === 'number')
      .reduce((sum, f) => sum + (f.proposedScoreDelta ?? 0), 0)
    return {
      score: null,
      scoreAvailable: false,
      label: 'fraud',
      effectiveLabel: 'fraud',
      coverage,
      findings,
      reasons: findings.map((f) => f.detail),
      modelVersion: LEAD_FRAUD_MODEL_VERSION,
      shadowScore: null,
      shadowProposedDelta: shadowDelta,
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
  const contact: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.contact,
    reasons: [],
  }
  const source: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.source,
    reasons: [],
  }

  if (!features.fingerprint.trim()) {
    add(device, W.emptyFingerprint, 'Empty device fingerprint')
    pushFinding(findings, 'empty_fingerprint', 'Device fingerprint was empty')
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

  if (features.formSubmitted && tfTier === 'missing') {
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
    if (
      features.emailDomainSubmits24h >= VELOCITY_DOMAIN_THRESHOLD &&
      !features.emailDomainIsCommonConsumer
    ) {
      add(
        velocity,
        W.velocityEmailDomain,
        `${features.emailDomainSubmits24h} submits from same email domain in 24h`,
      )
    }
  }

  if (features.locationComparison === 'consistent') {
    pushFinding(
      findings,
      'location_consistent',
      features.locationComparisonDetail ||
        'Entered location agrees with IP estimate',
    )
  } else if (features.locationComparison === 'minor_difference') {
    pushFinding(
      findings,
      'location_minor_difference',
      features.locationComparisonDetail ||
        'Minor location difference — informational',
    )
  } else if (features.locationComparison === 'inconsistency') {
    add(
      consistency,
      W.locationInconsistency,
      features.locationComparisonDetail ||
        'Substantial location inconsistency between entered ZIP region and IP geo',
    )
    pushFinding(
      findings,
      'location_inconsistency',
      features.locationComparisonDetail ||
        'Substantial location inconsistency between entered ZIP region and IP geo',
    )
  } else {
    pushFinding(
      findings,
      'location_comparison_unavailable',
      features.locationComparisonDetail ||
        'Location comparison unavailable — unknown, not match or mismatch',
    )
  }

  if (
    features.utmSourceReputation === 'location_mismatch_cluster' &&
    features.submitUtmSource.trim()
  ) {
    const src = features.submitUtmSource.trim()
    const n = features.utmSourceSubmitCount
    const m = features.utmSourceMismatchCount
    const detail =
      n > 0
        ? `utm_source ${src}: ${m}/${n} submits in 30d with ZIP/IP state mismatch`
        : `utm_source ${src}: elevated location-mismatch cluster`
    add(source, W.utmSourceLocationCluster, detail)
    pushFinding(findings, 'utm_source_location_mismatch_cluster', detail, {
      severity: 'high',
    })
  }

  const network: Bucket = {
    points: 0,
    cap: LEAD_FRAUD_CAPS.network,
    reasons: [],
  }
  if (features.networkClass === 'known_proxy_list') {
    add(
      network,
      W.knownProxyList,
      `Known proxy/VPN-list match (${features.networkEvidenceSource || 'list'}; as of ${features.networkEvidenceAsOf || 'unknown'})`,
    )
    pushFinding(
      findings,
      'network_known_proxy_list',
      features.networkDetail ||
        `Known proxy/VPN-list match — source ${features.networkEvidenceSource || 'unknown'}, as of ${features.networkEvidenceAsOf || 'unknown'}. Alone cannot establish fraud.`,
    )
  } else if (features.networkClass === 'hosting_network') {
    add(network, W.hostingNetwork, 'Hosting/infrastructure network match')
    pushFinding(
      findings,
      'network_hosting',
      `Hosting-network match${features.networkOrg ? ` (${features.networkOrg})` : ''} — suggests infrastructure use, not necessarily a proxy`,
    )
  } else if (features.networkClass === 'no_known_match') {
    pushFinding(
      findings,
      'network_no_known_match',
      'No known proxy/VPN or hosting list match — does not mean “no proxy”',
    )
  } else {
    pushFinding(
      findings,
      'network_unavailable',
      features.networkDetail ||
        'Network classification unavailable or stale — detection could not reliably run',
    )
  }

  if (features.formSubmitted && features.fieldCount <= 1) {
    add(completeness, W.emptySubmittedLead, 'Submitted with almost empty fields')
  }

  if (features.contactMatchStatus === 'unavailable') {
    pushFinding(
      findings,
      'contact_matching_unavailable',
      'Related-contact matching temporarily unavailable; conflicts unknown',
    )
  } else if (features.contactMatchStatus === 'no_tenant') {
    pushFinding(
      findings,
      'contact_matching_unavailable',
      'Organisation id missing; cross-page matching disabled',
    )
  }

  if (features.contactMatchTruncated) {
    pushFinding(
      findings,
      'matching_truncated',
      'Related-contact matching hit the shared fetch cap; related results may be incomplete',
    )
  }

  if (
    features.contactMatchStatus === 'ok' &&
    features.contactRepeatedAcrossPages
  ) {
    pushFinding(
      findings,
      'contact_repeated_across_pages',
      'Contact appears across multiple landing pages (informational)',
    )
  }
  if (
    features.contactMatchStatus === 'ok' &&
    features.contactRepeatedAcrossPartners
  ) {
    pushFinding(
      findings,
      'contact_repeated_across_partners',
      'Contact appears across multiple partners (informational)',
    )
  }

  const correlatedConflict =
    features.contactMatchStatus === 'ok' &&
    (features.samePhoneDifferentNames ||
      features.samePhoneDifferentEmails ||
      features.contactLocationChanged)
  if (correlatedConflict) {
    add(
      contact,
      W.samePhoneDifferentIdentity,
      'Correlated identity conflicts on related contact submissions',
    )
    if (features.samePhoneDifferentNames) {
      pushFinding(
        findings,
        'same_phone_different_names',
        'Same phone with different names on related submissions',
      )
    }
    if (features.samePhoneDifferentEmails) {
      pushFinding(
        findings,
        'same_phone_different_emails',
        'Same phone with different emails on related submissions',
      )
    }
    if (features.contactLocationChanged) {
      pushFinding(
        findings,
        'contact_location_changed',
        'ZIP differs across related submissions',
      )
    }
  }

  if (
    features.contactMatchStatus === 'ok' &&
    features.relatedMarkedInvalidCount > 0
  ) {
    pushFinding(
      findings,
      'related_submission_marked_invalid',
      `${features.relatedMarkedInvalidCount} related submission(s) previously marked invalid (context only; not transferred)`,
    )
  }

  if (features.attributionConfidence === 'first_differs_from_submit') {
    pushFinding(
      findings,
      'attribution_first_touch_differs',
      `First-observed partner (${features.firstObservedUtmSource || 'unknown'}) differs from submit-time (${features.submitUtmSource || 'unknown'}). Shared campaign links and legitimate redirects can change attribution; review signal only, not proof of fraud.`,
      {
        severity: 'low',
        contributesToScore: false,
        shadow: true,
        evidenceRefs: [
          features.firstObservedUtmSource,
          features.submitUtmSource,
        ].filter(Boolean),
      },
    )
  }

  if (
    features.firstObservedUtmCampaign &&
    features.submitUtmCampaign &&
    features.firstObservedUtmCampaign.toLowerCase() !==
      features.submitUtmCampaign.toLowerCase()
  ) {
    pushFinding(
      findings,
      'attribution_campaign_conflict',
      `Campaign changed during the session (${features.firstObservedUtmCampaign} → ${features.submitUtmCampaign}). Can be a legitimate mid-funnel change; review signal only.`,
      {
        severity: 'low',
        contributesToScore: false,
        shadow: true,
        evidenceRefs: [
          features.firstObservedUtmCampaign,
          features.submitUtmCampaign,
        ],
      },
    )
  }

  if (
    features.clickId &&
    features.clickIdReuseCount24h != null &&
    features.clickIdReuseCount24h >= 5
  ) {
    pushFinding(
      findings,
      'click_id_reused_across_sessions',
      `Click/attribution id reused across ${features.clickIdReuseCount24h} sessions in 24h. Shared links can be legitimate; review signal only.`,
      {
        severity: 'medium',
        contributesToScore: false,
        shadow: true,
        evidenceRefs: [features.clickId],
      },
    )
  }

  const buckets = [
    device,
    behavior,
    identity,
    trustBucket,
    velocity,
    consistency,
    completeness,
    contact,
    network,
    source,
  ]
  const riskPoints = buckets.reduce((sum, b) => sum + b.points, 0)
  let trustScore = Math.max(0, Math.min(100, 100 - Math.round(riskPoints)))

  if (
    features.fiBehaviorKnown &&
    !features.fingerprint.trim() &&
    features.fillDurationMs != null &&
    features.fillDurationMs < FILL_TOO_FAST_MS &&
    features.typedCount === 0
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

  const shadowDelta = findings
    .filter((f) => f.shadow && typeof f.proposedScoreDelta === 'number')
    .reduce((sum, f) => sum + (f.proposedScoreDelta ?? 0), 0)
  const shadowScore = Math.max(
    0,
    Math.min(100, trustScore - Math.round(shadowDelta)),
  )

  return {
    score: trustScore,
    scoreAvailable: true,
    label,
    effectiveLabel: label,
    coverage,
    findings,
    reasons,
    modelVersion: LEAD_FRAUD_MODEL_VERSION,
    shadowScore,
    shadowProposedDelta: shadowDelta,
  }
}
