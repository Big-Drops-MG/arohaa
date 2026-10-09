import {
  getClickHouseClient,
  LEAD_RISK_TABLE,
} from '../../services/clickhouse.service.js'
import { LEAD_FRAUD_MODEL_VERSION, isLeadFraudLabel } from './constants.js'
import type {
  LeadFraudAssessment,
  LeadFraudFeatures,
  LeadRiskRow,
} from './types.js'

type CHJson<T> = { data: T[] }

function toChDateTime(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

export function assessmentFromRiskRow(
  row: LeadRiskRow | null | undefined,
): LeadFraudAssessment | null {
  if (!row) return null
  const label = isLeadFraudLabel(row.label) ? row.label : 'fraud'
  return {
    score: Number(row.score) || 0,
    label,
    effectiveLabel: label,
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
        override_note
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
}

export async function upsertLeadRisk(input: {
  workspaceId: string
  sessionId: string
  assessment: LeadFraudAssessment
  features: LeadFraudFeatures
}): Promise<void> {
  await upsertLeadRiskBatch([input])
}

export async function upsertLeadRiskBatch(
  inputs: Array<{
    workspaceId: string
    sessionId: string
    assessment: LeadFraudAssessment
    features: LeadFraudFeatures
  }>,
): Promise<void> {
  if (inputs.length === 0) return
  const ch = getClickHouseClient()
  const now = toChDateTime()
  const rows: LeadRiskRow[] = inputs.map((input) => ({
    workspace_id: input.workspaceId,
    session_id: input.sessionId,
    score: input.assessment.score,
    label: input.assessment.label,
    reasons: input.assessment.reasons,
    features_json: JSON.stringify(input.features),
    model_version: input.assessment.modelVersion,
    scored_at: now,
    override_label: '',
    override_by: '',
    override_at: '1970-01-01 00:00:00.000',
    override_note: '',
  }))

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    await ch.insert({
      table: LEAD_RISK_TABLE,
      values: rows.slice(i, i + chunkSize),
      format: 'JSONEachRow',
    })
  }
}
