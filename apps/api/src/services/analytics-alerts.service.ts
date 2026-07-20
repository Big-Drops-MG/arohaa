import { getClickHouseClient } from './clickhouse.service.js'
import type { RangeId } from '../types/analytics-experiments.js'
import type {
  AnalyticsAlertItem,
  AnalyticsAlertsResponse,
} from '../types/analytics-alerts.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  previousRangeQueryParams,
  rangeCacheKey,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
} from '../lib/analytics-range.js'
import {
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

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
  utmFilter,
  custom,
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsAlertsResponse> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const utmKey = utmFilter ? `${utmFilter.dimension}:${utmFilter.value}` : 'all'
  const cacheKey = `analytics:alerts:v2-abs:${workspaceId}:${lpPublicId}:${rangeCacheKey(window, utmKey)}`
  const cached = await readAnalyticsCache<AnalyticsAlertsResponse>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const utmSql = utmFilterSql(utmFilter)
  const p = {
    wid: workspaceId,
    lp: lpPublicId,
    ...rangeQueryParams(window),
    ...previousRangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }

  const res = await ch.query({
    format: 'JSON',
    query_params: p,
    query: `
      SELECT
        uniqExactIf(
          session_id,
          created_at >= toDateTime64({range_from:String}, 3, 'UTC') AND created_at < toDateTime64({range_to:String}, 3, 'UTC')
        ) AS current_sessions,
        uniqExactIf(
          session_id,
          event_name = 'form_success'
            AND created_at >= toDateTime64({range_from:String}, 3, 'UTC')
            AND created_at < toDateTime64({range_to:String}, 3, 'UTC')
        ) AS current_form_success,
        uniqExactIf(
          session_id,
          event_name = 'form_start'
            AND created_at >= toDateTime64({range_from:String}, 3, 'UTC')
            AND created_at < toDateTime64({range_to:String}, 3, 'UTC')
        ) AS current_form_starts,

        uniqExactIf(
          session_id,
          created_at >= toDateTime64({prev_from:String}, 3, 'UTC') AND created_at < toDateTime64({prev_to:String}, 3, 'UTC')
        ) AS prev_sessions,
        uniqExactIf(
          session_id,
          event_name = 'form_success'
            AND created_at >= toDateTime64({prev_from:String}, 3, 'UTC')
            AND created_at < toDateTime64({prev_to:String}, 3, 'UTC')
        ) AS prev_form_success,
        uniqExactIf(
          session_id,
          event_name = 'form_start'
            AND created_at >= toDateTime64({prev_from:String}, 3, 'UTC')
            AND created_at < toDateTime64({prev_to:String}, 3, 'UTC')
        ) AS prev_form_starts
      FROM events_raw
      WHERE workspace_id = {wid:UUID}
        AND lp_public_id = {lp:String}
        AND created_at >= toDateTime64({prev_from:String}, 3, 'UTC')
        AND created_at < toDateTime64({range_to:String}, 3, 'UTC')${utmSql}
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
    if (window.rangeId === '7d') {
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

  if (window.rangeId === 'last_month' && prevFS >= MIN_FORM_BASELINE) {
    const fsPct = Math.round(((curFS - prevFS) / prevFS) * 100)
    if (fsPct >= 10 && curFS > prevFS) {
      items.push({
        id: nextId(),
        message: `Best monthly hike: ${formatSignedPct(fsPct)} form submissions vs prior month`,
        date: today,
        severity: 'info',
      })
    }
  }

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

  const result = { items }
  await writeAnalyticsCache(cacheKey, result)
  return result
}

export function emptyAnalyticsAlerts(): AnalyticsAlertsResponse {
  return { items: [] }
}
