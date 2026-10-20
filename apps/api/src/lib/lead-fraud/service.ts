import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
  type LeadSessionSignalRow,
} from './field-signals.js'
import { persistContactKeysFromSignals } from './contact-keys.js'
import { loadFiBehaviorBySessions } from './fi-batch.js'
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

function unavailableAssessment(): LeadFraudAssessment {
  return {
    score: null,
    scoreAvailable: false,
    label: 'fraud',
    effectiveLabel: 'fraud',
    coverage: 'insufficient',
    findings: [
      {
        code: 'scoring_unavailable',
        detail: 'Risk scoring temporarily unavailable',
      },
    ],
    reasons: ['Risk scoring temporarily unavailable'],
    modelVersion: LEAD_FRAUD_MODEL_VERSION,
  }
}


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
  return map.get(input.sessionId) ?? unavailableAssessment()
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

  const workspaceRows = await loadLeadSessionSignals({
    workspaceId: input.workspaceId,
  })
  const velocity = computeLeadVelocityMaps(workspaceRows)
  const bySession = new Map(
    workspaceRows.map((row) => [row.sessionId, row] as const),
  )

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

  const scoreRows = needScore
    .map((sid) => bySession.get(sid))
    .filter((row): row is LeadSessionSignalRow => Boolean(row))
  const fiMap = await loadFiBehaviorBySessions(
    scoreRows.map((row) => ({
      workspaceId: row.workspaceId,
      sessionId: row.sessionId,
    })),
  )

  const toPersist: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
    tenantWorkspaceId?: string
    phoneHash?: string
    emailHash?: string
  }> = []

  for (const sid of needScore) {
    const row = bySession.get(sid)
    if (!row) {
      out.set(sid, unavailableAssessment())
      continue
    }
    try {
      const fi = fiMap.get(sessionKey(row.workspaceId, row.sessionId)) ?? null
      const features = buildFeaturesFromLeadSessionSignal(row, velocity, fi)
      const assessment = scoreLeadFraud(features)
      out.set(sid, assessment)
      toPersist.push({
        workspaceId: input.workspaceId,
        sessionId: sid,
        assessment,
        features,
        tenantWorkspaceId: row.tenantWorkspaceId,
        phoneHash: row.phoneHash,
        emailHash: row.emailHash,
      })
    } catch {
      out.set(sid, unavailableAssessment())
    }
  }

  if (toPersist.length > 0) {
    try {
      await upsertLeadRiskBatch(toPersist)
    } catch {
      /* assessments still returned in-memory */
    }
  }

  try {
    await persistContactKeysFromSignals(scoreRows)
  } catch {
    /* contact keys are best-effort */
  }

  return out
}

export async function classifyLeadSessionRows(
  rows: LeadSessionSignalRow[],
): Promise<{
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
    tenantWorkspaceId?: string
    phoneHash?: string
    emailHash?: string
  }>
}> {
  const velocity = computeLeadVelocityMaps(rows)
  const fiMap = await loadFiBehaviorBySessions(
    rows.map((row) => ({
      workspaceId: row.workspaceId,
      sessionId: row.sessionId,
    })),
  )
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
    tenantWorkspaceId?: string
    phoneHash?: string
    emailHash?: string
  }> = []

  for (const row of rows) {
    const key = sessionKey(row.workspaceId, row.sessionId)
    try {
      const fi = fiMap.get(key) ?? null
      const features = buildFeaturesFromLeadSessionSignal(row, velocity, fi)
      if (features.email.includes('@')) emailByKey.set(key, features.email)
      const assessment = scoreLeadFraud(features)
      labelByKey.set(key, assessment.label)
      assessments.set(key, { assessment, features })
      toPersist.push({
        workspaceId: row.workspaceId,
        sessionId: row.sessionId,
        assessment,
        features,
        tenantWorkspaceId: row.tenantWorkspaceId,
        phoneHash: row.phoneHash,
        emailHash: row.emailHash,
      })
    } catch {
      /* skip failed row */
    }
  }

  try {
    await persistContactKeysFromSignals(rows)
  } catch {
    /* contact keys are best-effort */
  }

  return { labelByKey, emailByKey, assessments, toPersist }
}

export { upsertLeadRisk }
export type { LeadFraudAssessment }
export type { LeadFraudLabel } from './types.js'
