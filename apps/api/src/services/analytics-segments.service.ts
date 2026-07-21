import { getClickHouseClient } from './clickhouse.service.js'
import {
  DAY_ORDER,
  formatDayOfWeek,
} from '../lib/day-of-week.js'
import type { AnalyticsSegments, RangeId } from '../types/analytics-segments.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  ANALYTICS_DISPLAY_LOCALE,
  ANALYTICS_TIMEZONE,
  addAnalyticsEtDays,
  analyticsDayKey,
  chDayBucketKey,
  chToDayOfWeek,
  chToHour,
  formatAnalyticsSeriesMonthDay,
  startOfAnalyticsEtDay,
} from '../lib/analytics-timezone.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsWindow,
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

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round1((formSuccessSessions / sessions) * 100) : 0
}

type SegmentRow = {
  label: string
  date?: string
  visitors: number
  formSubmitted: number
  fsr: number
}

type DayAggRow = {
  label: string
  visitors: string
  form_submitted: string
  sessions: string
}

type CalendarDayAggRow = {
  bucket: string
  visitors: string
  form_submitted: string
  sessions: string
}

function aggregateByDayOfWeek(dayRows: DayAggRow[]): SegmentRow[] {
  const byDay = new Map<
    string,
    { visitors: number; formSubmitted: number; sessions: number }
  >()

  for (const row of dayRows) {
    const label = formatDayOfWeek(row.label)
    if (label === 'Unknown') continue
    const agg = byDay.get(label) ?? {
      visitors: 0,
      formSubmitted: 0,
      sessions: 0,
    }
    agg.visitors += n(row.visitors)
    agg.formSubmitted += n(row.form_submitted)
    agg.sessions += n(row.sessions)
    byDay.set(label, agg)
  }

  return DAY_ORDER.filter((day) => byDay.has(day))
    .map((label) => {
      const agg = byDay.get(label)!
      return {
        label,
        visitors: agg.visitors,
        formSubmitted: agg.formSubmitted,
        fsr: fsrPct(agg.formSubmitted, agg.sessions),
      }
    })
    .sort((a, b) => b.visitors - a.visitors || b.formSubmitted - a.formSubmitted)
}

function formatWeekdayName(date: Date): string {
  return new Intl.DateTimeFormat(ANALYTICS_DISPLAY_LOCALE, {
    timeZone: ANALYTICS_TIMEZONE,
    weekday: 'long',
  }).format(date)
}

/** Calendar-day series for day-granularity ranges (This Week, Last 7 Days, etc.). */
function buildPerformanceByCalendarDay(
  window: AnalyticsWindow,
  rows: CalendarDayAggRow[],
): SegmentRow[] {
  const agg = new Map<
    string,
    { visitors: number; formSubmitted: number; sessions: number }
  >()
  for (const row of rows) {
    const key = row.bucket.slice(0, 10)
    agg.set(key, {
      visitors: n(row.visitors),
      formSubmitted: n(row.form_submitted),
      sessions: n(row.sessions),
    })
  }

  const out: SegmentRow[] = []
  let cursor = startOfAnalyticsEtDay(window.start)
  while (cursor < window.seriesEnd) {
    const key = analyticsDayKey(cursor)
    const m = agg.get(key)
    out.push({
      label: formatWeekdayName(cursor),
      date: formatAnalyticsSeriesMonthDay(cursor),
      visitors: m?.visitors ?? 0,
      formSubmitted: m?.formSubmitted ?? 0,
      fsr: fsrPct(m?.formSubmitted ?? 0, m?.sessions ?? 0),
    })
    cursor = addAnalyticsEtDays(cursor, 1)
  }
  return out
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
  utmFilter,
  custom,
}: {
  workspaceId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsSegments> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const utmKey = utmFilterCacheKey(utmFilter)
  const cacheKey = `analytics:segments:v4-abs:${workspaceId}:${rangeCacheKey(window, utmKey)}`
  const cached = await readAnalyticsCache<AnalyticsSegments>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const useCalendarDays = window.granularity === 'day'

  const [locationRes, deviceRes, dayRes, calendarDayRes, timeRes] =
    await Promise.all([
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
        SELECT
          if(city = '', 'Unknown', city) AS label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events_raw
        WHERE ${where}
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
        FROM events_raw
        WHERE ${where}
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
          ${chToDayOfWeek('created_at', 1)} AS label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events_raw
        WHERE ${where}
        GROUP BY label
        ORDER BY visitors DESC
      `,
      }),
      useCalendarDays
        ? ch.query({
            format: 'JSON',
            query_params: p,
            query: `
            SELECT
              ${chDayBucketKey('created_at')} AS bucket,
              uniqExactIf(user_id, event_name = 'page_view') AS visitors,
              uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
              uniqExact(session_id) AS sessions
            FROM events_raw
            WHERE ${where}
            GROUP BY bucket
            ORDER BY bucket ASC
          `,
          })
        : Promise.resolve(null),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
        SELECT
          ${chToHour('created_at')} AS label,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted
        FROM events_raw
        WHERE ${where}
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
  const dayRows = ((await dayRes.json()) as CHJson<DayAggRow>).data ?? []
  const calendarDayRows = calendarDayRes
    ? (((await calendarDayRes.json()) as CHJson<CalendarDayAggRow>).data ?? [])
    : []
  const timeData = (
    (await timeRes.json()) as CHJson<{ label: string; form_submitted: string }>
  ).data[0]

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

  const performanceByLocation = locationRows.map((r) => processRow(r))
  const performanceByDevice = deviceRows.map((r) => processRow(r, formatDevice))
  const byDayOfWeek = aggregateByDayOfWeek(dayRows)
  const performanceByTime = useCalendarDays
    ? buildPerformanceByCalendarDay(window, calendarDayRows)
    : byDayOfWeek

  const topRegion = performanceByLocation[0]?.label ?? '-'
  const topDevice = performanceByDevice[0]?.label ?? '-'

  let bestDayRow = byDayOfWeek[0]
  if (bestDayRow) {
    for (const row of byDayOfWeek) {
      if (row.formSubmitted > bestDayRow.formSubmitted) {
        bestDayRow = row
      }
    }
  }
  const bestDay = bestDayRow?.label ?? '-'
  const bestTime = timeData ? formatHour(timeData.label) : '-'

  let highestFsr = 0
  const allRows = [
    ...performanceByLocation,
    ...performanceByDevice,
    ...performanceByTime,
  ]
  for (const row of allRows) {
    if (row.fsr > highestFsr) {
      highestFsr = row.fsr
    }
  }

  const result = {
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

  await writeAnalyticsCache(cacheKey, result)
  return result
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
