import { getClickHouseClient } from '../../services/clickhouse.service.js'
import { chToDate } from '../analytics-timezone.js'
import { SESSION_ROLLUP } from '../session-rollup-sql.js'

export type SessionEventWindow = { fromDay: string; toDay: string }


export async function resolveSessionEventWindow(input: {
  workspaceId: string
  sessionId: string
}): Promise<SessionEventWindow | null> {
  const workspaceId = input.workspaceId.trim()
  const sessionId = input.sessionId.trim()
  if (!workspaceId || !sessionId) return null
  try {
    const ch = getClickHouseClient()
    const res = await ch.query({
      query: `
        SELECT
          toString(${chToDate('first_at')} - 1) AS from_day,
          toString(${chToDate('last_at')} + 1) AS to_day
        FROM ${SESSION_ROLLUP}
        WHERE workspace_id = {workspaceId:UUID}
          AND session_id = {sessionId:String}
        LIMIT 1
      `,
      query_params: { workspaceId, sessionId },
      format: 'JSON',
    })
    const row = ((await res.json()) as { data: Array<{ from_day: string; to_day: string }> })
      .data?.[0]
    if (!row?.from_day || !row?.to_day) return null
    return { fromDay: row.from_day, toDay: row.to_day }
  } catch {
    return null
  }
}

export function sessionWindowSql(window: SessionEventWindow | null): string {
  return window
    ? ' AND event_date_et >= {win_from:Date} AND event_date_et <= {win_to:Date}'
    : ''
}

export function sessionWindowParams(
  window: SessionEventWindow | null,
): Record<string, string> {
  return window ? { win_from: window.fromDay, win_to: window.toDay } : {}
}
