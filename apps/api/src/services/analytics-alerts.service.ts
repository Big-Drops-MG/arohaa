import { getClickHouseClient } from './clickhouse.service.js'
import type { RangeId } from '../types/analytics-experiments.js'
import type {
  AnalyticsAlertItem,
  AnalyticsAlertsResponse,
} from '../types/analytics-alerts.js'

type CHJson<T> = { data: T[] }

function getIntervals(rangeId: RangeId): { current: string; previous: string } {
  if (rangeId === '24h') return { current: '24 HOUR', previous: '48 HOUR' }
  if (rangeId === '7d') return { current: '7 DAY', previous: '14 DAY' }
  if (rangeId === '30d') return { current: '30 DAY', previous: '60 DAY' }
  if (rangeId === '3m') return { current: '3 MONTH', previous: '6 MONTH' }
  if (rangeId === '12m') return { current: '12 MONTH', previous: '24 MONTH' }
  return { current: '24 MONTH', previous: '48 MONTH' }
}

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

/** Minimum prior-period sessions to show a percentage (avoids +14228% from tiny baselines). */
const MIN_SESSION_BASELINE = 50
const MIN_FORM_BASELINE = 20
const MAX_DISPLAY_PCT = 500

function relativeChangePct(cur: number, prev: number): number | null {
  if (prev < MIN_SESSION_BASELINE) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function formatSignedPct(pct: number): string {
  const capped = Math.max(-MAX_DISPLAY_PCT, Math.min(MAX_DISPLAY_PCT, pct))
  return capped >= 0 ? `+${capped}%` : `${capped}%`
}

export async function getAnalyticsAlerts({
  workspaceId,
  lpPublicId,
  rangeId,
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
}): Promise<AnalyticsAlertsResponse> {
  const ch = getClickHouseClient()
  const { current, previous } = getIntervals(rangeId)
  const p = { wid: workspaceId, lp: lpPublicId }

  const res = await ch.query({
    format: 'JSON',
    query_params: p,
    query: `
      SELECT
        uniqExactIf(session_id, created_at >= now() - INTERVAL ${current}) AS current_sessions,
        uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL ${current}) AS current_form_success,
        uniqExactIf(session_id, event_name = 'form_start' AND created_at >= now() - INTERVAL ${current}) AS current_form_starts,

        uniqExactIf(session_id, created_at >= now() - INTERVAL ${previous} AND created_at < now() - INTERVAL ${current}) AS prev_sessions,
        uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL ${previous} AND created_at < now() - INTERVAL ${current}) AS prev_form_success,
        uniqExactIf(session_id, event_name = 'form_start' AND created_at >= now() - INTERVAL ${previous} AND created_at < now() - INTERVAL ${current}) AS prev_form_starts
      FROM events
      WHERE workspace_id = {wid:UUID}
        AND lp_public_id = {lp:String}
        AND created_at >= now() - INTERVAL ${previous}
    `,
  })

  type Row = {
    current_sessions: string
    current_form_success: string
    current_form_starts: string
    prev_sessions: string
    prev_form_success: string
    prev_form_starts: string
  }

  const payload = (await res.json()) as CHJson<Row>
  const row = payload.data[0]

  if (!row) {
    return { items: [] }
  }

  const curSess = n(row.current_sessions)
  const curFS = n(row.current_form_success)
  const curStarts = n(row.current_form_starts)

  const prevSess = n(row.prev_sessions)
  const prevFS = n(row.prev_form_success)
  const prevStarts = n(row.prev_form_starts)

  const curFSR = curSess > 0 ? curFS / curSess : 0
  const prevFSR = prevSess > 0 ? prevFS / prevSess : 0

  const items: AnalyticsAlertItem[] = []

  let idCounter = 1
  const nextId = () => String(idCounter++)

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const sessPct = relativeChangePct(curSess, prevSess)
  const sessDelta = curSess - prevSess

  if (sessPct !== null && curSess > prevSess && sessPct >= 15) {
    if (rangeId === '7d') {
      items.push({
        id: nextId(),
        message: `Best weekly hike: ${formatSignedPct(sessPct)} sessions vs prior 7 days`,
        date: today,
        severity: 'info',
      })
    } else if (sessPct >= 20) {
      items.push({
        id: nextId(),
        message: `Traffic increased (${formatSignedPct(sessPct)} sessions)`,
        date: today,
        severity: 'info',
      })
    }
  } else if (sessPct !== null && sessPct <= -20) {
    items.push({
      id: nextId(),
      message: `Traffic dropped significantly (${formatSignedPct(sessPct)} sessions)`,
      date: today,
      severity: 'warning',
    })
  } else if (
    prevSess > 0 &&
    prevSess < MIN_SESSION_BASELINE &&
    sessDelta >= 100
  ) {
    items.push({
      id: nextId(),
      message: `Traffic increased significantly (+${sessDelta.toLocaleString('en-US')} sessions vs prior period)`,
      date: today,
      severity: 'info',
    })
  }

  if (rangeId === '30d' && prevFS >= MIN_FORM_BASELINE) {
    const fsPct = Math.round(((curFS - prevFS) / prevFS) * 100)
    if (fsPct >= 10 && curFS > prevFS) {
      items.push({
        id: nextId(),
        message: `Best monthly hike: ${formatSignedPct(fsPct)} form submissions vs prior 30 days`,
        date: today,
        severity: 'info',
      })
    }
  }

  // FSR drop (10% relative threshold)
  if (prevFSR > 0.05) {
    const fsrDiff = (curFSR - prevFSR) / prevFSR
    if (fsrDiff < -0.1) {
      items.push({
        id: nextId(),
        message: `Form Submission Rate (FSR) dropped by ${Math.round(Math.abs(fsrDiff) * 100)}%`,
        date: today,
        severity: 'warning',
      })
    }
  }

  // Form starts drop (15% relative threshold)
  if (prevStarts >= MIN_FORM_BASELINE) {
    const startsDiff = (curStarts - prevStarts) / prevStarts
    if (startsDiff < -0.15) {
      items.push({
        id: nextId(),
        message: `Form starts decreased by ${Math.round(Math.abs(startsDiff) * 100)}%`,
        date: today,
        severity: 'warning',
      })
    }
  }

  return { items }
}

export function emptyAnalyticsAlerts(): AnalyticsAlertsResponse {
  return { items: [] }
}
