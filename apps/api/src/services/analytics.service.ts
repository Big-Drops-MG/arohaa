import { getClickHouseClient } from './clickhouse.service.js'
import { formatDayOfWeek } from '../lib/day-of-week.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  utmFilterCacheKey,
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import { redis } from './redis.service.js'

export type RangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

export interface RangeKpis {
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  bounceRate: number
  fsr: number
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface FunnelStep {
  label: string
  count: number
}

export type OverviewKpiMetricId =
  | 'visitors'
  | 'sessions'
  | 'page-views'
  | 'form-submitted'
  | 'fsr'
  | 'bounce-rate'

export type OverviewKpiSeriesByRange = Record<
  RangeId,
  Record<OverviewKpiMetricId, SeriesPoint[]>
>

export interface AnalyticsOverview {
  kpis: Record<RangeId, RangeKpis>
  /** Visitors series kept for backward compatibility. */
  series: Record<RangeId, SeriesPoint[]>
  kpiSeries: OverviewKpiSeriesByRange
  funnel: FunnelStep[]
  uniqueVisitors7d: number
  avgEngagedSecPerSession: number
  topCity: string
  bestDayLabel: string
  hasEvents24h: boolean
  activeUsersNow: number
}

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function bouncePct(bounces: number, sessions: number): number {
  return sessions > 0 ? round1((bounces / sessions) * 100) : 0
}

function fsrPct(submitted: number, sessions: number): number {
  return sessions > 0 ? round1((submitted / sessions) * 100) : 0
}

function getMonday(d: Date): string {
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() + diff)
  mon.setUTCHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function seriesLabel(bucket: Date, rangeId: RangeId): string {
  if (rangeId === '24h') {
    return `${String(bucket.getUTCHours()).padStart(2, '0')}:00`
  }
  if (rangeId === '12m' || rangeId === '24m') {
    const mon = bucket.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    return `${mon} '${String(bucket.getUTCFullYear()).slice(2)}`
  }
  const mon = bucket.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${mon} ${bucket.getUTCDate()}`
}

type LandingFormType = 'zip' | 'single' | 'multiple'

type TimeMetricRow = {
  bucket: string
  visitors: string
  sessions: string
  page_views: string
  form_submitted: string
}

type BounceBucketRow = {
  bucket: string
  bounces: string
  sessions: string
}

type BucketMetrics = {
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  bounces: number
  bounceSessions: number
}

const EMPTY_BUCKET_METRICS: BucketMetrics = {
  visitors: 0,
  sessions: 0,
  pageViews: 0,
  formSubmitted: 0,
  bounces: 0,
  bounceSessions: 0,
}

function parseLandingFormType(raw: string | undefined): LandingFormType {
  if (raw === 'zip' || raw === 'single' || raw === 'multiple') return raw
  return 'single'
}

function submissionEventName(formType: LandingFormType): string {
  return formType === 'zip' ? 'zip_submit' : 'form_success'
}

function normalizeTimeBucketKey(raw: string, rangeId: RangeId): string {
  if (rangeId === '24h') return raw.slice(0, 13).replace(' ', 'T')
  if (rangeId === '12m' || rangeId === '24m') return raw.slice(0, 7)
  return raw.slice(0, 10)
}

function rollupMetricsKey(dayKey: string, rangeId: RangeId): string {
  if (rangeId === '3m') return getMonday(new Date(`${dayKey}T00:00:00Z`))
  if (rangeId === '12m' || rangeId === '24m') return dayKey.slice(0, 7)
  return dayKey
}

function iterBucketTimeline(
  rangeId: RangeId,
  now: Date,
): { label: string; key: string }[] {
  const buckets: { label: string; key: string }[] = []

  if (rangeId === '24h') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCMinutes(0, 0, 0)
      d.setUTCHours(d.getUTCHours() - i)
      buckets.push({
        label: seriesLabel(d, rangeId),
        key: d.toISOString().slice(0, 13),
      })
    }
    return buckets
  }

  if (rangeId === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - i)
      buckets.push({
        label: seriesLabel(d, rangeId),
        key: d.toISOString().slice(0, 10),
      })
    }
    return buckets
  }

  if (rangeId === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - i)
      buckets.push({
        label: seriesLabel(d, rangeId),
        key: d.toISOString().slice(0, 10),
      })
    }
    return buckets
  }

  if (rangeId === '3m') {
    const monday = getMonday(now)
    for (let i = 12; i >= 0; i--) {
      const d = new Date(`${monday}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - i * 7)
      buckets.push({
        label: seriesLabel(d, rangeId),
        key: d.toISOString().slice(0, 10),
      })
    }
    return buckets
  }

  if (rangeId === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      buckets.push({
        label: seriesLabel(d, rangeId),
        key: d.toISOString().slice(0, 7),
      })
    }
    return buckets
  }

  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    buckets.push({
      label: seriesLabel(d, rangeId),
      key: d.toISOString().slice(0, 7),
    })
  }

  return buckets
}

