import {
  getClickHouseClient,
  LEAD_REVIEW_TABLE,
} from '../../services/clickhouse.service.js'
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
        tenant_workspace_id,
        toString(workspace_id) AS workspace_id,
        session_id,
        review_status,
        decision,
        decision_note,
        decision_by,
        toString(decision_at) AS decision_at,
        call_outcome,
        call_outcome_by,
        toString(call_outcome_at) AS call_outcome_at,
        assessment_snapshot,
        revision,
        toString(updated_at) AS updated_at
      FROM ${LEAD_REVIEW_TABLE} FINAL
      WHERE tenant_workspace_id = {tenant:String}
        AND workspace_id = {wid:UUID}
        AND session_id = {sid:String}
      LIMIT 1
    `,
  })
  const row = ((await res.json()) as CHJson<LeadReviewRow>).data?.[0]
  return row ?? null
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
}): Promise<LeadReviewRow> {
  const tenant = input.tenantWorkspaceId.trim()
  if (!tenant) {
    throw new Error('tenant_workspace_id required')
  }
  const existing = await fetchLeadReview({
    tenantWorkspaceId: tenant,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
  })
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
    assessment_snapshot: input.assessment
      ? JSON.stringify(input.assessment)
      : (existing?.assessment_snapshot ?? ''),
    revision: (Number(existing?.revision) || 0) + 1,
    updated_at: now,
  }

  const ch = getClickHouseClient()
  await ch.insert({
    table: LEAD_REVIEW_TABLE,
    values: [row],
    format: 'JSONEachRow',
  })
  return row
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
