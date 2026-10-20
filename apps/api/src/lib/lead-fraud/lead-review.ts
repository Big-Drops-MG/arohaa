import {
  getClickHouseClient,
  LEAD_REVIEW_AUDIT_TABLE,
  LEAD_REVIEW_TABLE,
} from '../../services/clickhouse.service.js'
import {
  claimLeadReviewRevision,
  releaseLeadReviewRevisionClaim,
  withLeadReviewLock,
} from './review-lock.js'
import type { LeadFraudAssessment } from './types.js'

type CHJson<T> = { data: T[] }

export type LeadReviewStatus = 'unreviewed' | 'in_review' | 'reviewed'
export type LeadAdminDecision =
  | ''
  | 'accepted'
  | 'follow_up_needed'
  | 'marked_duplicate'
  | 'marked_invalid'
export type LeadCallOutcome =
  | ''
  | 'no_answer'
  | 'wrong_number'
  | 'never_requested'
  | 'interested'
  | 'qualified'
  | 'converted'

export type LeadReviewHistoryEntry = {
  revision: number
  review_status: string
  decision: string
  decision_note: string
  decision_by: string
  decision_at: string
  call_outcome: string
  call_outcome_by: string
  call_outcome_at: string
  assessment_snapshot: string
  updated_at: string
}

export type LeadReviewRow = {
  tenant_workspace_id: string
  workspace_id: string
  session_id: string
  review_status: LeadReviewStatus
  decision: LeadAdminDecision
  decision_note: string
  decision_by: string
  decision_at: string
  call_outcome: LeadCallOutcome
  call_outcome_by: string
  call_outcome_at: string
  assessment_snapshot: string
  history_json: string
  revision: number
  updated_at: string
}