function addBucketMetrics(
  map: Map<string, BucketMetrics>,
  key: string,
  patch: Partial<BucketMetrics>,
): void {
  const current = map.get(key) ?? { ...EMPTY_BUCKET_METRICS }
  map.set(key, {
    visitors: current.visitors + (patch.visitors ?? 0),
    sessions: current.sessions + (patch.sessions ?? 0),
    pageViews: current.pageViews + (patch.pageViews ?? 0),
    formSubmitted: current.formSubmitted + (patch.formSubmitted ?? 0),
    bounces: current.bounces + (patch.bounces ?? 0),
    bounceSessions: current.bounceSessions + (patch.bounceSessions ?? 0),
  })
}

function buildMetricsMapForRange(
  rangeId: RangeId,
  timeRows: TimeMetricRow[],
  bounceRows: BounceBucketRow[],
): Map<string, BucketMetrics> {
  const map = new Map<string, BucketMetrics>()

  for (const row of timeRows) {
    const sourceKey = normalizeTimeBucketKey(row.bucket, rangeId)
    const key =
      rangeId === '24h' ? sourceKey : rollupMetricsKey(sourceKey, rangeId)
    addBucketMetrics(map, key, {
      visitors: n(row.visitors),
      sessions: n(row.sessions),
      pageViews: n(row.page_views),
      formSubmitted: n(row.form_submitted),
    })
  }

  for (const row of bounceRows) {
    const sourceKey = normalizeTimeBucketKey(row.bucket, rangeId)
    const key =
      rangeId === '24h' ? sourceKey : rollupMetricsKey(sourceKey, rangeId)
    addBucketMetrics(map, key, {
      bounces: n(row.bounces),
      bounceSessions: n(row.sessions),
    })
  }

  return map
}

function buildKpiSeriesForRange(
  rangeId: RangeId,
  metricsByKey: Map<string, BucketMetrics>,
  now: Date,
): Record<OverviewKpiMetricId, SeriesPoint[]> {
  const series: Record<OverviewKpiMetricId, SeriesPoint[]> = {
    visitors: [],
    sessions: [],
    'page-views': [],
    'form-submitted': [],
    fsr: [],
    'bounce-rate': [],
  }

  for (const { label, key } of iterBucketTimeline(rangeId, now)) {
    const metrics = metricsByKey.get(key) ?? EMPTY_BUCKET_METRICS
    series.visitors.push({ label, value: metrics.visitors })
    series.sessions.push({ label, value: metrics.sessions })
    series['page-views'].push({ label, value: metrics.pageViews })
    series['form-submitted'].push({ label, value: metrics.formSubmitted })
    series.fsr.push({
      label,
      value: fsrPct(metrics.formSubmitted, metrics.sessions),
    })
    series['bounce-rate'].push({
      label,
      value: bouncePct(metrics.bounces, metrics.bounceSessions),
    })
  }

  return series
}

