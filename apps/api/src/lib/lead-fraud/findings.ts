import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import type { LeadFraudFinding } from './types.js'

export type FindingSubject =
  | 'visit'
  | 'submission'
  | 'related_group'
  | 'partner'

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high'

export type FindingAvailability =
  | 'available'
  | 'unavailable'
  | 'unsupported'

export type AssessmentFinding = LeadFraudFinding & {
  subject: FindingSubject
  severity: FindingSeverity
  evidenceRefs?: string[]
  observedAt: string
  evidenceCutoff?: string
  source: string
  availability: FindingAvailability
  contributesToScore: boolean
  modelVersion: string
  featureVersion?: string
  shadow?: boolean
  proposedScoreDelta?: number
}

export function createFinding(input: {
  code: string
  detail: string
  subject: FindingSubject
  severity?: FindingSeverity
  evidenceRefs?: string[]
  observedAt?: string | number | Date
  evidenceCutoff?: string | number | Date
  source: string
  availability?: FindingAvailability
  contributesToScore?: boolean
  modelVersion?: string
  featureVersion?: string
  shadow?: boolean
  proposedScoreDelta?: number
}): AssessmentFinding {
  const toIso = (value: string | number | Date | undefined): string | undefined => {
    if (value == null) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'number') return new Date(value).toISOString()
    return value.toISOString()
  }

  return {
    code: input.code,
    detail: input.detail,
    subject: input.subject,
    severity: input.severity ?? 'info',
    evidenceRefs: input.evidenceRefs,
    observedAt: toIso(input.observedAt) ?? new Date().toISOString(),
    evidenceCutoff: toIso(input.evidenceCutoff),
    source: input.source,
    availability: input.availability ?? 'available',
    contributesToScore: input.contributesToScore ?? false,
    modelVersion: input.modelVersion ?? LEAD_FRAUD_MODEL_VERSION,
    featureVersion: input.featureVersion,
    shadow: input.shadow,
    proposedScoreDelta: input.proposedScoreDelta,
  }
}

export function toLegacyFinding(finding: AssessmentFinding): LeadFraudFinding {
  return { code: finding.code, detail: finding.detail }
}

export function parseAssessmentFindings(raw: unknown): AssessmentFinding[] {
  if (!Array.isArray(raw)) return []
  const out: AssessmentFinding[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<AssessmentFinding>
    const code = typeof row.code === 'string' ? row.code.trim() : ''
    const detail = typeof row.detail === 'string' ? row.detail.trim() : ''
    if (!code || !detail) continue
    out.push(
      createFinding({
        code,
        detail,
        subject:
          row.subject === 'visit' ||
          row.subject === 'submission' ||
          row.subject === 'related_group' ||
          row.subject === 'partner'
            ? row.subject
            : 'submission',
        severity:
          row.severity === 'low' ||
          row.severity === 'medium' ||
          row.severity === 'high' ||
          row.severity === 'info'
            ? row.severity
            : 'info',
        evidenceRefs: Array.isArray(row.evidenceRefs)
          ? row.evidenceRefs.filter((x): x is string => typeof x === 'string')
          : undefined,
        observedAt: row.observedAt,
        evidenceCutoff: row.evidenceCutoff,
        source: typeof row.source === 'string' ? row.source : 'legacy',
        availability:
          row.availability === 'unavailable' ||
          row.availability === 'unsupported' ||
          row.availability === 'available'
            ? row.availability
            : 'available',
        contributesToScore: Boolean(row.contributesToScore),
        modelVersion:
          typeof row.modelVersion === 'string'
            ? row.modelVersion
            : LEAD_FRAUD_MODEL_VERSION,
        featureVersion:
          typeof row.featureVersion === 'string'
            ? row.featureVersion
            : undefined,
        shadow: Boolean(row.shadow),
        proposedScoreDelta:
          typeof row.proposedScoreDelta === 'number'
            ? row.proposedScoreDelta
            : undefined,
      }),
    )
  }
  return out
}

export function shadowProposedDelta(findings: AssessmentFinding[]): number {
  return findings
    .filter((f) => f.shadow && typeof f.proposedScoreDelta === 'number')
    .reduce((sum, f) => sum + (f.proposedScoreDelta ?? 0), 0)
}
