import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import {
  createFinding,
  shadowProposedDelta,
  type AssessmentFinding,
} from './findings.js'

export const VISIT_MODEL_VERSION = 'visit_v1'

export const SUSPICIOUS_VISIT_FINDING_CODES = new Set([
  'arrival_burst',
  'repeated_low_engagement_visits',
  'repeated_behavior_pattern',
  'automation_indicator_observed',
  'browser_environment_inconsistent',
  'event_id_content_conflict',
  'session_token_mismatch',
  'session_token_invalid',
  'unexpected_script_origin',
  'form_destination_changed',
  'unexpected_frame_observed',
])

export type VisitSignals = {
  sessionId: string
  workspaceId: string
  tenantWorkspaceId: string
  arrivedAtMs: number | null
  departedAtMs: number | null
  visibleMs: number | null
  activeMs: number | null
  hasMeaningfulInteraction: boolean
  hasFormEngagement: boolean
  formSubmitted: boolean
  arrivalCount24h: number | null
  lowEngagementRepeatCount: number | null
  similarBehaviorRepeatCount: number | null
  similarBehaviorAvailable: boolean
  arrivalStatsAvailable: boolean
  identityAvailable: boolean
  sdkVersion: string
  sdkCapabilities: string
  integrityFindings: AssessmentFinding[]
  browserFindings: AssessmentFinding[]
  signalsIncomplete: boolean
  evidenceTruncated: boolean
}

export type VisitAssessment = {
  score: number | null
  scoreAvailable: boolean
  coverage: 'sufficient' | 'partial' | 'insufficient'
  findings: AssessmentFinding[]
  reasons: string[]
  modelVersion: string
  shadowScore: number | null
  shadowProposedDelta: number
  suspiciousVisit: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function scoreVisit(signals: VisitSignals): VisitAssessment {
  const findings: AssessmentFinding[] = [
    ...signals.integrityFindings,
    ...signals.browserFindings,
  ]
  const reasons: string[] = []

  if (signals.evidenceTruncated) {
    findings.push(
      createFinding({
        code: 'visit_evidence_truncated',
        detail:
          'Session evidence loader hit the event cap; later observations may be missing',
        subject: 'visit',
        severity: 'info',
        source: 'visit_assessment',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: 'evidence:truncated',
      }),
    )
  }

  if (!signals.identityAvailable) {
    findings.push(
      createFinding({
        code: 'visit_identity_unavailable',
        detail: 'Device/network identity lookup failed for visit velocity',
        subject: 'visit',
        severity: 'info',
        source: 'visit_assessment',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: 'identity:unavailable',
      }),
    )
  }

  if (!signals.arrivalStatsAvailable) {
    findings.push(
      createFinding({
        code: 'visit_arrival_stats_unavailable',
        detail: 'Arrival/velocity counters could not be loaded',
        subject: 'visit',
        severity: 'info',
        source: 'visit_assessment',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: 'arrivals:unavailable',
      }),
    )
  }

  if (!signals.similarBehaviorAvailable) {
    findings.push(
      createFinding({
        code: 'repeated_behavior_pattern_unavailable',
        detail:
          'Similar behavior-pattern matching is not implemented; check marked unavailable',
        subject: 'visit',
        severity: 'info',
        source: 'visit_assessment',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: 'pattern:unavailable',
      }),
    )
  }

  if (signals.signalsIncomplete || !signals.sdkVersion) {
    findings.push(
      createFinding({
        code: 'visit_signals_incomplete',
        detail: 'Visit assessment is missing SDK version or core session signals',
        subject: 'visit',
        severity: 'info',
        source: 'visit_assessment',
        availability: 'unavailable',
        contributesToScore: false,
        shadow: true,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: 'signals:incomplete',
      }),
    )
  }

  if (
    signals.arrivalStatsAvailable &&
    signals.arrivalCount24h != null &&
    signals.arrivalCount24h >= 8
  ) {
    findings.push(
      createFinding({
        code: 'arrival_burst',
        detail: `${signals.arrivalCount24h} arrivals observed for this device/network window`,
        subject: 'visit',
        severity: 'medium',
        source: 'visit_assessment',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 6,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: `arrivals:${signals.arrivalCount24h}`,
      }),
    )
    reasons.push('arrival_burst')
  }

  if (
    signals.arrivalStatsAvailable &&
    signals.lowEngagementRepeatCount != null &&
    signals.lowEngagementRepeatCount >= 3
  ) {
    findings.push(
      createFinding({
        code: 'repeated_low_engagement_visits',
        detail: `${signals.lowEngagementRepeatCount} recent low-engagement visits`,
        subject: 'visit',
        severity: 'medium',
        source: 'visit_assessment',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 5,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: `low_engagement:${signals.lowEngagementRepeatCount}`,
      }),
    )
    reasons.push('repeated_low_engagement_visits')
  }

  if (
    signals.similarBehaviorAvailable &&
    signals.similarBehaviorRepeatCount != null &&
    signals.similarBehaviorRepeatCount >= 4
  ) {
    findings.push(
      createFinding({
        code: 'repeated_behavior_pattern',
        detail: `${signals.similarBehaviorRepeatCount} sessions with a similar coarse interaction pattern. Identical forms, autofill, and accessibility tools can collide; review signal only, not proof of fraud.`,
        subject: 'visit',
        severity: 'medium',
        source: 'visit_assessment',
        availability: 'available',
        contributesToScore: false,
        shadow: true,
        proposedScoreDelta: 5,
        modelVersion: VISIT_MODEL_VERSION,
        observedAt: `pattern:${signals.similarBehaviorRepeatCount}`,
      }),
    )
    reasons.push('repeated_behavior_pattern')
  }

  const coverage: VisitAssessment['coverage'] =
    signals.signalsIncomplete ||
    !signals.identityAvailable ||
    !signals.arrivalStatsAvailable
      ? signals.signalsIncomplete
        ? 'insufficient'
        : 'partial'
      : signals.visibleMs == null || !signals.sdkVersion
        ? 'partial'
        : 'sufficient'

  const shadowDelta = shadowProposedDelta(findings)
  const base = 100
  const shadowScore =
    coverage === 'insufficient' ? null : clamp(base - shadowDelta)

  const suspiciousVisit = findings.some(
    (f) =>
      f.availability === 'available' &&
      SUSPICIOUS_VISIT_FINDING_CODES.has(f.code),
  )

  return {
    score: null,
    scoreAvailable: false,
    coverage,
    findings,
    reasons,
    modelVersion: VISIT_MODEL_VERSION,
    shadowScore,
    shadowProposedDelta: shadowDelta,
    suspiciousVisit,
  }
}

export function emptyVisitSignals(
  partial: Partial<VisitSignals> &
    Pick<VisitSignals, 'sessionId' | 'workspaceId'>,
): VisitSignals {
  return {
    tenantWorkspaceId: '',
    arrivedAtMs: null,
    departedAtMs: null,
    visibleMs: null,
    activeMs: null,
    hasMeaningfulInteraction: false,
    hasFormEngagement: false,
    formSubmitted: false,
    arrivalCount24h: null,
    lowEngagementRepeatCount: null,
    similarBehaviorRepeatCount: null,
    similarBehaviorAvailable: false,
    arrivalStatsAvailable: false,
    identityAvailable: false,
    sdkVersion: '',
    sdkCapabilities: '',
    integrityFindings: [],
    browserFindings: [],
    signalsIncomplete: true,
    evidenceTruncated: false,
    ...partial,
  }
}

export { LEAD_FRAUD_MODEL_VERSION }
