import {
  ASSESSMENT_MAX_AGE_MS,
  LEAD_FRAUD_MODEL_VERSION,
} from './constants.js'
import {
  buildFeaturesFromLeadSessionSignal,
  computeLeadVelocityMaps,
  type LeadSessionSignalRow,
} from './field-signals.js'
import { loadContactRiskSignals } from './contact-risk.js'
import { persistContactKeysFromSignals } from './contact-keys.js'
import { loadFiBehaviorBySessions } from './fi-batch.js'
import {
  loadLeadSessionSignals,
  loadVelocityNeighborRows,
} from './load-sessions.js'
import {
  assessmentFromRiskRow,
  fetchLeadRiskRows,
  upsertLeadRisk,
  upsertLeadRiskBatch,
} from './persist.js'
import {
  behaviorEvidenceToken,
  composeEvidenceToken,
  networkEvidenceToken,
  shadowEvidenceToken,
} from './evidence-token.js'
import { getNetworkDatasetFingerprint } from '../../services/network-classify.service.js'
import { loadSessionShadowEvidence } from './session-evidence-load.js'
import { scoreLeadFraud } from './score.js'
import { enqueueVisitAssessment } from './visit-assess-queue.js'
import type {
  LeadFraudAssessment,
  LeadFraudFeatures,
  LeadRiskRow,
} from './types.js'

const VELOCITY_LOOKBACK_PAD_MS = 24 * 60 * 60_000
const VELOCITY_DOMAIN_SAMPLE_LIMIT = 1500

function sessionKey(workspaceId: string, sessionId: string): string {
  return `${workspaceId}:${sessionId}`
}

function parseScoredAtMs(raw: string): number {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes('T')
    ? trimmed
    : `${trimmed.replace(' ', 'T')}${trimmed.includes('Z') ? '' : 'Z'}`
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : 0
}

function evidenceTokenFromFeaturesJson(featuresJson: string): string {
  try {
    const parsed = JSON.parse(featuresJson || '{}') as {
      evidenceToken?: unknown
    }
    return typeof parsed.evidenceToken === 'string' ? parsed.evidenceToken : ''
  } catch {
    return ''
  }
}

