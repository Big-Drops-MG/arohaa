import { getClickHouseClient } from './clickhouse.service.js'
import type { AnalyticsEvents, RangeId } from '../types/analytics-events.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  chDayBucketKey,
  formatAnalyticsCalendarDate,
  parseAnalyticsEtDayKey,
} from '../lib/analytics-timezone.js'
import {
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function fsrPct(submitted: number, sessions: number): number {
  return sessions > 0 ? round1((submitted / sessions) * 100) : 0
}

function getInterval(rangeId: RangeId): string {
  if (rangeId === '24h') return '24 HOUR'
  if (rangeId === '7d') return '7 DAY'
  if (rangeId === '30d') return '30 DAY'
  if (rangeId === '3m') return '3 MONTH'
  if (rangeId === '12m') return '12 MONTH'
  return '24 MONTH'
}

export async function getAnalyticsEvents({
  workspaceId,
  rangeId,
  utmFilter,
}: {
  workspaceId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
}): Promise<AnalyticsEvents> {
  const cacheKey = `analytics:events:v2-et:${workspaceId}:${rangeId}:${utmFilter ? `${utmFilter.dimension}:${utmFilter.value}` : 'all'}`
  const cached = await readAnalyticsCache<AnalyticsEvents>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const interval = getInterval(rangeId)
  const utmSql = utmFilterSql(utmFilter)
  const p = { wid: workspaceId, ...utmFilterParams(utmFilter) }
  
  const [kpiRes, dateRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          count() AS total_events,
          countIf(event_name = 'zip_submit') AS zip_submit,
          countIf(event_name = 'call_click') AS call_click,
          countIf(event_name = 'form_start') AS form_started,
          countIf(event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events_raw
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}${utmSql}
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT 
          ${chDayBucketKey('created_at')} AS date_label,
          countIf(event_name = 'zip_submit') AS zip_submitted,
          countIf(event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events_raw
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}${utmSql}
        GROUP BY date_label
        ORDER BY date_label ASC
      `,
    }),
  ])

  type KpiRow = {
    total_events: string
    zip_submit: string
    call_click: string
    form_started: string
    form_submitted: string
    total_sessions: string
  }
  
  type DateRow = {
    date_label: string
    zip_submitted: string
    form_submitted: string
    total_sessions: string
  }

  const kpiData = ((await kpiRes.json()) as CHJson<KpiRow>).data[0] ?? ({} as Partial<KpiRow>)
  const dateData = ((await dateRes.json()) as CHJson<DateRow>).data

  const totalEvents = n(kpiData.total_events)
  const zipSubmit = n(kpiData.zip_submit)
  const callClicks = n(kpiData.call_click)
  const formStarted = n(kpiData.form_started)
  const formSubmitted = n(kpiData.form_submitted)
  const totalSessions = n(kpiData.total_sessions)

  const submissionRows = dateData.map((row) => {
    const zipSubmitted = n(row.zip_submitted)
    const formSubmittedCount = n(row.form_submitted)
    const sessions = n(row.total_sessions)
    return {
      date: row.date_label,
      zipSubmitted,
      formSubmitted: formSubmittedCount,
      fsr: fsrPct(formSubmittedCount, sessions),
      zsr: fsrPct(zipSubmitted, sessions),
    }
  })

  // To display nice dates, let's format them
  const formattedSubmissionRows = submissionRows.map(row => {
    const d = parseAnalyticsEtDayKey(row.date)
    const formattedDate = formatAnalyticsCalendarDate(d)
    return {
      ...row,
      date: formattedDate
    }
  })

  const result = {
    kpis: {
      totalEvents,
      zipSubmit,
      callClicks,
      formStarted,
      formSubmitted,
      fsr: fsrPct(formSubmitted, totalSessions),
      zsr: fsrPct(zipSubmit, totalSessions),
    },
    submissionRows: formattedSubmissionRows,
    pieSegments: [
      { name: 'ZIP Submit', value: zipSubmit },
      { name: 'Call Clicks', value: callClicks },
      { name: 'Form Submitted', value: formSubmitted },
    ]
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

export function emptyAnalyticsEvents(): AnalyticsEvents {
  return {
    kpis: {
      totalEvents: 0,
      zipSubmit: 0,
      callClicks: 0,
      formStarted: 0,
      formSubmitted: 0,
      fsr: 0,
      zsr: 0,
    },
    submissionRows: [],
    pieSegments: [
      { name: 'ZIP Submit', value: 0 },
      { name: 'Call Clicks', value: 0 },
      { name: 'Form Submitted', value: 0 },
    ],
  }
}
