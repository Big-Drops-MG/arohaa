import {
  getClickHouseClient,
  LEAD_RISK_TABLE,
} from '../../services/clickhouse.service.js'
import {
  LEAD_FRAUD_MODEL_VERSION,
  isLeadFraudLabel,
  isLeadSignalCoverage,
} from './constants.js'
import type {
  LeadFraudAssessment,
  LeadFraudFeatures,
  LeadFraudFinding,
  LeadRiskRow,
  LeadSignalCoverage,
} from './types.js'

type CHJson<T> = { data: T[] }

function toChDateTime(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

function parseFindings(raw: unknown): LeadFraudFinding[] {
  if (!Array.isArray(raw)) return []
  const out: LeadFraudFinding[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as { code?: unknown; detail?: unknown }
    const code = typeof row.code === 'string' ? row.code.trim() : ''
    const detail = typeof row.detail === 'string' ? row.detail.trim() : ''
    if (!code || !detail) continue
    out.push({ code, detail })
  }
  return out
}

function coverageFromFeaturesJson(featuresJson: string): LeadSignalCoverage | null {
  try {
    const parsed = JSON.parse(featuresJson || '{}') as {
      coverage?: unknown
    }
    if (
      typeof parsed.coverage === 'string' &&
      isLeadSignalCoverage(parsed.coverage)
    ) {
      return parsed.coverage
    }
  } catch {
    /* ignore */
  }
  return null
}

export function assessmentFromRiskRow(
  row: LeadRiskRow | null | undefined,
): LeadFraudAssessment | null {
  if (!row) return null
  const label = isLeadFraudLabel(row.label) ? row.label : 'fraud'
  const overrideRaw = String(row.override_label || '').trim()
  const overrideLabel = isLeadFraudLabel(overrideRaw) ? overrideRaw : null
  const coverageCol = String(row.coverage || '').trim()
  const coverage: LeadSignalCoverage =
    (isLeadSignalCoverage(coverageCol) ? coverageCol : null) ||
    coverageFromFeaturesJson(row.features_json) ||
    'partial'
  const findings =
    parseFindings(
      (() => {
        try {
          return JSON.parse(row.findings_json || '[]')
        } catch {
          return []
        }
      })(),
    ) || []
  const scoreNum = Number(row.score)
  const scoreAvailable = coverage !== 'insufficient' && Number.isFinite(scoreNum)
  return {
    score: scoreAvailable ? Math.max(0, Math.min(100, Math.round(scoreNum))) : null,
    scoreAvailable,
    label,
    effectiveLabel: overrideLabel ?? label,
    coverage,
    findings,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    modelVersion: row.model_version || LEAD_FRAUD_MODEL_VERSION,
  }
}

export async function fetchLeadRiskRows(
  workspaceId: string,
  sessionIds: string[],
): Promise<Map<string, LeadRiskRow>> {
  const map = new Map<string, LeadRiskRow>()
  const ids = [...new Set(sessionIds.map((s) => s.trim()).filter(Boolean))]
  if (ids.length === 0) return map

  const ch = getClickHouseClient()
  try {
    const res = await ch.query({
      format: 'JSON',
      query_params: { wid: workspaceId, sids: ids },
      query: `
        SELECT
          toString(workspace_id) AS workspace_id,
          session_id,
          score,
          label,
          reasons,
          features_json,
          model_version,
          toString(scored_at) AS scored_at,
          override_label,
          override_by,
          toString(override_at) AS override_at,
          override_note,
          coverage,
          findings_json,
          tenant_workspace_id,
          phone_hash,
          email_hash
        FROM ${LEAD_RISK_TABLE} FINAL
        WHERE workspace_id = {wid:UUID}
          AND session_id IN {sids:Array(String)}
      `,
    })
    const rows = ((await res.json()) as CHJson<LeadRiskRow>).data ?? []
    for (const row of rows) {
      map.set(row.session_id, row)
    }
    return map
  } catch {
    try {
      const fallback = await ch.query({
        format: 'JSON',
        query_params: { wid: workspaceId, sids: ids },
        query: `
          SELECT
            toString(workspace_id) AS workspace_id,
            session_id,
            score,
            label,
            reasons,
            features_json,
            model_version,
            toString(scored_at) AS scored_at,
            override_label,
            override_by,
            toString(override_at) AS override_at,
            override_note
          FROM ${LEAD_RISK_TABLE} FINAL
          WHERE workspace_id = {wid:UUID}
            AND session_id IN {sids:Array(String)}
        `,
      })
      const rows = ((await fallback.json()) as CHJson<LeadRiskRow>).data ?? []
      for (const row of rows) {
        map.set(row.session_id, row)
      }
    } catch {
      /* return empty — caller will rescore */
    }
    return map
  }
}

export async function upsertLeadRisk(input: {
  workspaceId: string
  sessionId: string
  assessment: LeadFraudAssessment
  features: LeadFraudFeatures
  tenantWorkspaceId?: string
  phoneHash?: string
  emailHash?: string
}): Promise<void> {
  await upsertLeadRiskBatch([input])
}

export async function upsertLeadRiskBatch(
  inputs: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
    tenantWorkspaceId?: string
    phoneHash?: string
    emailHash?: string
  }>,
): Promise<void> {
  if (inputs.length === 0) return
  const ch = getClickHouseClient()
  const now = toChDateTime()

  const existingByKey = new Map<string, LeadRiskRow>()
  const byWorkspace = new Map<string, string[]>()
  for (const input of inputs) {
    const list = byWorkspace.get(input.workspaceId) ?? []
    list.push(input.sessionId)
    byWorkspace.set(input.workspaceId, list)
  }
  for (const [wid, sids] of byWorkspace) {
    const existing = await fetchLeadRiskRows(wid, sids)
    for (const [sid, row] of existing) {
      existingByKey.set(`${wid}:${sid}`, row)
    }
  }

  const rows: LeadRiskRow[] = inputs.map((input) => {
    const prev = existingByKey.get(
      `${input.workspaceId}:${input.sessionId}`,
    )
    const score =
      input.assessment.scoreAvailable && input.assessment.score != null
        ? input.assessment.score
        : 0
    return {
      workspace_id: input.workspaceId,
      session_id: input.sessionId,
      score,
      label: input.assessment.label,
      reasons: input.assessment.reasons,
      features_json: JSON.stringify({
        ...input.features,
        coverage: input.assessment.coverage,
      }),
      model_version: input.assessment.modelVersion,
      scored_at: now,
      override_label: prev?.override_label ?? '',
      override_by: prev?.override_by ?? '',
      override_at: prev?.override_at ?? '1970-01-01 00:00:00.000',
      override_note: prev?.override_note ?? '',
      coverage: input.assessment.coverage,
      findings_json: JSON.stringify(input.assessment.findings),
      tenant_workspace_id:
        input.tenantWorkspaceId?.trim() || prev?.tenant_workspace_id || '',
      phone_hash: input.phoneHash?.trim() || prev?.phone_hash || '',
      email_hash: input.emailHash?.trim() || prev?.email_hash || '',
    }
  })

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    await ch.insert({
      table: LEAD_RISK_TABLE,
      values: rows.slice(i, i + chunkSize),
      format: 'JSONEachRow',
    })
  }
}
