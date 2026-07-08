import {
  utmFilterSql,
  type AnalyticsUtmFilter,
} from './analytics-utm-filter.js'

export type AnalyticsRangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

export const ANALYTICS_RANGE_IDS: readonly AnalyticsRangeId[] = [
  '24h',
  '7d',
  '30d',
  '3m',
  '12m',
  '24m',
] as const

export function isAnalyticsRangeId(value: string): value is AnalyticsRangeId {
  return (ANALYTICS_RANGE_IDS as readonly string[]).includes(value)
}

export const RANGE_CLICKHOUSE_INTERVAL: Record<AnalyticsRangeId, string> = {
  '24h': '24 HOUR',
  '7d': '7 DAY',
  '30d': '30 DAY',
  '3m': '3 MONTH',
  '12m': '12 MONTH',
  '24m': '24 MONTH',
}

/** Start of the previous period (equal length, immediately before current). */
export const RANGE_CLICKHOUSE_PREVIOUS_START: Record<AnalyticsRangeId, string> = {
  '24h': '48 HOUR',
  '7d': '14 DAY',
  '30d': '60 DAY',
  '3m': '6 MONTH',
  '12m': '24 MONTH',
  '24m': '48 MONTH',
}

/** Slightly wider lookback so the first bucket is not clipped at range boundaries. */
export const RANGE_QUERY_LOOKBACK: Record<AnalyticsRangeId, string> = {
  '24h': '25 HOUR',
  '7d': '7 DAY',
  '30d': '30 DAY',
  '3m': '3 MONTH',
  '12m': '12 MONTH',
  '24m': '24 MONTH',
}

export function rangeFilter(
  rangeId: AnalyticsRangeId,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return `workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${RANGE_CLICKHOUSE_INTERVAL[rangeId]}${utmFilterSql(utmFilter)}`
}

export function rangeLookbackFilter(
  rangeId: AnalyticsRangeId,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return `workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${RANGE_QUERY_LOOKBACK[rangeId]}${utmFilterSql(utmFilter)}`
}

/** Previous period of equal length immediately before the current range. */
export function previousRangeFilter(
  rangeId: AnalyticsRangeId,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return `workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${RANGE_CLICKHOUSE_PREVIOUS_START[rangeId]} AND created_at < now() - INTERVAL ${RANGE_CLICKHOUSE_INTERVAL[rangeId]}${utmFilterSql(utmFilter)}`
}
