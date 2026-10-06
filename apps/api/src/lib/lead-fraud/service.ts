import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import { extractLeadFraudFeatures } from './extract.js'
import {
  assessmentFromRiskRow,
  fetchLeadRiskRows,
  upsertLeadRisk,
} from './persist.js'
import { scoreLeadFraud } from './score.js'
import type { LeadFraudAssessment } from './types.js'

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

  const features = await extractLeadFraudFeatures(input)
  const assessment = scoreLeadFraud(features)
  await upsertLeadRisk({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    assessment,
    features,
  })
  return assessment
}

export async function ensureSessionsFraudAssessments(input: {
  workspaceId: string
  sessionIds: string[]
  concurrency?: number
}): Promise<Map<string, LeadFraudAssessment>> {
  const out = new Map<string, LeadFraudAssessment>()
  const ids = [...new Set(input.sessionIds.map((s) => s.trim()).filter(Boolean))]
  if (ids.length === 0) return out

  const existing = await fetchLeadRiskRows(input.workspaceId, ids)
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

  const concurrency = Math.max(1, Math.min(input.concurrency ?? 4, 8))
  let cursor = 0
  async function worker() {
    while (cursor < needScore.length) {
      const index = cursor++
      const sid = needScore[index]
      if (!sid) continue
      try {
        const assessment = await ensureSessionFraudAssessment({
          workspaceId: input.workspaceId,
          sessionId: sid,
        })
        out.set(sid, assessment)
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
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, needScore.length) }, () =>
      worker(),
    ),
  )
  return out
}

export type { LeadFraudAssessment }
export type { LeadFraudLabel } from './types.js'
