import {
  hasAnalyticsUtmFilter,
  normalizeAnalyticsUtmFilter,
  type AnalyticsUtmFilter,
} from './analytics-utm-filter.js'
import { chToDate } from './analytics-timezone.js'

export const SESSION_ROLLUP = 'session_rollup FINAL'
export const DAILY_METRICS = 'daily_metrics'

export function canUseSessionRollup(utmFilter?: AnalyticsUtmFilter): boolean {
  return !normalizeAnalyticsUtmFilter(utmFilter)?.segmentSql
}

export function canUseDailyMetrics(
  granularity: string,
  utmFilter?: AnalyticsUtmFilter,
): boolean {
  return granularity !== 'hour' && !hasAnalyticsUtmFilter(utmFilter)
}

function rollupUtmSql(utmFilter?: AnalyticsUtmFilter): string {
  const normalized = normalizeAnalyticsUtmFilter(utmFilter)
  if (!normalized) return ''
  const parts: string[] = []
  if (normalized.utm_source?.length) parts.push('utm_source IN {utm_sources:Array(String)}')
  if (normalized.utm_s1?.length) parts.push('utm_s1 IN {utm_s1s:Array(String)}')
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

/** Sessions whose first event falls inside the window (same params as rangeFilter). */
export function sessionRollupRangeFilter(
  utmFilter?: AnalyticsUtmFilter,
  fromParam = 'range_from',
  toParam = 'range_to',
): string {
  return (
    `workspace_id = {wid:UUID}` +
    ` AND first_at >= toDateTime64({${fromParam}:String}, 3, 'UTC')` +
    ` AND first_at < toDateTime64({${toParam}:String}, 3, 'UTC')` +
    rollupUtmSql(utmFilter)
  )
}

export function sessionRollupPreviousRangeFilter(utmFilter?: AnalyticsUtmFilter): string {
  return sessionRollupRangeFilter(utmFilter, 'prev_from', 'prev_to')
}

export function sessionRollupBounceSql(where: string): string {
  return `
    SELECT
      countIf(events = 1) AS bounces,
      count() AS sessions
    FROM ${SESSION_ROLLUP}
    WHERE ${where}
  `
}

export function sessionRollupBounceSeriesSql(bucketExpr: string, where: string): string {
  return `
    SELECT
      ${bucketExpr} AS bucket,
      countIf(events = 1) AS bounces,
      count() AS sessions
    FROM ${SESSION_ROLLUP}
    WHERE ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

export function dailyMetricsRangeFilter(
  fromParam = 'range_from',
  toParam = 'range_to',
): string {
  return (
    `workspace_id = {wid:UUID}` +
    ` AND day >= ${chToDate(`toDateTime64({${fromParam}:String}, 3, 'UTC')`)}` +
    ` AND day <= ${chToDate(`toDateTime64({${toParam}:String}, 3, 'UTC') - INTERVAL 1 MILLISECOND`)}`
  )
}

export function dailyMetricsPreviousRangeFilter(): string {
  return dailyMetricsRangeFilter('prev_from', 'prev_to')
}

export function dailyMetricsBucketExpr(granularity: string): string {
  if (granularity === 'week') return 'toString(toMonday(day))'
  if (granularity === 'month') return "formatDateTime(toDateTime(day), '%Y-%m')"
  return 'toString(day)'
}
