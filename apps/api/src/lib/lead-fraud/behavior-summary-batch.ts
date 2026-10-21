import { CLICKHOUSE_EVENTS_TABLE } from '../clickhouse-events-table.js'
import { chToDate } from '../analytics-timezone.js'
import { getClickHouseClient } from '../../services/clickhouse.service.js'

export type LeadBehaviorSummary = {
  reason: string
  observedAt: string
  visibleMs: number
  activeMs: number
  focusCount: number
  inputCount: number
  changeCount: number
  pasteCount: number
  autofillHints: number
  pointerCount: number
  touchCount: number
  keyboardCount: number
  trustedEventCount: number
  untrustedEventCount: number
  formStartAt: number | null
  formSubmitAt: number | null
  sdkInitMs: number | null
}

type CHJson<T> = { data: T[] }

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const nullableNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseBehaviorSummaryProps(
  raw: string,
  observedAt: string,
): LeadBehaviorSummary | null {
  let props: Record<string, unknown>
  try {
    props = JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return null
  }
  if (!props || typeof props !== 'object') return null
  if (props.visible_ms == null && props.active_ms == null) return null
  return {
    reason: typeof props.reason === 'string' ? props.reason : '',
    observedAt,
    visibleMs: num(props.visible_ms),
    activeMs: num(props.active_ms),
    focusCount: num(props.focus_count),
    inputCount: num(props.input_count),
    changeCount: num(props.change_count),
    pasteCount: num(props.paste_count),
    autofillHints: num(props.autofill_hints),
    pointerCount: num(props.pointer_count),
    touchCount: num(props.touch_count),
    keyboardCount: num(props.keyboard_count),
    trustedEventCount: num(props.trusted_event_count),
    untrustedEventCount: num(props.untrusted_event_count),
    formStartAt: nullableNum(props.form_start_at),
    formSubmitAt: nullableNum(props.form_submit_at),
    sdkInitMs: nullableNum(props.sdk_init_ms),
  }
}

/**
 * Latest behavior summary per session (the final "leave"/"submit" snapshot
 * carries cumulative totals). The optional window keeps the scan on the
 * partition key, with a day of slack so a summary sent just after the lead
 * window closed is still found.
 */
export async function loadBehaviorSummaryBySessions(input: {
  workspaceId: string
  sessionIds: string[]
  window?: { rangeFrom: string; rangeTo: string }
}): Promise<Map<string, LeadBehaviorSummary>> {
  const out = new Map<string, LeadBehaviorSummary>()
  const wid = input.workspaceId.trim()
  const sids = [...new Set(input.sessionIds.map((s) => s.trim()).filter(Boolean))]
  if (!wid || sids.length === 0) return out

  const windowSql = input.window
    ? ` AND event_date_et >= ${chToDate(`toDateTime64({range_from:String}, 3, 'UTC')`)} - 1` +
      ` AND event_date_et <= ${chToDate(`toDateTime64({range_to:String}, 3, 'UTC')`)} + 1`
    : ''
  const windowParams = input.window
    ? { range_from: input.window.rangeFrom, range_to: input.window.rangeTo }
    : {}

  const ch = getClickHouseClient()
  for (let i = 0; i < sids.length; i += 400) {
    const chunk = sids.slice(i, i + 400)
    const res = await ch.query({
      format: 'JSON',
      query_params: { wid, sids: chunk, ...windowParams },
      query: `
        SELECT
          session_id,
          argMax(properties, created_at) AS props,
          toString(max(created_at)) AS observed_at
        FROM ${CLICKHOUSE_EVENTS_TABLE}
        WHERE workspace_id = {wid:UUID}
          AND event_name = 'behavior_summary'
          AND session_id IN {sids:Array(String)}${windowSql}
        GROUP BY session_id
      `,
    })
    const rows =
      (
        (await res.json()) as CHJson<{
          session_id: string
          props: string
          observed_at: string
        }>
      ).data ?? []
    for (const row of rows) {
      const parsed = parseBehaviorSummaryProps(row.props, row.observed_at)
      if (parsed) out.set(row.session_id, parsed)
    }
  }
  return out
}
