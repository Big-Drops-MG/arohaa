import {
  getClickHouseClient,
  LEAD_REVIEW_TABLE,
  LEAD_RISK_TABLE,
} from '../../services/clickhouse.service.js'
import {
  loadRelatedContactMatches,
  type RelatedMatchBasis,
} from './contact-match.js'

type CHJson<T> = { data: T[] }

export type { RelatedMatchBasis }

export type RelatedSubmissionRow = {
  tenantWorkspaceId: string
  landingPageId: string
  sessionId: string
  eventId: string
  submittedAt: string
  utmSource: string
  utmS1: string
  utmCampaign: string
  firstName: string
  lastName: string
  emailMasked: string
  zip: string
  matchBasis: RelatedMatchBasis
  matchDegree: 'direct' | 'indirect'
  submissionKind: 'distinct' | 'likely_delivery_retry'
  conflicts: string[]
  trustScore: number | null
  scoreAvailable: boolean
  coverage: string
  reviewStatus: string
  decision: string
  callOutcome: string
}

export type RelatedSubmissionsResult = {
  status: 'ok' | 'unavailable' | 'no_keys' | 'no_tenant'
  tenantWorkspaceId: string
  sessionId: string
  landingPageId: string
  lookbackDays: number
  totalDirect: number
  totalIndirect: number
  truncated: boolean
  rows: RelatedSubmissionRow[]
  findings: Array<{ code: string; detail: string }>
}

export async function getRelatedSubmissions(input: {
  tenantWorkspaceId: string
  landingPageId: string
  sessionId: string
  lookbackDays?: number
  limit?: number
  offset?: number
}): Promise<RelatedSubmissionsResult> {
  const match = await loadRelatedContactMatches(input)
  const sessionIds = match.rows.map((r) => r.sessionId)
  const riskBySession = new Map<
    string,
    { score: number; coverage: string; scoreAvailable: boolean }
  >()
  const reviewBySession = new Map<
    string,
    { review_status: string; decision: string; call_outcome: string }
  >()

  if (sessionIds.length > 0 && match.status === 'ok') {
    const ch = getClickHouseClient()
    try {
      const riskRes = await ch.query({
        format: 'JSON',
        query_params: { sids: sessionIds },
        query: `
          SELECT session_id, score, coverage
          FROM ${LEAD_RISK_TABLE} FINAL
          WHERE session_id IN {sids:Array(String)}
        `,
      })
      for (const row of (
        (await riskRes.json()) as CHJson<{
          session_id: string
          score: number
          coverage: string
        }>
      ).data ?? []) {
        const coverage = row.coverage || 'partial'
        riskBySession.set(row.session_id, {
          score: Number(row.score) || 0,
          coverage,
          scoreAvailable: coverage !== 'insufficient',
        })
      }
    } catch {
      /* optional */
    }
    try {
      const revRes = await ch.query({
        format: 'JSON',
        query_params: {
          tenant: match.tenantWorkspaceId,
          sids: sessionIds,
        },
        query: `
          SELECT session_id, review_status, decision, call_outcome
          FROM ${LEAD_REVIEW_TABLE} FINAL
          WHERE tenant_workspace_id = {tenant:String}
            AND session_id IN {sids:Array(String)}
        `,
      })
      for (const row of (
        (await revRes.json()) as CHJson<{
          session_id: string
          review_status: string
          decision: string
          call_outcome: string
        }>
      ).data ?? []) {
        reviewBySession.set(row.session_id, row)
      }
    } catch {
      /* optional */
    }
  }

  return {
    status: match.status,
    tenantWorkspaceId: match.tenantWorkspaceId,
    sessionId: match.sessionId,
    landingPageId: match.landingPageId,
    lookbackDays: match.lookbackDays,
    totalDirect: match.totalDirect,
    totalIndirect: match.totalIndirect,
    truncated: match.truncated,
    findings: match.findings,
    rows: match.rows.map((r) => {
      const risk = riskBySession.get(r.sessionId)
      const review = reviewBySession.get(r.sessionId)
      return {
        tenantWorkspaceId: match.tenantWorkspaceId,
        landingPageId: r.landingPageId,
        sessionId: r.sessionId,
        eventId: r.eventId,
        submittedAt: r.submittedAt,
        utmSource: r.utmSource,
        utmS1: r.utmS1,
        utmCampaign: r.utmCampaign,
        firstName: r.firstName,
        lastName: r.lastName,
        emailMasked: r.emailMasked,
        zip: r.zip,
        matchBasis: r.matchBasis,
        matchDegree: r.matchDegree,
        submissionKind: 'distinct',
        conflicts: r.conflicts,
        trustScore: risk?.scoreAvailable ? risk.score : null,
        scoreAvailable: risk?.scoreAvailable ?? false,
        coverage: risk?.coverage || '',
        reviewStatus: review?.review_status || 'unreviewed',
        decision: review?.decision || '',
        callOutcome: review?.call_outcome || '',
      }
    }),
  }
}
