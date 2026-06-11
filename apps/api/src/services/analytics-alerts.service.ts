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
        -- Current Period
        uniqExactIf(session_id, created_at >= now() - INTERVAL ${current}) AS current_sessions,
        uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL ${current}) AS current_form_success,
        uniqExactIf(session_id, event_name = 'form_start' AND created_at >= now() - INTERVAL ${current}) AS current_form_starts,
        
        -- Previous Period
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
  
  // Create a predictable ID generator
  let idCounter = 1;
  const nextId = () => String(idCounter++)
  
  // Helper to format date
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // 1. Traffic Spike / Drop (20% threshold)
  if (prevSess > 10) {
    const diff = (curSess - prevSess) / prevSess
    if (diff > 0.2) {
      items.push({
        id: nextId(),
        message: `Traffic spike detected (+${Math.round(diff * 100)}% sessions)`,
        date: today,
        severity: "info"
      })
    } else if (diff < -0.2) {
      items.push({
        id: nextId(),
        message: `Traffic dropped significantly (-${Math.round(Math.abs(diff) * 100)}% sessions)`,
        date: today,
        severity: "warning"
      })
    }
  }

  // 2. FSR Drop (10% relative threshold)
  if (prevFSR > 0.05) { // Only alert if previous FSR was at least 5%
    const fsrDiff = (curFSR - prevFSR) / prevFSR
    if (fsrDiff < -0.1) {
      items.push({
        id: nextId(),
        message: `Form Submission Rate (FSR) dropped by ${Math.round(Math.abs(fsrDiff) * 100)}%`,
        date: today,
        severity: "warning"
      })
    }
  }

  // 3. Form Starts Drop (15% relative threshold)
  if (prevStarts > 5) {
    const startsDiff = (curStarts - prevStarts) / prevStarts
    if (startsDiff < -0.15) {
      items.push({
        id: nextId(),
        message: `Form starts decreased by ${Math.round(Math.abs(startsDiff) * 100)}%`,
        date: today,
        severity: "warning"
      })
    }
  }

  return { items }
}

export function emptyAnalyticsAlerts(): AnalyticsAlertsResponse {
  return { items: [] }
}
