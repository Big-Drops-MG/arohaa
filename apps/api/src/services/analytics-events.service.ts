import { getClickHouseClient } from './clickhouse.service.js'
import type { AnalyticsEvents, RangeId } from '../types/analytics-events.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  chDayBucketKey,
  formatAnalyticsCalendarDate,
  parseAnalyticsEtDayKey,
} from '../lib/analytics-timezone.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
} from '../lib/analytics-range.js'
import {
  utmFilterParams,
  utmFilterCacheKey,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function fsrPct(submitted: number, sessions: number): number {
  return sessions > 0 ? round1((submitted / sessions) * 100) : 0
}

export async function getAnalyticsEvents({
  workspaceId,
  rangeId,
  utmFilter,
  custom,
}: {
  workspaceId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsEvents> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const utmKey = utmFilterCacheKey(utmFilter)
  const cacheKey = `analytics:events:v4-services:${workspaceId}:${rangeCacheKey(window, utmKey)}`
  const cached = await readAnalyticsCache<AnalyticsEvents>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }

  const [kpiRes, dateRes, serviceRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          count() AS total_events,
          countIf(event_name = 'zip_submit') AS zip_submit,
          countIf(event_name = 'call_click') AS call_click,
          countIf(event_name = 'form_start') AS form_started,
          countIf(event_name IN ('form_success', 'service_click')) AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events_raw
        WHERE ${where}
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT 
          ${chDayBucketKey('created_at')} AS date_label,
          countIf(event_name = 'zip_submit') AS zip_submitted,
          countIf(event_name IN ('form_success', 'service_click')) AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events_raw
        WHERE ${where}
        GROUP BY date_label
        ORDER BY date_label ASC
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          nullIf(JSONExtractString(properties, 'service_id'), '') AS service_id,
          nullIf(JSONExtractString(properties, 'service_label'), '') AS service_label,
          uniqExact(session_id) AS clicks
        FROM events_raw
        WHERE ${where}
          AND event_name = 'service_click'
        GROUP BY service_id, service_label
        ORDER BY clicks DESC
        LIMIT 50
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

  type ServiceRow = {
    service_id: string
    service_label: string
    clicks: string
  }

  const kpiData = ((await kpiRes.json()) as CHJson<KpiRow>).data[0] ?? ({} as Partial<KpiRow>)
  const dateData = ((await dateRes.json()) as CHJson<DateRow>).data
  const serviceData = ((await serviceRes.json()) as CHJson<ServiceRow>).data

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

  const formattedSubmissionRows = submissionRows.map(row => {
    const d = parseAnalyticsEtDayKey(row.date)
    const formattedDate = formatAnalyticsCalendarDate(d)
    return {
      ...row,
      date: formattedDate
    }
  })

  const serviceRows = serviceData.map((row) => ({
    serviceId: row.service_id || 'unknown',
    serviceLabel: row.service_label || row.service_id || 'Unknown',
    clicks: n(row.clicks),
  }))

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
    ],
    serviceRows,
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
    serviceRows: [],
  }
}
