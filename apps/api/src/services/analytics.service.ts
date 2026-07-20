import { getClickHouseClient } from './clickhouse.service.js'
import { formatDayOfWeek } from '../lib/day-of-week.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  addAnalyticsEtDays,
  analyticsDayKey,
  analyticsHourKey,
  analyticsMondayKey,
  analyticsMonthKey,
  chDayBucketKey,
  chHourBucketKey,
  chMonthBucketKey,
  chToDayOfWeek,
  chWeekBucketKey,
  formatAnalyticsSeriesHour,
  formatAnalyticsSeriesMonthDay,
  formatAnalyticsSeriesMonthYear,
  parseAnalyticsEtDayKey,
  parseAnalyticsEtMonthKey,
  startOfAnalyticsEtDay,
  startOfAnalyticsEtHour,
} from '../lib/analytics-timezone.js'
import {
  DEFAULT_ANALYTICS_RANGE_ID,
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsGranularity,
  type AnalyticsRangeId,
  type AnalyticsWindow,
} from '../lib/analytics-range.js'
import {
  utmFilterCacheKey,
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import { redis } from './redis.service.js'

export type RangeId = AnalyticsRangeId

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

export interface AnalyticsOverview {
  rangeId: AnalyticsRangeId
  kpis: RangeKpis
  /** Visitors series for the selected range. */
  series: SeriesPoint[]
  kpiSeries: Record<OverviewKpiMetricId, SeriesPoint[]>
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

function seriesLabel(bucket: Date, granularity: AnalyticsGranularity): string {
  if (granularity === 'hour') return formatAnalyticsSeriesHour(bucket)
  if (granularity === 'month') return formatAnalyticsSeriesMonthYear(bucket)
  return formatAnalyticsSeriesMonthDay(bucket)
}

function normalizeTimeBucketKey(raw: string, granularity: AnalyticsGranularity): string {
  if (granularity === 'hour') return raw.slice(0, 13).replace(' ', 'T')
  if (granularity === 'month') return raw.slice(0, 7)
  return raw.slice(0, 10)
}

function chBucketExpr(granularity: AnalyticsGranularity): string {
  if (granularity === 'hour') return chHourBucketKey('created_at')
  if (granularity === 'week') return chWeekBucketKey('created_at')
  if (granularity === 'month') return chMonthBucketKey('created_at')
  return chDayBucketKey('created_at')
}

function chBounceBucketExpr(granularity: AnalyticsGranularity): string {
  if (granularity === 'hour') return chHourBucketKey('first_at')
  if (granularity === 'week') return chWeekBucketKey('first_at')
  if (granularity === 'month') return chMonthBucketKey('first_at')
  return chDayBucketKey('first_at')
}

function addOneMonth(date: Date): Date {
  const { year, month } = (() => {
    const key = analyticsMonthKey(date)
    const [y, m] = key.split('-').map(Number)
    return { year: y ?? 1970, month: m ?? 1 }
  })()
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return parseAnalyticsEtMonthKey(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
  )
}

function iterBucketTimeline(
  window: AnalyticsWindow,
): { label: string; key: string }[] {
  const buckets: { label: string; key: string }[] = []
  const { start, seriesEnd, granularity } = window

  if (granularity === 'hour') {
    let d = startOfAnalyticsEtHour(start)
    while (d < seriesEnd) {
      buckets.push({
        label: seriesLabel(d, granularity),
        key: analyticsHourKey(d),
      })
      d = new Date(d.getTime() + 60 * 60 * 1000)
    }
    return buckets
  }

  if (granularity === 'week') {
    let d = startOfAnalyticsEtDay(
      parseAnalyticsEtDayKey(analyticsMondayKey(start)),
    )
    while (d < seriesEnd) {
      buckets.push({
        label: seriesLabel(d, granularity),
        key: analyticsDayKey(d),
      })
      d = addAnalyticsEtDays(d, 7)
    }
    return buckets
  }

  if (granularity === 'month') {
    let d = parseAnalyticsEtMonthKey(analyticsMonthKey(start))
    while (d < seriesEnd) {
      buckets.push({
        label: seriesLabel(d, granularity),
        key: analyticsMonthKey(d),
      })
      d = addOneMonth(d)
    }
    return buckets
  }

  let d = startOfAnalyticsEtDay(start)
  while (d < seriesEnd) {
    buckets.push({
      label: seriesLabel(d, granularity),
      key: analyticsDayKey(d),
    })
    d = addAnalyticsEtDays(d, 1)
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

function buildMetricsMap(
  granularity: AnalyticsGranularity,
  timeRows: TimeMetricRow[],
  bounceRows: BounceBucketRow[],
): Map<string, BucketMetrics> {
  const map = new Map<string, BucketMetrics>()

  for (const row of timeRows) {
    const key = normalizeTimeBucketKey(row.bucket, granularity)
    addBucketMetrics(map, key, {
      visitors: n(row.visitors),
      sessions: n(row.sessions),
      pageViews: n(row.page_views),
      formSubmitted: n(row.form_submitted),
    })
  }

  for (const row of bounceRows) {
    const key = normalizeTimeBucketKey(row.bucket, granularity)
    addBucketMetrics(map, key, {
      bounces: n(row.bounces),
      bounceSessions: n(row.sessions),
    })
  }

  return map
}

function buildKpiSeries(
  window: AnalyticsWindow,
  metricsByKey: Map<string, BucketMetrics>,
): Record<OverviewKpiMetricId, SeriesPoint[]> {
  const series: Record<OverviewKpiMetricId, SeriesPoint[]> = {
    visitors: [],
    sessions: [],
    'page-views': [],
    'form-submitted': [],
    fsr: [],
    'bounce-rate': [],
  }

  for (const { label, key } of iterBucketTimeline(window)) {
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

function overviewSeriesMetricsQuery(
  formType: LandingFormType,
  granularity: AnalyticsGranularity,
  utmFilter?: AnalyticsUtmFilter,
): string {
  const submitEvent = submissionEventName(formType)
  return `
    SELECT
      ${chBucketExpr(granularity)} AS bucket,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExact(session_id) AS sessions,
      countIf(event_name = 'page_view') AS page_views,
      uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
    FROM events_raw
    WHERE ${rangeFilter(utmFilter)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function overviewSeriesBounceQuery(
  granularity: AnalyticsGranularity,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return `
    SELECT
      ${chBounceBucketExpr(granularity)} AS bucket,
      sumIf(1, is_bounce = 1) AS bounces,
      count() AS sessions
    FROM (
      SELECT
        session_id,
        min(created_at) AS first_at,
        toUInt8(count() = 1) AS is_bounce
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)}
      GROUP BY session_id
    )
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

export async function getAnalyticsOverview(
  workspaceId: string,
  formTypeRaw?: string,
  utmFilter?: AnalyticsUtmFilter,
  rangeId: AnalyticsRangeId = DEFAULT_ANALYTICS_RANGE_ID,
  custom?: AnalyticsCustomRange,
): Promise<AnalyticsOverview> {
  const formType = parseLandingFormType(formTypeRaw)
  const submitEvent = submissionEventName(formType)
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const cacheKey = `analytics:overview:v4-abs:${workspaceId}:${formType}:${rangeCacheKey(window, utmFilterCacheKey(utmFilter))}`
  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as AnalyticsOverview
    }
  } catch (err) {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()

  const [
    rangeKpiRes,
    bounceRes,
    seriesMetricsRes,
    seriesBounceRes,
    funnelRes,
    rollingRes,
    cityRes,
    dowRes,
    engagedRes,
  ] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExact(session_id) AS sessions,
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
        FROM events_raw
        WHERE ${where}
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          sumIf(1, is_bounce = 1) AS bounces,
          count() AS sessions
        FROM (
          SELECT session_id, min(created_at) AS first_at, toUInt8(count() = 1) AS is_bounce
          FROM events_raw
          WHERE ${where}
          GROUP BY session_id
        )
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: overviewSeriesMetricsQuery(formType, window.granularity, utmFilter),
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: overviewSeriesBounceQuery(window.granularity, utmFilter),
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
          uniqExactIf(session_id, event_name = 'form_start') AS form_started,
          uniqExactIf(session_id, event_name = '${submitEvent}') AS form_submitted
        FROM events_raw
        WHERE ${where}
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: { wid: workspaceId, ...utmFilterParams(utmFilter) },
      query: `
        SELECT
          uniqExactIf(
            user_id,
            event_name = 'page_view' AND created_at >= now() - INTERVAL 7 DAY
          ) AS unique_visitors_7d,
          uniqExactIf(
            session_id,
            created_at >= now() - INTERVAL 24 HOUR
          ) AS sessions_24h,
          uniqExactIf(
            user_id,
            created_at >= now() - INTERVAL 5 MINUTE
              AND event_name IN ('heartbeat', 'page_view')
          ) AS active_users_now
        FROM events_raw
        WHERE workspace_id = {wid:UUID}
          AND created_at >= now() - INTERVAL 7 DAY${utmFilterSql(utmFilter)}
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT city FROM events_raw
        WHERE ${where} AND city != ''
        GROUP BY city ORDER BY uniqExactIf(user_id, event_name = 'page_view') DESC LIMIT 1
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT ${chToDayOfWeek('created_at', 1)} AS dow FROM events_raw
        WHERE ${where}
        GROUP BY dow
        ORDER BY uniqExactIf(session_id, event_name = '${submitEvent}') DESC
        LIMIT 1
      `,
    }),

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT avg(max_engaged) AS avg_sec
        FROM (
          SELECT session_id, max(metric_value) AS max_engaged
          FROM events_raw
          WHERE ${where}
            AND event_name = 'heartbeat'
            AND metric_name = 'engaged_seconds'
          GROUP BY session_id
        )
      `,
    }),
  ])

  type KR = Record<string, string>

  const kd = ((await rangeKpiRes.json()) as CHJson<KR>).data[0] ?? {}
  const bd = ((await bounceRes.json()) as CHJson<KR>).data[0] ?? {}
  const seriesMetricRows =
    ((await seriesMetricsRes.json()) as CHJson<TimeMetricRow>).data ?? []
  const seriesBounceRows =
    ((await seriesBounceRes.json()) as CHJson<BounceBucketRow>).data ?? []
  const fd = ((await funnelRes.json()) as CHJson<KR>).data[0] ?? {}
  const rolling = ((await rollingRes.json()) as CHJson<KR>).data[0] ?? {}
  const cityRow = ((await cityRes.json()) as CHJson<{ city: string }>).data?.[0]
  const dowRow = ((await dowRes.json()) as CHJson<{ dow: string }>).data?.[0]
  const engRow = (
    (await engagedRes.json()) as CHJson<{ avg_sec: string | null }>
  ).data?.[0]

  const visitors = n(kd.visitors)
  const sessions = n(kd.sessions)
  const pageViews = n(kd.page_views)
  const formSubmitted = n(kd.form_submitted)

  const kpiSeries = buildKpiSeries(
    window,
    buildMetricsMap(window.granularity, seriesMetricRows, seriesBounceRows),
  )

  const result: AnalyticsOverview = {
    rangeId: window.rangeId,
    kpis: {
      visitors,
      sessions,
      pageViews,
      formSubmitted,
      bounceRate: bouncePct(n(bd.bounces), n(bd.sessions)),
      fsr: fsrPct(formSubmitted, sessions),
    },
    series: kpiSeries.visitors,
    kpiSeries,
    funnel: [
      { label: 'Landing Page Visits', count: n(fd.page_views) },
      { label: 'Interactions', count: n(fd.interactions) },
      { label: 'Form Started', count: n(fd.form_started) },
      { label: 'Form Submitted', count: n(fd.form_submitted) },
    ],
    uniqueVisitors7d: n(rolling.unique_visitors_7d),
    avgEngagedSecPerSession: n(engRow?.avg_sec),
    topCity: cityRow?.city ?? '-',
    bestDayLabel:
      formatDayOfWeek(dowRow?.dow) === 'Unknown' ? '-' : formatDayOfWeek(dowRow?.dow),
    hasEvents24h: n(rolling.sessions_24h) > 0,
    activeUsersNow: n(rolling.active_users_now),
  }

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 45)
  } catch (err) {
    // ignore cache write errors
  }
  return result
}

const ZERO_KPIS: RangeKpis = {
  visitors: 0,
  sessions: 0,
  pageViews: 0,
  formSubmitted: 0,
  bounceRate: 0,
  fsr: 0,
}

export function emptyAnalyticsOverview(
  rangeId: AnalyticsRangeId = DEFAULT_ANALYTICS_RANGE_ID,
  custom?: AnalyticsCustomRange,
): AnalyticsOverview {
  const window = resolveAnalyticsWindow(rangeId, new Date(), custom)
  const kpiSeries = buildKpiSeries(window, new Map())

  return {
    rangeId: window.rangeId,
    kpis: { ...ZERO_KPIS },
    series: kpiSeries.visitors,
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