function toChDateTime(date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`
}

function isReviewStatus(v: string): v is LeadReviewStatus {
  return v === 'unreviewed' || v === 'in_review' || v === 'reviewed'
}

function isDecision(v: string): v is LeadAdminDecision {
  return (
    v === '' ||
    v === 'accepted' ||
    v === 'follow_up_needed' ||
    v === 'marked_duplicate' ||
    v === 'marked_invalid'
  )
}

function isOutcome(v: string): v is LeadCallOutcome {
  return (
    v === '' ||
    v === 'no_answer' ||
    v === 'wrong_number' ||
    v === 'never_requested' ||
    v === 'interested' ||
    v === 'qualified' ||
    v === 'converted'
  )
}

export async function fetchLeadReview(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
}): Promise<LeadReviewRow | null> {
  const tenant = input.tenantWorkspaceId.trim()
  if (!tenant) return null
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      tenant,
      wid: input.workspaceId,
      sid: input.sessionId,
    },
    query: `
      SELECT
        r.tenant_workspace_id AS tenant_workspace_id,
        toString(r.workspace_id) AS workspace_id,
        r.session_id AS session_id,
        r.review_status AS review_status,
        r.decision AS decision,
        r.decision_note AS decision_note,
        r.decision_by AS decision_by,
        toString(r.decision_at) AS decision_at,
        r.call_outcome AS call_outcome,
        r.call_outcome_by AS call_outcome_by,
        toString(r.call_outcome_at) AS call_outcome_at,
        r.assessment_snapshot AS assessment_snapshot,
        r.history_json AS history_json,
        r.revision AS revision,
        toString(r.updated_at) AS updated_at
      FROM ${LEAD_REVIEW_TABLE} AS r FINAL
      WHERE r.tenant_workspace_id = {tenant:String}
        AND r.workspace_id = {wid:UUID}
        AND r.session_id = {sid:String}
      LIMIT 1
    `,
  })
  const row = ((await res.json()) as CHJson<LeadReviewRow>).data?.[0]
  return row ?? null
}

async function fetchAuditHistory(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
}): Promise<LeadReviewHistoryEntry[]> {
  const ch = getClickHouseClient()
  try {
    const res = await ch.query({
      format: 'JSON',
      query_params: {
        tenant: input.tenantWorkspaceId,
        wid: input.workspaceId,
        sid: input.sessionId,
      },
      query: `
        SELECT
          revision,
          review_status,
          decision,
          decision_note,
          decision_by,
          toString(decision_at) AS decision_at,
          call_outcome,
          call_outcome_by,
          toString(call_outcome_at) AS call_outcome_at,
          assessment_snapshot,
          toString(recorded_at) AS updated_at
        FROM ${LEAD_REVIEW_AUDIT_TABLE}
        WHERE tenant_workspace_id = {tenant:String}
          AND workspace_id = {wid:UUID}
          AND session_id = {sid:String}
        ORDER BY revision ASC, recorded_at ASC
        LIMIT 500
      `,
    })
    return (
      ((await res.json()) as CHJson<LeadReviewHistoryEntry>).data ?? []
    )
  } catch {
    return []
  }
}

export async function fetchLeadReviewHistory(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
}): Promise<{
  current: LeadReviewRow | null
  history: LeadReviewHistoryEntry[]
}> {
  const current = await fetchLeadReview(input)
  const audit = await fetchAuditHistory(input)
  if (audit.length > 0) {
    return { current, history: audit }
  }
  try {
    const parsed = JSON.parse(current?.history_json || '[]') as unknown
    const history = Array.isArray(parsed)
      ? (parsed as LeadReviewHistoryEntry[])
      : []
    return { current, history }
  } catch {
    return { current, history: [] }
  }
}

async function appendAuditRow(row: {
  tenant_workspace_id: string
  workspace_id: string
  session_id: string
  revision: number
  review_status: string
  decision: string
  decision_note: string
  decision_by: string
  decision_at: string
  call_outcome: string
  call_outcome_by: string
  call_outcome_at: string
  assessment_snapshot: string
  recorded_at: string
}): Promise<void> {
  const ch = getClickHouseClient()
  await ch.insert({
    table: LEAD_REVIEW_AUDIT_TABLE,
    values: [row],
    format: 'JSONEachRow',
  })
}

export async function upsertLeadReview(input: {
  tenantWorkspaceId: string
  workspaceId: string
  sessionId: string
  reviewStatus?: LeadReviewStatus
  decision?: LeadAdminDecision
  decisionNote?: string
  decisionBy?: string
  callOutcome?: LeadCallOutcome
  callOutcomeBy?: string
  assessment?: LeadFraudAssessment | null
  expectedRevision?: number
}): Promise<LeadReviewRow> {
  const tenant = input.tenantWorkspaceId.trim()
  if (!tenant) {
    throw new Error('tenant_workspace_id required')
  }
  if (
    input.expectedRevision === undefined ||
    !Number.isFinite(input.expectedRevision)
  ) {
    throw new Error('review_revision_required: expectedRevision is required')
  }
  const expected = Number(input.expectedRevision)

  return withLeadReviewLock({
    tenantWorkspaceId: tenant,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    run: async () => {
      const existing = await fetchLeadReview({
        tenantWorkspaceId: tenant,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
      })

      if (!existing) {
        if (expected !== 0) {
          throw new Error(
            `review_revision_conflict: expected ${expected}, found 0 (no review yet)`,
          )
        }
      } else if (Number(existing.revision) !== expected) {
        throw new Error(
          `review_revision_conflict: expected ${expected}, found ${existing.revision}`,
        )
      }

      const revision = expected + 1
      const claim = await claimLeadReviewRevision({
        tenantWorkspaceId: tenant,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        nextRevision: revision,
      })
      if (claim === 'conflict') {
        throw new Error(
          `review_revision_conflict: revision ${revision} already claimed`,
        )
      }
      if (claim === 'unavailable') {
        throw new Error(
          'review_revision_conflict: concurrency control unavailable',
        )
      }

      const now = toChDateTime()
      const decision =
        input.decision !== undefined && isDecision(input.decision)
          ? input.decision
          : ((existing?.decision as LeadAdminDecision) ?? '')
      const callOutcome =
        input.callOutcome !== undefined && isOutcome(input.callOutcome)
          ? input.callOutcome
          : ((existing?.call_outcome as LeadCallOutcome) ?? '')
      let reviewStatus: LeadReviewStatus =
        input.reviewStatus && isReviewStatus(input.reviewStatus)
          ? input.reviewStatus
          : ((existing?.review_status as LeadReviewStatus) ?? 'unreviewed')
      if (
        !input.reviewStatus &&
        (decision || callOutcome) &&
        reviewStatus === 'unreviewed'
      ) {
        reviewStatus = 'reviewed'
      }

      const assessmentSnapshot = existing?.assessment_snapshot
        ? existing.assessment_snapshot
        : input.assessment
          ? JSON.stringify(input.assessment)
          : ''

      const row: LeadReviewRow = {
        tenant_workspace_id: tenant,
        workspace_id: input.workspaceId,
        session_id: input.sessionId,
        review_status: reviewStatus,
        decision,
        decision_note:
          input.decisionNote !== undefined
            ? input.decisionNote
            : (existing?.decision_note ?? ''),
        decision_by:
          input.decisionBy !== undefined
            ? input.decisionBy
            : (existing?.decision_by ?? ''),
        decision_at:
          input.decision !== undefined ? now : (existing?.decision_at ?? now),
        call_outcome: callOutcome,
        call_outcome_by:
          input.callOutcomeBy !== undefined
            ? input.callOutcomeBy
            : (existing?.call_outcome_by ?? ''),
        call_outcome_at:
          input.callOutcome !== undefined
            ? now
            : (existing?.call_outcome_at ?? now),
        assessment_snapshot: assessmentSnapshot,
        history_json: '[]',
        revision,
        updated_at: now,
      }

      try {
        await appendAuditRow({
          tenant_workspace_id: row.tenant_workspace_id,
          workspace_id: row.workspace_id,
          session_id: row.session_id,
          revision: row.revision,
          review_status: row.review_status,
          decision: row.decision,
          decision_note: row.decision_note,
          decision_by: row.decision_by,
          decision_at: row.decision_at,
          call_outcome: row.call_outcome,
          call_outcome_by: row.call_outcome_by,
          call_outcome_at: row.call_outcome_at,
          assessment_snapshot: row.assessment_snapshot,
          recorded_at: now,
        })

        const ch = getClickHouseClient()
        await ch.insert({
          table: LEAD_REVIEW_TABLE,
          values: [row],
          format: 'JSONEachRow',
        })
      } catch (err) {
        await releaseLeadReviewRevisionClaim({
          tenantWorkspaceId: tenant,
          workspaceId: input.workspaceId,
          sessionId: input.sessionId,
          nextRevision: revision,
        })
        throw err
      }

      return row
    },
  })
}

export async function countPendingReviews(tenantWorkspaceId?: string): Promise<{
  pending: number
  inReview: number
  reviewed: number
}> {
  const ch = getClickHouseClient()
  const tenant = tenantWorkspaceId?.trim() || ''
  const res = await ch.query({
    format: 'JSON',
    query_params: { tenant },
    query: `
      SELECT
        countIf(review_status = 'unreviewed') AS pending,
        countIf(review_status = 'in_review') AS in_review,
        countIf(review_status = 'reviewed') AS reviewed
      FROM ${LEAD_REVIEW_TABLE} FINAL
      WHERE {tenant:String} = '' OR tenant_workspace_id = {tenant:String}
    `,
  })
  const row = (
    (await res.json()) as CHJson<{
      pending: string
      in_review: string
      reviewed: string
    }>
  ).data?.[0]
  return {
    pending: Number(row?.pending ?? 0) || 0,
    inReview: Number(row?.in_review ?? 0) || 0,
    reviewed: Number(row?.reviewed ?? 0) || 0,
  }
}
