import {
  getClickHouseClient,
} from '../../services/clickhouse.service.js'
import type { VisitAssessment } from './visit-score.js'

export const VISIT_RISK_TABLE = 'visit_risk'

export async function ensureVisitRiskTable(): Promise<void> {
  const ch = getClickHouseClient()
  await ch.command({
    query: `
      CREATE TABLE IF NOT EXISTS ${VISIT_RISK_TABLE} (
          workspace_id UUID,
          session_id String,
          tenant_workspace_id String DEFAULT '',
          suspicious UInt8 DEFAULT 0,
          coverage LowCardinality(String) DEFAULT '',
          findings_json String DEFAULT '',
          reasons Array(String),
          shadow_score Nullable(UInt8),
          shadow_delta UInt16 DEFAULT 0,
          model_version LowCardinality(String),
          scored_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
          sdk_version LowCardinality(String) DEFAULT '',
          sdk_capabilities String DEFAULT ''
      ) ENGINE = ReplacingMergeTree(scored_at)
      ORDER BY (workspace_id, session_id)
    `,
  })
}

function toChDateTime(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

export async function upsertVisitRisk(input: {
  workspaceId: string
  sessionId: string
  tenantWorkspaceId?: string
  sdkVersion?: string
  sdkCapabilities?: string
  assessment: VisitAssessment
}): Promise<void> {
  await ensureVisitRiskTable()
  const ch = getClickHouseClient()
  await ch.insert({
    table: VISIT_RISK_TABLE,
    values: [
      {
        workspace_id: input.workspaceId,
        session_id: input.sessionId,
        tenant_workspace_id: input.tenantWorkspaceId ?? '',
        suspicious: input.assessment.suspiciousVisit ? 1 : 0,
        coverage: input.assessment.coverage,
        findings_json: JSON.stringify(input.assessment.findings),
        reasons: input.assessment.reasons,
        shadow_score: input.assessment.shadowScore,
        shadow_delta: input.assessment.shadowProposedDelta,
        model_version: input.assessment.modelVersion,
        scored_at: toChDateTime(),
        sdk_version: input.sdkVersion ?? '',
        sdk_capabilities: input.sdkCapabilities ?? '',
      },
    ],
    format: 'JSONEachRow',
  })
}
