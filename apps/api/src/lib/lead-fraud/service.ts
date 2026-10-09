import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
  type LeadSessionSignalRow,
} from './field-signals.js'
import { loadLeadSessionSignals } from './load-sessions.js'
import {
  assessmentFromRiskRow,
  fetchLeadRiskRows,
  upsertLeadRisk,
  upsertLeadRiskBatch,
} from './persist.js'
import { scoreLeadFraud } from './score.js'
import type { LeadFraudAssessment, LeadFraudFeatures } from './types.js'

function sessionKey(workspaceId: string, sessionId: string): string {
  return `${workspaceId}:${sessionId}`
}

/**
 * Score sessions with the same field-signal model as Warehouse so Data Leads
 * badges match warehouse Legit/Fraud counts for the same sessions.
 */
export async function ensureSessionFraudAssessment(input: {
  workspaceId: string
  sessionId: string
  forceRescore?: boolean
}): Promise<LeadFraudAssessment> {
  const existingMap = await fetchLeadRiskRows(input.workspaceId, [
    input.sessionId,
  ])
  const existing = existingMap.get(input.sessionId) ?? null
  if (
    existing &&
    !input.forceRescore &&
    existing.model_version === LEAD_FRAUD_MODEL_VERSION
  ) {
    const assessment = assessmentFromRiskRow(existing)
    if (assessment) return assessment
  }

  const map = await ensureSessionsFraudAssessments({
    workspaceId: input.workspaceId,
    sessionIds: [input.sessionId],
    forceRescore: input.forceRescore,
  })
  return (
    map.get(input.sessionId) ?? {
      score: 0,
      label: 'fraud',
      effectiveLabel: 'fraud',
      reasons: ['Risk scoring temporarily unavailable'],
      modelVersion: LEAD_FRAUD_MODEL_VERSION,
    }
  )
}

export async function ensureSessionsFraudAssessments(input: {
  workspaceId: string
  sessionIds: string[]
  concurrency?: number
  forceRescore?: boolean
}): Promise<Map<string, LeadFraudAssessment>> {
  const out = new Map<string, LeadFraudAssessment>()
  const ids = [
    ...new Set(input.sessionIds.map((s) => s.trim()).filter(Boolean)),
  ]
  if (ids.length === 0) return out

  const existing = input.forceRescore
    ? new Map()
    : await fetchLeadRiskRows(input.workspaceId, ids)
  const needScore: string[] = []
  for (const sid of ids) {
    const row = existing.get(sid)
    if (row && row.model_version === LEAD_FRAUD_MODEL_VERSION) {
      const assessment = assessmentFromRiskRow(row)
      if (assessment) {
        out.set(sid, assessment)
        continue
      }
    }
    needScore.push(sid)
  }

  if (needScore.length === 0) return out

  // Load all workspace lead sessions so velocity matches warehouse aggregates.
  const workspaceRows = await loadLeadSessionSignals({
    workspaceId: input.workspaceId,
  })
  const velocity = computeLeadVelocityMaps(workspaceRows)
  const bySession = new Map(
    workspaceRows.map((row) => [row.sessionId, row] as const),
  )

  // Any requested sessions missing from the bulk lead query still get scored.
  const missingIds = needScore.filter((sid) => !bySession.has(sid))
  if (missingIds.length > 0) {
    const extra = await loadLeadSessionSignals({
      workspaceId: input.workspaceId,
      sessionIds: missingIds,
    })
    for (const row of extra) {
      bySession.set(row.sessionId, row)
    }
  }

  const toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }> = []

  for (const sid of needScore) {
    const row = bySession.get(sid)
    if (!row) {
      out.set(sid, {
        score: 0,
        label: 'fraud',
        effectiveLabel: 'fraud',
        reasons: ['Risk scoring temporarily unavailable'],
        modelVersion: LEAD_FRAUD_MODEL_VERSION,
      })
      continue
    }
    try {
      const features = buildFeaturesFromLeadSessionSignal(row, velocity)
      const assessment = scoreLeadFraud(features)
      out.set(sid, assessment)
      toPersist.push({
        workspaceId: input.workspaceId,
        sessionId: sid,
        assessment,
        features,
      })
    } catch {
      out.set(sid, {
        score: 0,
        label: 'fraud',
        effectiveLabel: 'fraud',
        reasons: ['Risk scoring temporarily unavailable'],
        modelVersion: LEAD_FRAUD_MODEL_VERSION,
      })
    }
  }

  if (toPersist.length > 0) {
    try {
      await upsertLeadRiskBatch(toPersist)
    } catch {
      /* assessments still returned in-memory */
    }
  }

  return out
}

/** Classify a preloaded set of lead sessions (Warehouse path). */
export function classifyLeadSessionRows(rows: LeadSessionSignalRow[]): {
  labelByKey: Map<string, 'legit' | 'fraud'>
  emailByKey: Map<string, string>
  assessments: Map<
    string,
    {
      assessment: LeadFraudAssessment
      features: LeadFraudFeatures
    }
  >
  toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }>
} {
  const velocity = computeLeadVelocityMaps(rows)
  const labelByKey = new Map<string, 'legit' | 'fraud'>()
  const emailByKey = new Map<string, string>()
  const assessments = new Map<
    string,
    {
      assessment: LeadFraudAssessment
      features: LeadFraudFeatures
    }
  >()
  const toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }> = []

  for (const row of rows) {
    const key = sessionKey(row.workspaceId, row.sessionId)
    try {
      const features = buildFeaturesFromLeadSessionSignal(row, velocity)
      if (features.email.includes('@')) emailByKey.set(key, features.email)
      const assessment = scoreLeadFraud(features)
      labelByKey.set(key, assessment.label)
      assessments.set(key, { assessment, features })
      toPersist.push({
        workspaceId: row.workspaceId,
        sessionId: row.sessionId,
        assessment,
        features,
      })
    } catch {
      /* skip failed row */
    }
  }

  return { labelByKey, emailByKey, assessments, toPersist }
}

export { upsertLeadRisk }
export type { LeadFraudAssessment }
export type { LeadFraudLabel } from './types.js'
