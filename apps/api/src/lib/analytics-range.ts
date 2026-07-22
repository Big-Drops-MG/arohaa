import {
  utmFilterSql,
  type AnalyticsUtmFilter,
} from './analytics-utm-filter.js'
import {
  addAnalyticsEtDays,
  analyticsDayKey,
  analyticsEtToUtcMs,
  analyticsMondayKey,
  getAnalyticsEtParts,
  parseAnalyticsEtDayKey,
  startOfAnalyticsEtDay,
} from './analytics-timezone.js'

export type AnalyticsRangeId =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | '7d'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom'

export const ANALYTICS_RANGE_IDS: readonly AnalyticsRangeId[] = [
  'today',
  'yesterday',
  'this_week',
  '7d',
  'last_week',
  'this_month',
  'last_month',
  'custom',
] as const

export const DEFAULT_ANALYTICS_RANGE_ID: AnalyticsRangeId = '7d'

export type AnalyticsCustomRange = {
  /** Inclusive ET calendar day YYYY-MM-DD */
  from: string
  /** Inclusive ET calendar day YYYY-MM-DD */
  to: string
}

export type AnalyticsGranularity = 'hour' | 'day' | 'week' | 'month'

export type AnalyticsWindow = {
  rangeId: AnalyticsRangeId
  /** Inclusive start (UTC instant). */
  start: Date
  /**
   * Exclusive end for data queries. Open-ended presets stop at `now`
   * so future hours/days are not queried.
   */
  end: Date
  /**
   * Exclusive end for chart/timeline buckets. Full calendar period
   * (e.g. Mon–Sun for this week, 24h for today) even when `end` is `now`.
   */
  seriesEnd: Date
  granularity: AnalyticsGranularity
  custom?: AnalyticsCustomRange
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_CUSTOM_SPAN_DAYS = 731

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isAnalyticsRangeId(value: string): value is AnalyticsRangeId {
  return (ANALYTICS_RANGE_IDS as readonly string[]).includes(value)
}

export function isAnalyticsDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false
  const parsed = parseAnalyticsEtDayKey(value)
  return analyticsDayKey(parsed) === value
}

export function parseAnalyticsCustomRange(
  from?: string | null,
  to?: string | null,
): AnalyticsCustomRange | undefined {
  const f = from?.trim()
  const t = to?.trim()
  if (!f || !t) return undefined
  if (!isAnalyticsDateKey(f) || !isAnalyticsDateKey(t)) return undefined
  if (f > t) return undefined
  const start = startOfAnalyticsEtDay(parseAnalyticsEtDayKey(f))
  const endExclusive = addAnalyticsEtDays(
    startOfAnalyticsEtDay(parseAnalyticsEtDayKey(t)),
    1,
  )
  const spanDays = (endExclusive.getTime() - start.getTime()) / DAY_MS
  if (spanDays > MAX_CUSTOM_SPAN_DAYS) return undefined
  return { from: f, to: t }
}

function startOfAnalyticsEtMonth(date: Date): Date {
  const { year, month } = getAnalyticsEtParts(date)
  return new Date(analyticsEtToUtcMs(year, month, 1, 0, 0, 0))
}

