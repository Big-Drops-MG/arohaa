import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { LEAD_FRAUD_MODEL_VERSION } from './constants.js'
import { ensureSessionsFraudAssessments } from './service.js'

type CHJson<T> = { data: T[] }

export type GeoLeadBackfillResult = {
  modelVersion: string
  dryRun: boolean
  workspaces: number
  sessions: number
  scored: number
  errors: number
  /** Present when a single-workspace run stopped early for paging. */
  nextAfterSessionId?: string
  done: boolean
  workspaceSummaries: Array<{
    workspaceId: string
    sessions: number
    firstAt: string
    lastAt: string
  }>
}

async function listWorkspaces(onlyWorkspace?: string): Promise<string[]> {
  if (onlyWorkspace?.trim()) return [onlyWorkspace.trim()]
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query: `
      SELECT DISTINCT toString(workspace_id) AS wid
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE event_name IN ('form_submit', 'form_success')
        AND session_id != ''
        AND (state_code != '' OR country_code != '' OR country != '')
      LIMIT 5000
    `,
  })
  const rows = ((await res.json()) as CHJson<{ wid: string }>).data ?? []
  return rows.map((r) => r.wid).filter(Boolean)
}

async function listGeoSubmitSessions(
  workspaceId: string,
  afterSessionId = '',
  limit = 200,
): Promise<{ sessionIds: string[]; minAt: string; maxAt: string }> {
  const ch = getClickHouseClient()
  const res = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      after: afterSessionId,
      lim: limit,
    },
    query: `
      SELECT
        session_id,
        toString(min(created_at)) AS min_at,
        toString(max(created_at)) AS max_at
      FROM ${CLICKHOUSE_EVENTS_TABLE}
      WHERE workspace_id = {wid:UUID}
        AND event_name IN ('form_submit', 'form_success')
        AND session_id != ''
        AND (state_code != '' OR country_code != '' OR country != '')
        AND session_id > {after:String}
      GROUP BY session_id
      ORDER BY session_id
      LIMIT {lim:UInt32}
    `,
  })
  const rows =
    (
      (await res.json()) as CHJson<{
        session_id: string
        min_at: string
        max_at: string
      }>
    ).data ?? []
  return {
    sessionIds: rows.map((r) => r.session_id),
    minAt: rows[0]?.min_at ?? '',
    maxAt: rows[rows.length - 1]?.max_at ?? '',
  }
}

/**
 * Re-score every form_submit/form_success session that has usable IP geo.
 * No calendar floor — coverage is “wherever IP geo exists”.
 */
export async function backfillGeoLeadFraudAssessments(input?: {
  workspaceId?: string
  dryRun?: boolean
  chunkSize?: number
  /** Resume cursor (exclusive) within a single workspace. */
  afterSessionId?: string
  /** Cap sessions processed in this invocation (for gateway-safe paging). */
  maxSessions?: number
  onProgress?: (line: string) => void
}): Promise<GeoLeadBackfillResult> {
  const dryRun = Boolean(input?.dryRun)
  const chunkSize = Math.max(20, Math.min(500, Math.floor(input?.chunkSize ?? 80)))
  const maxSessions = Math.max(
    chunkSize,
    Math.min(5_000, Math.floor(input?.maxSessions ?? 80)),
  )
  const log = input?.onProgress ?? (() => {})
  const workspaces = await listWorkspaces(input?.workspaceId)
  log(`workspaces=${workspaces.length} model=${LEAD_FRAUD_MODEL_VERSION} dryRun=${dryRun}`)

  let sessions = 0
  let scored = 0
  let errors = 0
  let nextAfterSessionId: string | undefined
  let done = true
  const workspaceSummaries: GeoLeadBackfillResult['workspaceSummaries'] = []

  for (const workspaceId of workspaces) {
    let after = input?.workspaceId ? (input.afterSessionId?.trim() ?? '') : ''
    let workspaceSessions = 0
    let firstAt = ''
    let lastAt = ''
    for (;;) {
      if (sessions >= maxSessions) {
        done = false
        nextAfterSessionId = after || undefined
        break
      }
      const take = Math.min(chunkSize, maxSessions - sessions)
      const page = await listGeoSubmitSessions(workspaceId, after, take)
      if (page.sessionIds.length === 0) break
      if (!firstAt && page.minAt) firstAt = page.minAt
      if (page.maxAt) lastAt = page.maxAt
      workspaceSessions += page.sessionIds.length
      sessions += page.sessionIds.length
      after = page.sessionIds[page.sessionIds.length - 1]!

      if (!dryRun) {
        try {
          const map = await ensureSessionsFraudAssessments({
            workspaceId,
            sessionIds: page.sessionIds,
            forceRescore: true,
            concurrency: 4,
          })
          scored += map.size
        } catch (err) {
          errors += 1
          log(
            `error workspace=${workspaceId} ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      if (page.sessionIds.length < take) break
      if (sessions >= maxSessions) {
        done = false
        nextAfterSessionId = after
        break
      }
    }
    workspaceSummaries.push({
      workspaceId,
      sessions: workspaceSessions,
      firstAt,
      lastAt,
    })
    log(
      `workspace=${workspaceId} sessions=${workspaceSessions}` +
        (firstAt ? ` range=${firstAt}..${lastAt}` : ''),
    )
    if (!done) break
  }

  return {
    modelVersion: LEAD_FRAUD_MODEL_VERSION,
    dryRun,
    workspaces: workspaces.length,
    sessions,
    scored,
    errors,
    nextAfterSessionId,
    done,
    workspaceSummaries,
  }
}