function overviewHourlyMetricsQuery(
  formType: LandingFormType,
  utmSql = '',
): string {
  const submitEvent = submissionEventName(formType)
  return `
    SELECT
      toStartOfHour(created_at) AS bucket,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExact(session_id) AS sessions,
      countIf(event_name = 'page_view') AS page_views,
      uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
    FROM events_raw
    WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 25 HOUR${utmSql}
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function overviewDailyMetricsQuery(
  formType: LandingFormType,
  utmSql = '',
): string {
  if (utmSql) {
    const submitEvent = submissionEventName(formType)
    return `
      SELECT
        toDate(created_at) AS bucket,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        countIf(event_name = 'page_view') AS page_views,
        uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
      FROM events_raw
      WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 730 DAY${utmSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `
  }

  return `
    SELECT
      day AS bucket,
      uniqMerge(visitors) AS visitors,
      uniqMerge(sessions) AS sessions,
      sum(pageviews) AS page_views,
      uniqMerge(form_submitted) AS form_submitted
    FROM daily_metrics
    WHERE workspace_id = {wid:UUID} AND day >= today() - 730
    GROUP BY day
    ORDER BY day ASC
  `
}

function overviewHourlyBounceQuery(utmSql = ''): string {
  return `
    SELECT
      toStartOfHour(first_at) AS bucket,
      sumIf(1, is_bounce = 1) AS bounces,
      count() AS sessions
    FROM (
      SELECT
        session_id,
        min(created_at) AS first_at,
        toUInt8(count() = 1) AS is_bounce
      FROM events_raw
      WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 25 HOUR${utmSql}
      GROUP BY session_id
    )
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function overviewDailyBounceQuery(utmSql = ''): string {
  return `
    SELECT
      toDate(first_at) AS bucket,
      sumIf(1, is_bounce = 1) AS bounces,
      count() AS sessions
    FROM (
      SELECT
        session_id,
        min(created_at) AS first_at,
        toUInt8(count() = 1) AS is_bounce
      FROM events_raw
      WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH${utmSql}
      GROUP BY session_id
    )
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function buildOverviewKpiSeries(
  rangeId: RangeId,
  hourlyRows: TimeMetricRow[],
  dailyRows: TimeMetricRow[],
  hourlyBounceRows: BounceBucketRow[],
  dailyBounceRows: BounceBucketRow[],
  now: Date,
): Record<OverviewKpiMetricId, SeriesPoint[]> {
  if (rangeId === '24h') {
    return buildKpiSeriesForRange(
      rangeId,
      buildMetricsMapForRange(rangeId, hourlyRows, hourlyBounceRows),
      now,
    )
  }

  return buildKpiSeriesForRange(
    rangeId,
    buildMetricsMapForRange(rangeId, dailyRows, dailyBounceRows),
    now,
  )
}

export async function getAnalyticsOverview(
  workspaceId: string,
  formTypeRaw?: string,
  utmFilter?: AnalyticsUtmFilter,
): Promise<AnalyticsOverview> {
  const formType = parseLandingFormType(formTypeRaw)
  const submitEvent = submissionEventName(formType)
  const utmSql = utmFilterSql(utmFilter)
  const p = { wid: workspaceId, ...utmFilterParams(utmFilter) }
  const cacheKey = `analytics:overview:v2:${workspaceId}:${formType}:${utmFilterCacheKey(utmFilter)}`
  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as AnalyticsOverview
    }
  } catch (err) {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()

  const kpiLongQuery = utmFilter
    ? `
          SELECT
            uniqExactIf(user_id, event_name = 'page_view' AND created_at >= now() - INTERVAL 7 DAY) AS vis_7d,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 7 DAY) AS ses_7d,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 7 DAY) AS pv_7d,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 7 DAY) AS fs_7d,
            uniqExactIf(user_id, event_name = 'page_view' AND created_at >= now() - INTERVAL 30 DAY) AS vis_30d,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 30 DAY) AS ses_30d,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 30 DAY) AS pv_30d,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 30 DAY) AS fs_30d,
            uniqExactIf(user_id, event_name = 'page_view' AND created_at >= now() - INTERVAL 90 DAY) AS vis_3m,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 90 DAY) AS ses_3m,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 90 DAY) AS pv_3m,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 90 DAY) AS fs_3m,
            uniqExactIf(user_id, event_name = 'page_view' AND created_at >= now() - INTERVAL 365 DAY) AS vis_12m,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 365 DAY) AS ses_12m,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 365 DAY) AS pv_12m,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 365 DAY) AS fs_12m,
            uniqExactIf(user_id, event_name = 'page_view' AND created_at >= now() - INTERVAL 24 MONTH) AS vis_24m,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 24 MONTH) AS ses_24m,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 24 MONTH) AS pv_24m,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 24 MONTH) AS fs_24m
          FROM events_raw
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH${utmSql}
        `
    : `
          SELECT
            uniqMergeIf(visitors, day >= today() - 7) AS vis_7d,
            uniqMergeIf(sessions, day >= today() - 7) AS ses_7d,
            sumIf(pageviews, day >= today() - 7) AS pv_7d,
            uniqMergeIf(form_submitted, day >= today() - 7) AS fs_7d,
            uniqMergeIf(visitors, day >= today() - 30) AS vis_30d,
            uniqMergeIf(sessions, day >= today() - 30) AS ses_30d,
            sumIf(pageviews, day >= today() - 30) AS pv_30d,
            uniqMergeIf(form_submitted, day >= today() - 30) AS fs_30d,
            uniqMergeIf(visitors, day >= today() - 90) AS vis_3m,
            uniqMergeIf(sessions, day >= today() - 90) AS ses_3m,
            sumIf(pageviews, day >= today() - 90) AS pv_3m,
            uniqMergeIf(form_submitted, day >= today() - 90) AS fs_3m,
            uniqMergeIf(visitors, day >= today() - 365) AS vis_12m,
            uniqMergeIf(sessions, day >= today() - 365) AS ses_12m,
            sumIf(pageviews, day >= today() - 365) AS pv_12m,
            uniqMergeIf(form_submitted, day >= today() - 365) AS fs_12m,
            uniqMerge(visitors) AS vis_24m,
            uniqMerge(sessions) AS ses_24m,
            sum(pageviews) AS pv_24m,
            uniqMerge(form_submitted) AS fs_24m
          FROM daily_metrics
          WHERE workspace_id = {wid:UUID} AND day >= today() - 730
        `

  const funnelQuery = utmFilter
    ? `
          SELECT
            countIf(event_name = 'page_view') AS page_views,
            uniqExactIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
            uniqExactIf(session_id, event_name = 'form_start') AS form_started,
            uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
          FROM events_raw
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 7 DAY${utmSql}
        `
    : `
          SELECT
            sum(pageviews) AS page_views,
            uniqMerge(interactions) AS interactions,
            uniqMerge(form_started) AS form_started,
            uniqMerge(form_submitted) AS form_submitted
          FROM daily_metrics
          WHERE workspace_id = {wid:UUID} AND day >= today() - 7
        `

  const [
    kpi24hRes,
    kpiLongRes,
    bounceRes,
    hourlyMetricsRes,
    dailyMetricsRes,
    hourlyBounceRes,
    dailyBounceRes,
    funnelRes,
    cityRes,
    dowRes,
    engagedRes,
  ] = await Promise.all([
      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT
            uniqExactIf(user_id, created_at >= now() - INTERVAL 24 HOUR AND event_name = 'page_view') AS vis_24h,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 24 HOUR) AS ses_24h,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 24 HOUR) AS pv_24h,
            uniqExactIf(session_id, event_name = '${submitEvent}' AND created_at >= now() - INTERVAL 24 HOUR) AS fs_24h,
            uniqExactIf(
              user_id,
              created_at >= now() - INTERVAL 5 MINUTE
                AND event_name IN ('heartbeat', 'page_view')
            ) AS active_users_now
          FROM events_raw
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 25 HOUR${utmSql}
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: kpiLongQuery,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT
            sumIf(1, first_at >= now() - INTERVAL 24 HOUR AND is_bounce = 1) AS bounce_24h,
            sumIf(1, first_at >= now() - INTERVAL 24 HOUR) AS ses_24h,
            sumIf(1, first_at >= now() - INTERVAL 7 DAY AND is_bounce = 1) AS bounce_7d,
            sumIf(1, first_at >= now() - INTERVAL 7 DAY) AS ses_7d,
            sumIf(1, first_at >= now() - INTERVAL 30 DAY AND is_bounce = 1) AS bounce_30d,
            sumIf(1, first_at >= now() - INTERVAL 30 DAY) AS ses_30d,
            sumIf(1, first_at >= now() - INTERVAL 3 MONTH AND is_bounce = 1) AS bounce_3m,
            sumIf(1, first_at >= now() - INTERVAL 3 MONTH) AS ses_3m,
            sumIf(1, first_at >= now() - INTERVAL 12 MONTH AND is_bounce = 1) AS bounce_12m,
            sumIf(1, first_at >= now() - INTERVAL 12 MONTH) AS ses_12m,
            sum(is_bounce) AS bounce_24m,
            count() AS ses_24m
          FROM (
            SELECT session_id, min(created_at) AS first_at, toUInt8(count() = 1) AS is_bounce
            FROM events_raw
            WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH${utmSql}
            GROUP BY session_id
          )
        `,
      }),

      ch.query({
        format: 'JSON',
        query_params: p,
        query: overviewHourlyMetricsQuery(formType, utmSql),
      }),

      ch.query({
        format: 'JSON',
        query_params: p,
        query: overviewDailyMetricsQuery(formType, utmSql),
      }),

      ch.query({
        format: 'JSON',
        query_params: p,
        query: overviewHourlyBounceQuery(utmSql),
      }),

      ch.query({
        format: 'JSON',
        query_params: p,
        query: overviewDailyBounceQuery(utmSql),
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: funnelQuery,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT city FROM events_raw
          WHERE workspace_id = {wid:UUID} AND city != '' AND created_at >= now() - INTERVAL 7 DAY${utmSql}
          GROUP BY city ORDER BY uniqExactIf(user_id, event_name = 'page_view') DESC LIMIT 1
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT toDayOfWeek(created_at, 1) AS dow FROM events_raw
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 7 DAY${utmSql}
          GROUP BY dow
          ORDER BY uniqExactIf(session_id, event_name = '${submitEvent}') DESC
          LIMIT 1
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT avg(max_engaged) AS avg_sec
          FROM (
            SELECT session_id, max(metric_value) AS max_engaged
            FROM events_raw
            WHERE workspace_id = {wid:UUID} AND event_name = 'heartbeat'
              AND metric_name = 'engaged_seconds' AND created_at >= now() - INTERVAL 7 DAY${utmSql}
            GROUP BY session_id
          )
        `,
      }),
    ])

  type KR = Record<string, string>

  const kd24 = ((await kpi24hRes.json()) as CHJson<KR>).data[0] ?? {}
  const kdLong = ((await kpiLongRes.json()) as CHJson<KR>).data[0] ?? {}
  const kd = { ...kd24, ...kdLong }
  const bd = ((await bounceRes.json()) as CHJson<KR>).data[0] ?? {}
  const hourlyMetricRows = ((await hourlyMetricsRes.json()) as CHJson<TimeMetricRow>).data
  const dailyMetricRows = ((await dailyMetricsRes.json()) as CHJson<TimeMetricRow>).data
  const hourlyBounceRows = ((await hourlyBounceRes.json()) as CHJson<BounceBucketRow>).data
  const dailyBounceRows = ((await dailyBounceRes.json()) as CHJson<BounceBucketRow>).data
  const fd = ((await funnelRes.json()) as CHJson<KR>).data[0] ?? {}
  const cityRow = ((await cityRes.json()) as CHJson<{ city: string }>).data[0]
  const dowRow = ((await dowRes.json()) as CHJson<{ dow: string }>).data[0]
  const engRow = ((await engagedRes.json()) as CHJson<{ avg_sec: string | null }>).data[0]

  const now = new Date()

  const RANGES: RangeId[] = ['24h', '7d', '30d', '3m', '12m', '24m']
  const kpiSeries = Object.fromEntries(
    RANGES.map((rid) => [
      rid,
      buildOverviewKpiSeries(
        rid,
        hourlyMetricRows,
        dailyMetricRows,
        hourlyBounceRows,
        dailyBounceRows,
        now,
      ),
    ]),
  ) as OverviewKpiSeriesByRange

  const series = Object.fromEntries(
    RANGES.map((rid) => [rid, kpiSeries[rid].visitors]),
  ) as Record<RangeId, SeriesPoint[]>

  function mkKpis(sfx: string): RangeKpis {
    const vis = n(kd[`vis_${sfx}`])
    const ses = n(kd[`ses_${sfx}`])
    const pv = n(kd[`pv_${sfx}`])
    const fs = n(kd[`fs_${sfx}`])
    return {
      visitors: vis, sessions: ses, pageViews: pv, formSubmitted: fs,
      bounceRate: bouncePct(n(bd[`bounce_${sfx}`]), n(bd[`ses_${sfx}`])),
      fsr: fsrPct(fs, ses),
    }
  }

  const result: AnalyticsOverview = {
    kpis: {
      '24h': mkKpis('24h'), '7d': mkKpis('7d'), '30d': mkKpis('30d'),
      '3m': mkKpis('3m'), '12m': mkKpis('12m'), '24m': mkKpis('24m'),
    },
    series,
    kpiSeries,
    funnel: [
      { label: 'Landing Page Visits', count: n(fd.page_views) },
      { label: 'Interactions', count: n(fd.interactions) },
      { label: 'Form Started', count: n(fd.form_started) },
      { label: 'Form Submitted', count: n(fd.form_submitted) },
    ],
    uniqueVisitors7d: n(kd.vis_7d),
    avgEngagedSecPerSession: n(engRow?.avg_sec),
    topCity: cityRow?.city ?? '-',
    bestDayLabel:
      formatDayOfWeek(dowRow?.dow) === 'Unknown' ? '-' : formatDayOfWeek(dowRow?.dow),
    hasEvents24h: n(kd.ses_24h) > 0,
    activeUsersNow: n(kd.active_users_now),
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 45)
  } catch (err) {
    // ignore cache write errors
  }
  return result
}

const ALL_RANGES: RangeId[] = ['24h', '7d', '30d', '3m', '12m', '24m']

const ZERO_KPIS: RangeKpis = {
  visitors: 0,
  sessions: 0,
  pageViews: 0,
  formSubmitted: 0,
  bounceRate: 0,
  fsr: 0,
}

export function emptyAnalyticsOverview(): AnalyticsOverview {
  const now = new Date()
  const kpiSeries = Object.fromEntries(
    ALL_RANGES.map((rangeId) => [
      rangeId,
      buildOverviewKpiSeries(rangeId, [], [], [], [], now),
    ]),
  ) as OverviewKpiSeriesByRange

  return {
    kpis: Object.fromEntries(
      ALL_RANGES.map((rangeId) => [rangeId, { ...ZERO_KPIS }]),
    ) as Record<RangeId, RangeKpis>,
    series: Object.fromEntries(
      ALL_RANGES.map((rangeId) => [rangeId, kpiSeries[rangeId].visitors]),
    ) as Record<RangeId, SeriesPoint[]>,
    kpiSeries,
    funnel: [
      { label: 'Landing Page Visits', count: 0 },
      { label: 'Interactions', count: 0 },
      { label: 'Form Started', count: 0 },
      { label: 'Form Submitted', count: 0 },
    ],
    uniqueVisitors7d: 0,
    avgEngagedSecPerSession: 0,
    topCity: '-',
    bestDayLabel: '-',
    hasEvents24h: false,
    activeUsersNow: 0,
  }
}

export interface LandingPageCardMetrics {
  activeUsers: number
  formSubmissions7d: number
  bounceRate7d: number
}

export async function getLandingPageCardMetrics(
  workspaceId: string
): Promise<LandingPageCardMetrics> {
  const cacheKey = `analytics:landing-summary:${workspaceId}`
  const cached = await readAnalyticsCache<LandingPageCardMetrics>(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const metricsRes = await ch.query({
    query: `
      SELECT
        uniqExactIf(
          user_id,
          created_at >= now() - INTERVAL 5 MINUTE
            AND event_name IN ('heartbeat', 'page_view')
        ) AS active_users,
        uniqExactIf(
          session_id,
          event_name = 'form_success'
            AND created_at >= now() - INTERVAL 7 DAY
        ) AS form_submissions_7d
      FROM events_raw
      WHERE workspace_id = {wid:UUID}
    `,
    query_params: { wid: workspaceId },
    format: 'JSON',
  })
  const [row] = (
    (await metricsRes.json()) as CHJson<{
      active_users: string
      form_submissions_7d: string
    }>
  ).data

  const bounceRes = await ch.query({
    query: `
      SELECT
        sumIf(1, first_at >= now() - INTERVAL 7 DAY AND is_bounce = 1) AS bounce_7d,
        sumIf(1, first_at >= now() - INTERVAL 7 DAY) AS ses_7d
      FROM (
        SELECT session_id, min(created_at) AS first_at, toUInt8(count() = 1) AS is_bounce
        FROM events_raw
        WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH
        GROUP BY session_id
      )
    `,
    query_params: { wid: workspaceId },
    format: 'JSON',
  })
  const [bounceRow] = (
    (await bounceRes.json()) as CHJson<{ ses_7d: string; bounce_7d: string }>
  ).data

  const ses7d = n(bounceRow?.ses_7d)
  const result = {
    activeUsers: n(row?.active_users),
    formSubmissions7d: n(row?.form_submissions_7d),
    bounceRate7d: bouncePct(n(bounceRow?.bounce_7d), ses7d),
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

export function emptyLandingPageCardMetrics(): LandingPageCardMetrics {
  return {
    activeUsers: 0,
    formSubmissions7d: 0,
    bounceRate7d: 0,
  }
}