function granularityForSpanMs(spanMs: number): AnalyticsGranularity {
  const days = spanMs / DAY_MS
  if (days <= 2) return 'hour'
  if (days <= 45) return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/**
 * Resolve an absolute [start, end) query window and a full [start, seriesEnd)
 * chart span in Eastern Time.
 */
export function resolveAnalyticsWindow(
  rangeId: AnalyticsRangeId,
  now: Date = new Date(),
  custom?: AnalyticsCustomRange | null,
): AnalyticsWindow {
  if (rangeId === 'custom') {
    const parsed = custom ?? undefined
    if (!parsed) {
      return resolveAnalyticsWindow('7d', now)
    }
    const start = startOfAnalyticsEtDay(parseAnalyticsEtDayKey(parsed.from))
    const seriesEnd = addAnalyticsEtDays(
      startOfAnalyticsEtDay(parseAnalyticsEtDayKey(parsed.to)),
      1,
    )
    const end = minDate(seriesEnd, now)
    return {
      rangeId: 'custom',
      start,
      end,
      seriesEnd,
      granularity: granularityForSpanMs(seriesEnd.getTime() - start.getTime()),
      custom: parsed,
    }
  }

  if (rangeId === 'today') {
    // Calendar day: query [today 00:00, now); chart shows all 24 hours.
    const start = startOfAnalyticsEtDay(now)
    const seriesEnd = addAnalyticsEtDays(start, 1)
    return {
      rangeId,
      start,
      end: now,
      seriesEnd,
      granularity: 'hour',
    }
  }

  if (rangeId === 'yesterday') {
    // Full previous ET calendar day.
    const todayStart = startOfAnalyticsEtDay(now)
    const start = addAnalyticsEtDays(todayStart, -1)
    return {
      rangeId,
      start,
      end: todayStart,
      seriesEnd: todayStart,
      granularity: 'hour',
    }
  }

  if (rangeId === 'this_week') {
    // Mon 00:00 → now for queries; chart always Mon–Sun (7 days).
    const monday = startOfAnalyticsEtDay(
      parseAnalyticsEtDayKey(analyticsMondayKey(now)),
    )
    const seriesEnd = addAnalyticsEtDays(monday, 7)
    return {
      rangeId,
      start: monday,
      end: now,
      seriesEnd,
      granularity: 'day',
    }
  }

  if (rangeId === '7d') {
    // Last 7 calendar days including today (not rolling wall-clock 7×24h).
    const todayStart = startOfAnalyticsEtDay(now)
    const start = addAnalyticsEtDays(todayStart, -6)
    const seriesEnd = addAnalyticsEtDays(todayStart, 1)
    return {
      rangeId,
      start,
      end: now,
      seriesEnd,
      granularity: 'day',
    }
  }

  if (rangeId === 'last_week') {
    const thisMonday = startOfAnalyticsEtDay(
      parseAnalyticsEtDayKey(analyticsMondayKey(now)),
    )
    const start = addAnalyticsEtDays(thisMonday, -7)
    return {
      rangeId,
      start,
      end: thisMonday,
      seriesEnd: thisMonday,
      granularity: 'day',
    }
  }

  if (rangeId === 'this_month') {
    // Month start → now for queries; chart spans the full ET calendar month.
    const start = startOfAnalyticsEtMonth(now)
    const { year, month } = getAnalyticsEtParts(start)
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const seriesEnd = new Date(
      analyticsEtToUtcMs(nextYear, nextMonth, 1, 0, 0, 0),
    )
    return {
      rangeId,
      start,
      end: now,
      seriesEnd,
      granularity: 'day',
    }
  }

  // last_month — previous calendar month
  const thisMonthStart = startOfAnalyticsEtMonth(now)
  const { year, month } = getAnalyticsEtParts(thisMonthStart)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const start = new Date(analyticsEtToUtcMs(prevYear, prevMonth, 1, 0, 0, 0))
  return {
    rangeId: 'last_month',
    start,
    end: thisMonthStart,
    seriesEnd: thisMonthStart,
    granularity: 'day',
  }
}

/** Equal-length previous window immediately before the query window. */
export function previousAnalyticsWindow(
  window: AnalyticsWindow,
): { start: Date; end: Date } {
  const span = window.end.getTime() - window.start.getTime()
  return {
    start: new Date(window.start.getTime() - span),
    end: new Date(window.start.getTime()),
  }
}

/** ClickHouse DateTime64(3) literal-friendly UTC string. */
export function formatClickHouseDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

export function rangeQueryParams(window: AnalyticsWindow): {
  range_from: string
  range_to: string
} {
  return {
    range_from: formatClickHouseDateTime(window.start),
    range_to: formatClickHouseDateTime(window.end),
  }
}

export function previousRangeQueryParams(window: AnalyticsWindow): {
  prev_from: string
  prev_to: string
} {
  const prev = previousAnalyticsWindow(window)
  return {
    prev_from: formatClickHouseDateTime(prev.start),
    prev_to: formatClickHouseDateTime(prev.end),
  }
}

export function rangeFilter(utmFilter?: AnalyticsUtmFilter): string {
  return `workspace_id = {wid:UUID} AND created_at >= toDateTime64({range_from:String}, 3, 'UTC') AND created_at < toDateTime64({range_to:String}, 3, 'UTC')${utmFilterSql(utmFilter)}`
}

export function rangeLookbackFilter(utmFilter?: AnalyticsUtmFilter): string {
  return rangeFilter(utmFilter)
}

export function previousRangeFilter(utmFilter?: AnalyticsUtmFilter): string {
  return `workspace_id = {wid:UUID} AND created_at >= toDateTime64({prev_from:String}, 3, 'UTC') AND created_at < toDateTime64({prev_to:String}, 3, 'UTC')${utmFilterSql(utmFilter)}`
}

export function rangeCacheKey(
  window: AnalyticsWindow,
  utmKey = 'all',
): string {
  if (window.rangeId === 'custom' && window.custom) {
    return `custom:${window.custom.from}:${window.custom.to}:${utmKey}`
  }
  return `${window.rangeId}:${formatClickHouseDateTime(window.start)}:${formatClickHouseDateTime(window.end)}:${utmKey}`
}

/** @deprecated Prefer resolveAnalyticsWindow + rangeFilter(). */
export const RANGE_CLICKHOUSE_INTERVAL: Partial<
  Record<AnalyticsRangeId, string>
> = {
  '7d': '7 DAY',
}
