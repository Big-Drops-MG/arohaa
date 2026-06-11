import { getClickHouseClient } from './clickhouse.service.js'
import type { AnalyticsSegments, RangeId } from '../types/analytics-segments.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round1((formSuccessSessions / sessions) * 100) : 0
}

function getInterval(rangeId: RangeId): string {
  if (rangeId === '24h') return '24 HOUR'
  if (rangeId === '7d') return '7 DAY'
  if (rangeId === '30d') return '30 DAY'
  if (rangeId === '3m') return '3 MONTH'
  if (rangeId === '12m') return '12 MONTH'
  return '24 MONTH'
}

const DOW_LABELS: Record<string, string> = {
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
}

function formatHour(hourStr: string | undefined): string {
  if (!hourStr) return '-'
  const hour = parseInt(hourStr, 10)
  if (isNaN(hour)) return '-'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour} ${suffix}`
}

function formatDevice(device: string): string {
  const normalized = device.trim().toLowerCase() || 'desktop'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export async function getAnalyticsSegments({
  workspaceId,
  rangeId,
}: {
  workspaceId: string
  rangeId: RangeId
}): Promise<AnalyticsSegments> {
  const ch = getClickHouseClient()
  const interval = getInterval(rangeId)
  const p = { wid: workspaceId }

  const [locationRes, deviceRes, dayRes, timeRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          if(city = '', 'Unknown', city) AS label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
        GROUP BY label
        ORDER BY visitors DESC
        LIMIT 20
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          lower(device) AS label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
        GROUP BY label
        ORDER BY visitors DESC
        LIMIT 20
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          toDayOfWeek(created_at, 1) AS label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
        GROUP BY label
        ORDER BY visitors DESC
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          toHour(created_at) AS label,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted
        FROM events
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
        GROUP BY label
        ORDER BY form_submitted DESC
        LIMIT 1
      `,
    }),
  ])

  type Row = {
    label: string
    visitors: string
    form_submitted: string
    sessions: string
  }

  const locationRows = ((await locationRes.json()) as CHJson<Row>).data ?? []
  const deviceRows = ((await deviceRes.json()) as CHJson<Row>).data ?? []
  const dayRows = ((await dayRes.json()) as CHJson<Row>).data ?? []
  const timeData = ((await timeRes.json()) as CHJson<{ label: string; form_submitted: string }>).data[0]

  const processRow = (row: Row, labelFormatter?: (val: string) => string) => {
    const fs = n(row.form_submitted)
    const ses = n(row.sessions)
    return {
      label: labelFormatter ? labelFormatter(row.label) : row.label,
      visitors: n(row.visitors),
      formSubmitted: fs,
      fsr: fsrPct(fs, ses),
    }
  }

  const performanceByLocation = locationRows.map(r => processRow(r))
  const performanceByDevice = deviceRows.map(r => processRow(r, formatDevice))
  const performanceByTime = dayRows.map(r => processRow(r, val => DOW_LABELS[val] || 'Unknown'))

  // Calculate Summary KPIs
  const topRegion = performanceByLocation[0]?.label ?? '-'
  const topDevice = performanceByDevice[0]?.label ?? '-'
  
  let bestDayRow = performanceByTime[0]
  if (bestDayRow) {
    for (const row of performanceByTime) {
      if (row.formSubmitted > bestDayRow.formSubmitted) {
        bestDayRow = row
      }
    }
  }
  const bestDay = bestDayRow?.label ?? '-'
  const bestTime = timeData ? formatHour(timeData.label) : '-'
  
  let highestFsr = 0
  const allRows = [...performanceByLocation, ...performanceByDevice, ...performanceByTime]
  for (const row of allRows) {
    if (row.fsr > highestFsr) {
      highestFsr = row.fsr
    }
  }

  return {
    summaryKpis: {
      topRegion,
      topDevice,
      bestDay,
      bestTime,
      highestFsr,
    },
    performanceByLocation,
    performanceByDevice,
    performanceByTime,
  }
}

export function emptyAnalyticsSegments(): AnalyticsSegments {
  return {
    summaryKpis: {
      topRegion: '-',
      topDevice: '-',
      bestDay: '-',
      bestTime: '-',
      highestFsr: 0,
    },
    performanceByLocation: [],
    performanceByDevice: [],
    performanceByTime: [],
  }
}
