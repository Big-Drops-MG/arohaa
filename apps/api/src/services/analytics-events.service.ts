import { getClickHouseClient } from './clickhouse.service.js'
import type { AnalyticsEvents, RangeId } from '../types/analytics-events.js'

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
}: {
  workspaceId: string
  rangeId: RangeId
}): Promise<AnalyticsEvents> {
  const ch = getClickHouseClient()
  const interval = getInterval(rangeId)
  
  const [kpiRes, dateRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: { wid: workspaceId },
      query: `
        SELECT
          count() AS total_events,
          countIf(event_name = 'zip_submit') AS zip_submit,
          countIf(event_name = 'call_click') AS call_click,
          countIf(event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: { wid: workspaceId },
      query: `
        SELECT 
          toDate(created_at) AS date_label,
          countIf(event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS total_sessions
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
        GROUP BY date_label
        ORDER BY date_label ASC
      `,
    }),
  ])

  type KpiRow = {
    total_events: string
    zip_submit: string
    call_click: string
    form_submitted: string
    total_sessions: string
  }
  
  type DateRow = {
    date_label: string
    form_submitted: string
    total_sessions: string
  }

  const kpiData = ((await kpiRes.json()) as CHJson<KpiRow>).data[0] ?? ({} as Partial<KpiRow>)
  const dateData = ((await dateRes.json()) as CHJson<DateRow>).data

  const totalEvents = n(kpiData.total_events)
  const zipSubmit = n(kpiData.zip_submit)
  const callClicks = n(kpiData.call_click)
  const formSubmitted = n(kpiData.form_submitted)
  const totalSessions = n(kpiData.total_sessions)

  const submissionRows = dateData.map(row => {
    const fs = n(row.form_submitted)
    const ses = n(row.total_sessions)
    return {
      date: row.date_label,
      formSubmitted: fs,
      fsr: fsrPct(fs, ses),
    }
  })

  // To display nice dates, let's format them
  const formattedSubmissionRows = submissionRows.map(row => {
    const d = new Date(row.date + 'T00:00:00Z')
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    return {
      ...row,
      date: formattedDate
    }
  })

  return {
    kpis: {
      totalEvents,
      zipSubmit,
      callClicks,
      formSubmitted,
      fsr: fsrPct(formSubmitted, totalSessions),
    },
    submissionRows: formattedSubmissionRows,
    pieSegments: [
      { name: 'ZIP Submit', value: zipSubmit },
      { name: 'Call Clicks', value: callClicks },
      { name: 'Form Submitted', value: formSubmitted },
    ]
  }
}

export function emptyAnalyticsEvents(): AnalyticsEvents {
  return {
    kpis: {
      totalEvents: 0,
      zipSubmit: 0,
      callClicks: 0,
      formSubmitted: 0,
      fsr: 0,
    },
    submissionRows: [],
    pieSegments: [
      { name: 'ZIP Submit', value: 0 },
      { name: 'Call Clicks', value: 0 },
      { name: 'Form Submitted', value: 0 },
    ],
  }
}