function canReuseAssessment(
  row: LeadRiskRow | null | undefined,
  currentEvidenceToken?: string,
): boolean {
  if (!row) return false
  if (row.model_version !== LEAD_FRAUD_MODEL_VERSION) return false
  const scoredAt = parseScoredAtMs(row.scored_at)
  if (!scoredAt) return false
  if (Date.now() - scoredAt > ASSESSMENT_MAX_AGE_MS) return false
  const priorAssessment = assessmentFromRiskRow(row)
  if (
    !priorAssessment ||
    !priorAssessment.scoreAvailable ||
    priorAssessment.coverage === 'insufficient'
  ) {
    return false
  }
  if (currentEvidenceToken) {
    const prior = evidenceTokenFromFeaturesJson(row.features_json)
    if (!prior || prior !== currentEvidenceToken) return false
  }
  return true
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

  try {
    let existing = new Map<string, LeadRiskRow>()
    if (!input.forceRescore) {
      try {
        existing = await fetchLeadRiskRows(input.workspaceId, ids)
      } catch (err) {
        console.error('[lead-fraud] fetchLeadRiskRows failed', err)
      }
    }

    let targetRows: LeadSessionSignalRow[] = []
    try {
      targetRows = await loadLeadSessionSignals({
        workspaceId: input.workspaceId,
        sessionIds: ids,
      })
    } catch (err) {
      console.error('[lead-fraud] loadLeadSessionSignals failed', err)
      targetRows = []
    }
    const bySession = new Map(
      targetRows.map((row) => [row.sessionId, row] as const),
    )

    let velocityRows = targetRows
    let velocityWindowKnown = false
    if (targetRows.length > 0) {
      const submitTimes = targetRows
        .map((row) => row.submittedAtMs)
        .filter((ms) => ms > 0)
      const minMs = submitTimes.length ? Math.min(...submitTimes) : Date.now()
      const maxMs = submitTimes.length ? Math.max(...submitTimes) : Date.now()
      try {
        const window = {
          workspaceId: input.workspaceId,
          createdFromMs: minMs - VELOCITY_LOOKBACK_PAD_MS,
          createdToMs: maxMs + VELOCITY_LOOKBACK_PAD_MS,
        }
        const [neighbors, recentSubmits] = await Promise.all([
          loadVelocityNeighborRows({
            ...window,
            fingerprints: targetRows.map((row) => row.fingerprint),
            ipHashes: targetRows.map((row) => row.clientIpHash),
          }),
          loadLeadSessionSignals({
            ...window,
            limit: VELOCITY_DOMAIN_SAMPLE_LIMIT,
            newestFirst: true,
            withIpBackfill: false,
          }),
        ])
        const bySid = new Map(
          targetRows.map((row) => [row.sessionId, row] as const),
        )
        for (const row of recentSubmits) {
          if (!bySid.has(row.sessionId)) bySid.set(row.sessionId, row)
        }
        for (const row of neighbors) {
          if (!bySid.has(row.sessionId)) bySid.set(row.sessionId, row)
        }
        velocityRows = [...bySid.values()]
        velocityWindowKnown = true
      } catch (err) {
        console.error('[lead-fraud] velocity lookback failed', err)
        velocityRows = targetRows
        velocityWindowKnown = false
      }
    }
    const velocity = computeLeadVelocityMaps(velocityRows)

    const signalRows = ids
      .map((sid) => bySession.get(sid))
      .filter((row): row is LeadSessionSignalRow => Boolean(row))
    const fiMap = await loadFiBehaviorBySessions(
      signalRows.map((row) => ({
        workspaceId: row.workspaceId,
        sessionId: row.sessionId,
      })),
    )

    const needScore: string[] = []
    const contactBySid = new Map<
      string,
      Awaited<ReturnType<typeof loadContactRiskSignals>>
    >()
    const REUSE_CONCURRENCY = 8
    for (let i = 0; i < ids.length; i += REUSE_CONCURRENCY) {
      const chunk = ids.slice(i, i + REUSE_CONCURRENCY)
      const chunkNeed: string[] = []
      await Promise.all(
        chunk.map(async (sid) => {
          try {
            const row = existing.get(sid)
            const signal = bySession.get(sid)
            if (!signal) {
              chunkNeed.push(sid)
              return
            }
            const contact = await loadContactRiskSignals({
              tenantWorkspaceId: signal.tenantWorkspaceId,
              landingPageId: signal.workspaceId,
              sessionId: sid,
              matchLimit: 100,
            })
            contactBySid.set(sid, contact)
            const fi =
              fiMap.get(sessionKey(signal.workspaceId, sid)) ?? null
            const shadowEvidence = await loadSessionShadowEvidence({
              workspaceId: signal.workspaceId,
              sessionId: sid,
            }).catch(() => null)
            const evidenceToken = composeEvidenceToken(
              contact.evidenceToken,
              behaviorEvidenceToken(fi),
              shadowEvidenceToken(
                [
                  ...(shadowEvidence?.integrityFindings ?? []),
                  ...(shadowEvidence?.browserFindings ?? []),
                  ...(shadowEvidence?.pageIntegrityFindings ?? []),
                ],
                shadowEvidence?.stableEvidenceKey,
              ),
              networkEvidenceToken(getNetworkDatasetFingerprint()),
            )
            if (
              !input.forceRescore &&
              row &&
              canReuseAssessment(row, evidenceToken)
            ) {
              const assessment = assessmentFromRiskRow(row)
              if (assessment) {
                out.set(sid, assessment)
                return
              }
            }
            chunkNeed.push(sid)
          } catch {
            chunkNeed.push(sid)
          }
        }),
      )
      needScore.push(...chunkNeed)
    }

    if (needScore.length === 0) return out

    const scoreRows = needScore
      .map((sid) => bySession.get(sid))
      .filter((row): row is LeadSessionSignalRow => Boolean(row))

    const toPersist: Array<{
      workspaceId: string
      sessionId: string
      assessment: LeadFraudAssessment
      features: LeadFraudFeatures
      tenantWorkspaceId?: string
      phoneHash?: string
      emailHash?: string
    }> = []

    const SCORE_CONCURRENCY = 8
    for (let i = 0; i < needScore.length; i += SCORE_CONCURRENCY) {
      const chunk = needScore.slice(i, i + SCORE_CONCURRENCY)
      await Promise.all(
        chunk.map(async (sid) => {
          const row = bySession.get(sid)
          if (!row) {
            out.set(sid, unavailableAssessment())
            return
          }
          try {
            const fi =
              fiMap.get(sessionKey(row.workspaceId, row.sessionId)) ?? null
            const features = buildFeaturesFromLeadSessionSignal(
              row,
              velocity,
              fi,
            )
            features.velocityWindowKnown = velocityWindowKnown
            const contact =
              contactBySid.get(sid) ??
              (await loadContactRiskSignals({
                tenantWorkspaceId: row.tenantWorkspaceId,
                landingPageId: row.workspaceId,
                sessionId: sid,
                matchLimit: 100,
              }))
            Object.assign(features, contact)
            const shadowEvidence = await loadSessionShadowEvidence({
              workspaceId: row.workspaceId,
              sessionId: sid,
            }).catch(() => null)
            features.shadowExtraFindings = [
              ...(shadowEvidence?.integrityFindings ?? []),
              ...(shadowEvidence?.browserFindings ?? []),
              ...(shadowEvidence?.pageIntegrityFindings ?? []),
            ]
            features.sdkVersion = shadowEvidence?.sdkVersion ?? ''
            features.sdkCapabilities = shadowEvidence?.sdkCapabilities ?? ''
            if (
              shadowEvidence?.evidenceCutoffMs &&
              shadowEvidence.evidenceCutoffMs > features.evidenceCutoffMs
            ) {
              features.evidenceCutoffMs = shadowEvidence.evidenceCutoffMs
            }
            features.evidenceToken = composeEvidenceToken(
              contact.evidenceToken,
              behaviorEvidenceToken(fi),
              shadowEvidenceToken(
                features.shadowExtraFindings,
                shadowEvidence?.stableEvidenceKey,
              ),
              networkEvidenceToken(getNetworkDatasetFingerprint()),
            )
            const assessment = scoreLeadFraud(features)
            out.set(sid, assessment)
            void enqueueVisitAssessment({
              workspaceId: row.workspaceId,
              sessionId: sid,
              tenantWorkspaceId: row.tenantWorkspaceId,
              reason: 'lead_score',
            })
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
        }),
      )
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
  } catch (err) {
    console.error('[lead-fraud] ensureSessionsFraudAssessments failed', err)
    for (const sid of ids) {
      if (!out.has(sid)) out.set(sid, unavailableAssessment())
    }
    return out
  }
}

export async function classifyLeadSessionRows(
  rows: LeadSessionSignalRow[],
  options?: { onlyKeys?: Set<string> },
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
  const onlyKeys = options?.onlyKeys
  const targetRows = onlyKeys
    ? rows.filter((row) => onlyKeys.has(sessionKey(row.workspaceId, row.sessionId)))
    : rows
  const fiMap = await loadFiBehaviorBySessions(
    targetRows.map((row) => ({
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

  const CONTACT_CONCURRENCY = 8
  for (let i = 0; i < targetRows.length; i += CONTACT_CONCURRENCY) {
    const chunk = targetRows.slice(i, i + CONTACT_CONCURRENCY)
    await Promise.all(
      chunk.map(async (row) => {
        const key = sessionKey(row.workspaceId, row.sessionId)
        try {
          const fi = fiMap.get(key) ?? null
          const features = buildFeaturesFromLeadSessionSignal(row, velocity, fi)
          const contact = await loadContactRiskSignals({
            tenantWorkspaceId: row.tenantWorkspaceId,
            landingPageId: row.workspaceId,
            sessionId: row.sessionId,
            matchLimit: 100,
          })
          Object.assign(features, contact)
          features.evidenceToken = composeEvidenceToken(
            contact.evidenceToken,
            behaviorEvidenceToken(fi),
            '',
            networkEvidenceToken(getNetworkDatasetFingerprint()),
          )
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
      }),
    )
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
