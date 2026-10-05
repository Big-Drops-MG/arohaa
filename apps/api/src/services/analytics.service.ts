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
  previousRangeFilter,
  previousRangeQueryParams,
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  resolveAnalyticsWindowForLanding,
  type AnalyticsCustomRange,
  type AnalyticsGranularity,
  type AnalyticsRangeId,
  type AnalyticsWindow,
} from '../lib/analytics-range.js'
import { computePeriodChangePct } from '../lib/funnel-trend.js'
import {
  utmFilterCacheKey,
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import { redis } from './redis.service.js'
import { resolveUsCityCoordinates } from './us-gazetteer.service.js'
import { resolveCountyFipsForZips } from './us-zip-county.service.js'

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

export interface OverviewStateMetric {
  state: string
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

export interface OverviewCityMetric {
  city: string
  state: string
  latitude?: number
  longitude?: number
  countyFips?: string
  zipCount: number
  zipcodes: string[]
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

export interface OverviewZipcodeMetric {
  zipcode: string
  city: string
  state: string
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

export interface AnalyticsOverview {
  rangeId: AnalyticsRangeId
  kpis: RangeKpis
  kpiChanges: Partial<Record<OverviewKpiMetricId, number | null>>
  series: SeriesPoint[]
  kpiSeries: Record<OverviewKpiMetricId, SeriesPoint[]>
  kpiByState: OverviewStateMetric[]
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

type LandingFormType = 'zip' | 'single' | 'multiple' | 'none'

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
  if (
    raw === 'zip' ||
    raw === 'single' ||
    raw === 'multiple' ||
    raw === 'none'
  ) {
    return raw
  }
  return 'single'
}

function submissionEventSqlPredicate(formType: LandingFormType): string {
  if (formType === 'none') return `event_name = 'service_click'`
  if (formType === 'zip') {
    return `event_name IN ('zip_submit', 'form_success')`
  }
  return `event_name = 'form_success'`
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
  return `
    SELECT
      ${chBucketExpr(granularity)} AS bucket,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExact(session_id) AS sessions,
      countIf(event_name = 'page_view') AS page_views,
      uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
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
  const now = new Date()
  const window = await resolveAnalyticsWindowForLanding(rangeId, workspaceId, now, custom)
  const where = rangeFilter(utmFilter)
  const previousWhere = previousRangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...previousRangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const cacheKey = `analytics:overview:v8-prior:${workspaceId}:${formType}:${rangeCacheKey(window, utmFilterCacheKey(utmFilter))}`
  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as AnalyticsOverview
    }
  } catch (err) {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()
  const usStateWhere = `${where}
          AND state != ''
          AND country IN ('United States', 'USA', 'US')`

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
    prevKpiRes,
    prevBounceRes,
  ] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExact(session_id) AS sessions,
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
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
          uniqExactIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth','service_click')) AS interactions,
          uniqExactIf(session_id, event_name = 'form_start') AS form_started,
          uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
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
        ORDER BY uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) DESC
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

    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExact(session_id) AS sessions,
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
        FROM events_raw
        WHERE ${previousWhere}
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
          WHERE ${previousWhere}
          GROUP BY session_id
        )
      `,
    }),
  ])

  let stateMetricRows: Array<{
    state: string
    visitors: string
    sessions: string
    page_views: string
    form_submitted: string
  }> = []
  let stateBounceRows: Array<{
    state: string
    bounces: string
    sessions: string
  }> = []
  try {
    const [stateMetricsRes, stateBounceRes] = await Promise.all([
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
          SELECT
            state AS state,
            uniqExactIf(user_id, event_name = 'page_view') AS visitors,
            uniqExact(session_id) AS sessions,
            countIf(event_name = 'page_view') AS page_views,
            uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
          FROM events_raw
          WHERE ${usStateWhere}
          GROUP BY state
          ORDER BY visitors DESC
          LIMIT 100
        `,
      }),
      ch.query({
        format: 'JSON',
        query_params: p,
        query: `
          SELECT
            session_state AS state,
            sumIf(1, is_bounce = 1) AS bounces,
            count() AS sessions
          FROM (
            SELECT
              session_id,
              anyHeavyIf(state, state != '') AS session_state,
              toUInt8(count() = 1) AS is_bounce
            FROM events_raw
            WHERE ${usStateWhere}
            GROUP BY session_id
          )
          WHERE session_state != ''
          GROUP BY session_state
        `,
      }),
    ])
    stateMetricRows =
      (
        (await stateMetricsRes.json()) as CHJson<{
          state: string
          visitors: string
          sessions: string
          page_views: string
          form_submitted: string
        }>
      ).data ?? []
    stateBounceRows =
      (
        (await stateBounceRes.json()) as CHJson<{
          state: string
          bounces: string
          sessions: string
        }>
      ).data ?? []
  } catch {
    stateMetricRows = []
    stateBounceRows = []
  }

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
  const bounceRate = bouncePct(n(bd.bounces), n(bd.sessions))
  const fsr = fsrPct(formSubmitted, sessions)

  const prevKd = ((await prevKpiRes.json()) as CHJson<KR>).data[0] ?? {}
  const prevBd = ((await prevBounceRes.json()) as CHJson<KR>).data[0] ?? {}
  const prevVisitors = n(prevKd.visitors)
  const prevSessions = n(prevKd.sessions)
  const prevPageViews = n(prevKd.page_views)
  const prevFormSubmitted = n(prevKd.form_submitted)
  const prevBounceRate = bouncePct(n(prevBd.bounces), n(prevBd.sessions))
  const prevFsr = fsrPct(prevFormSubmitted, prevSessions)

  const kpiChanges: Partial<Record<OverviewKpiMetricId, number | null>> = {
    visitors: computePeriodChangePct(visitors, prevVisitors),
    sessions: computePeriodChangePct(sessions, prevSessions),
    'page-views': computePeriodChangePct(pageViews, prevPageViews),
    'form-submitted': computePeriodChangePct(formSubmitted, prevFormSubmitted),
    fsr: computePeriodChangePct(fsr, prevFsr),
    'bounce-rate': computePeriodChangePct(bounceRate, prevBounceRate),
  }

  const kpiSeries = buildKpiSeries(
    window,
    buildMetricsMap(window.granularity, seriesMetricRows, seriesBounceRows),
  )

  const bounceByState = new Map<string, { bounces: number; sessions: number }>()
  for (const row of stateBounceRows) {
    bounceByState.set(row.state, {
      bounces: n(row.bounces),
      sessions: n(row.sessions),
    })
  }

  const kpiByState: OverviewStateMetric[] = stateMetricRows.map((row) => {
    const stateSessions = n(row.sessions)
    const stateSubmitted = n(row.form_submitted)
    const bounce = bounceByState.get(row.state)
    return {
      state: row.state,
      visitors: n(row.visitors),
      sessions: stateSessions,
      pageViews: n(row.page_views),
      formSubmitted: stateSubmitted,
      fsr: fsrPct(stateSubmitted, stateSessions),
      bounceRate: bouncePct(bounce?.bounces ?? 0, bounce?.sessions ?? 0),
    }
  })

  const funnel =
    formType === 'none'
      ? [
          { label: 'Landing Page Visits', count: n(fd.page_views) },
          { label: 'Interactions', count: n(fd.interactions) },
          { label: 'Service Clicked', count: n(fd.form_submitted) },
        ]
      : [
          { label: 'Landing Page Visits', count: n(fd.page_views) },
          { label: 'Interactions', count: n(fd.interactions) },
          { label: 'Form Started', count: n(fd.form_started) },
          { label: 'Form Submitted', count: n(fd.form_submitted) },
        ]

  const result: AnalyticsOverview = {
    rangeId: window.rangeId,
    kpis: {
      visitors,
      sessions,
      pageViews,
      formSubmitted,
      bounceRate,
      fsr,
    },
    kpiChanges,
    series: kpiSeries.visitors,
    kpiSeries,
    kpiByState,
    funnel,
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
  formType: LandingFormType = 'single',
): AnalyticsOverview {
  const window = resolveAnalyticsWindow(rangeId, new Date(), custom)
  const kpiSeries = buildKpiSeries(window, new Map())

  const funnel =
    formType === 'none'
      ? [
          { label: 'Landing Page Visits', count: 0 },
          { label: 'Interactions', count: 0 },
          { label: 'Service Clicked', count: 0 },
        ]
      : [
          { label: 'Landing Page Visits', count: 0 },
          { label: 'Interactions', count: 0 },
          { label: 'Form Started', count: 0 },
          { label: 'Form Submitted', count: 0 },
        ]

  return {
    rangeId: window.rangeId,
    kpis: { ...ZERO_KPIS },
    kpiChanges: {},
    series: kpiSeries.visitors,
    kpiSeries,
    kpiByState: [],
    funnel,
    uniqueVisitors7d: 0,
    avgEngagedSecPerSession: 0,
    topCity: '-',
    bestDayLabel: '-',
    hasEvents24h: false,
    activeUsersNow: 0,
  }
}

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
}

function normalizeOverviewStateInput(raw: string): {
  name: string
  code: string
} | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  for (const [name, code] of Object.entries(US_STATE_NAME_TO_CODE)) {
    if (code === upper || name.toLowerCase() === trimmed.toLowerCase()) {
      return { name, code }
    }
  }
  return null
}

const CITY_ZIP_SAMPLE_LIMIT = 250

const CITY_GROUP_SQL = `if(city != '', city, if(zipcode != '', concat('ZIP ', zipcode), 'Unknown'))`
const CITY_LOCATION_SQL = `(city != '' OR zipcode != '' OR (latitude != 0 AND longitude != 0))`

export async function getAnalyticsOverviewCities({
  workspaceId,
  state: stateRaw,
  formTypeRaw,
  utmFilter,
  rangeId = DEFAULT_ANALYTICS_RANGE_ID,
  custom,
}: {
  workspaceId: string
  state: string
  formTypeRaw?: string
  utmFilter?: AnalyticsUtmFilter
  rangeId?: AnalyticsRangeId
  custom?: AnalyticsCustomRange
}): Promise<{ state: string; cities: OverviewCityMetric[] }> {
  const normalized = normalizeOverviewStateInput(stateRaw)
  if (!normalized) {
    return { state: stateRaw.trim(), cities: [] }
  }

  const formType = parseLandingFormType(formTypeRaw)
  const window = await resolveAnalyticsWindowForLanding(rangeId, workspaceId, new Date(), custom)
  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    state_name: normalized.name,
    state_code: normalized.code,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const cacheKey = `analytics:overview:cities:v9-zip-form:${workspaceId}:${formType}:${normalized.code}:${rangeCacheKey(window, utmFilterCacheKey(utmFilter))}`

  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as {
        state: string
        cities: OverviewCityMetric[]
      }
    }
  } catch {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()
  const stateMatch = `(
    lowerUTF8(trim(state)) = lowerUTF8({state_name:String})
    OR upperUTF8(trim(state)) = {state_code:String}
  )`
  const cityWhere = `${where}
          AND ${stateMatch}
          AND country IN ('United States', 'USA', 'US')
          AND ${CITY_LOCATION_SQL}`

  const [cityMetricsRes, cityBounceRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          ${CITY_GROUP_SQL} AS city_label,
          avgIf(latitude, latitude != 0 AND longitude != 0) AS avg_latitude,
          avgIf(longitude, latitude != 0 AND longitude != 0) AS avg_longitude,
          uniqExactIf(zipcode, zipcode != '') AS zip_count,
          arraySlice(
            arraySort(groupUniqArrayIf(toString(zipcode), zipcode != '')),
            1,
            ${CITY_ZIP_SAMPLE_LIMIT}
          ) AS zipcodes,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExact(session_id) AS sessions,
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
        FROM events_raw
        WHERE ${cityWhere}
        GROUP BY city_label
        ORDER BY visitors DESC
        LIMIT 500
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          session_city AS city_label,
          sumIf(1, is_bounce = 1) AS bounces,
          count() AS sessions
        FROM (
          SELECT
            session_id,
            anyHeavyIf(${CITY_GROUP_SQL}, ${CITY_LOCATION_SQL}) AS session_city,
            toUInt8(count() = 1) AS is_bounce
          FROM events_raw
          WHERE ${cityWhere}
          GROUP BY session_id
        )
        WHERE session_city != ''
        GROUP BY session_city
      `,
    }),
  ])

  const cityMetricRows =
    (
      (await cityMetricsRes.json()) as CHJson<{
        city_label: string
        avg_latitude: string | number | null
        avg_longitude: string | number | null
        zip_count: string
        zipcodes: string[] | null
        visitors: string
        sessions: string
        page_views: string
        form_submitted: string
      }>
    ).data ?? []
  const cityBounceRows =
    (
      (await cityBounceRes.json()) as CHJson<{
        city_label: string
        bounces: string
        sessions: string
      }>
    ).data ?? []

  const bounceByCity = new Map<string, { bounces: number; sessions: number }>()
  for (const row of cityBounceRows) {
    bounceByCity.set(row.city_label, {
      bounces: n(row.bounces),
      sessions: n(row.sessions),
    })
  }

  const cities: OverviewCityMetric[] = cityMetricRows.map((row) => {
    const citySessions = n(row.sessions)
    const citySubmitted = n(row.form_submitted)
    const bounce = bounceByCity.get(row.city_label)
    const coords = resolveUsCityCoordinates({
      city: row.city_label,
      stateCode: normalized.code,
      latitude: n(row.avg_latitude),
      longitude: n(row.avg_longitude),
    })
    const zipcodes = Array.isArray(row.zipcodes) ? row.zipcodes : []
    const countyFips = resolveCountyFipsForZips(zipcodes)
    return {
      city: row.city_label,
      state: normalized.name,
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : {}),
      ...(countyFips ? { countyFips } : {}),
      zipCount: n(row.zip_count),
      zipcodes,
      visitors: n(row.visitors),
      sessions: citySessions,
      pageViews: n(row.page_views),
      formSubmitted: citySubmitted,
      fsr: fsrPct(citySubmitted, citySessions),
      bounceRate: bouncePct(bounce?.bounces ?? 0, bounce?.sessions ?? 0),
    }
  })

  const result = { state: normalized.name, cities }
  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 45)
  } catch {
    // ignore cache write errors
  }
  return result
}

export async function getAnalyticsOverviewZipcodes({
  workspaceId,
  state: stateRaw,
  city: cityRaw,
  formTypeRaw,
  utmFilter,
  rangeId = DEFAULT_ANALYTICS_RANGE_ID,
  custom,
}: {
  workspaceId: string
  state: string
  city: string
  formTypeRaw?: string
  utmFilter?: AnalyticsUtmFilter
  rangeId?: AnalyticsRangeId
  custom?: AnalyticsCustomRange
}): Promise<{ state: string; city: string; zipcodes: OverviewZipcodeMetric[] }> {
  const normalized = normalizeOverviewStateInput(stateRaw)
  const city = cityRaw.trim()
  if (!normalized || !city) {
    return { state: stateRaw.trim(), city, zipcodes: [] }
  }

  const formType = parseLandingFormType(formTypeRaw)
  const window = await resolveAnalyticsWindowForLanding(rangeId, workspaceId, new Date(), custom)
  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    state_name: normalized.name,
    state_code: normalized.code,
    city_name: city,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const cacheKey = `analytics:overview:zipcodes:v2-zip-form:${workspaceId}:${formType}:${normalized.code}:${city.toLowerCase()}:${rangeCacheKey(window, utmFilterCacheKey(utmFilter))}`

  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as {
        state: string
        city: string
        zipcodes: OverviewZipcodeMetric[]
      }
    }
  } catch {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()
  const stateMatch = `(
    lowerUTF8(trim(state)) = lowerUTF8({state_name:String})
    OR upperUTF8(trim(state)) = {state_code:String}
  )`
  const zipWhere = `${where}
          AND city != ''
          AND lowerUTF8(trim(city)) = lowerUTF8(trim({city_name:String}))
          AND zipcode != ''
          AND ${stateMatch}
          AND country IN ('United States', 'USA', 'US')`

  const [zipMetricsRes, zipBounceRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          zipcode AS zipcode,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExact(session_id) AS sessions,
          countIf(event_name = 'page_view') AS page_views,
          uniqExactIf(session_id, ${submissionEventSqlPredicate(formType)}) AS form_submitted
        FROM events_raw
        WHERE ${zipWhere}
        GROUP BY zipcode
        ORDER BY visitors DESC
        LIMIT 120
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          session_zip AS zipcode,
          sumIf(1, is_bounce = 1) AS bounces,
          count() AS sessions
        FROM (
          SELECT
            session_id,
            anyHeavyIf(zipcode, zipcode != '') AS session_zip,
            toUInt8(count() = 1) AS is_bounce
          FROM events_raw
          WHERE ${zipWhere}
          GROUP BY session_id
        )
        WHERE session_zip != ''
        GROUP BY session_zip
      `,
    }),
  ])

  const zipMetricRows =
    (
      (await zipMetricsRes.json()) as CHJson<{
        zipcode: string
        visitors: string
        sessions: string
        page_views: string
        form_submitted: string
      }>
    ).data ?? []
  const zipBounceRows =
    (
      (await zipBounceRes.json()) as CHJson<{
        zipcode: string
        bounces: string
        sessions: string
      }>
    ).data ?? []

  const bounceByZip = new Map<string, { bounces: number; sessions: number }>()
  for (const row of zipBounceRows) {
    bounceByZip.set(row.zipcode, {
      bounces: n(row.bounces),
      sessions: n(row.sessions),
    })
  }

  const zipcodes: OverviewZipcodeMetric[] = zipMetricRows.map((row) => {
    const zipSessions = n(row.sessions)
    const zipSubmitted = n(row.form_submitted)
    const bounce = bounceByZip.get(row.zipcode)
    return {
      zipcode: row.zipcode,
      city,
      state: normalized.name,
      visitors: n(row.visitors),
      sessions: zipSessions,
      pageViews: n(row.page_views),
      formSubmitted: zipSubmitted,
      fsr: fsrPct(zipSubmitted, zipSessions),
      bounceRate: bouncePct(bounce?.bounces ?? 0, bounce?.sessions ?? 0),
    }
  })

  const result = { state: normalized.name, city, zipcodes }
  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 45)
  } catch {
    // ignore cache write errors
  }
  return result
}

export interface LandingPageCardMetrics {
  activeUsers: number
  visitors7d: number
  formSubmissions: number
  bounceRate: number
}

/** Card bounce should match recent traffic, not a 24-month full-session scan. */
const CARD_BOUNCE_LOOKBACK = '30 DAY'
/** Slightly longer than the dashboard poll so collection refreshes can hit Redis. */
const LANDING_SUMMARY_CACHE_TTL_SEC = 60

function landingSummaryCacheKey(
  workspaceId: string,
  formType: LandingFormType,
): string {
  return `analytics:landing-summary:v6:${workspaceId}:${formType}`
}

export async function getLandingPageCardMetrics(
  workspaceId: string,
  formTypeRaw?: string,
): Promise<LandingPageCardMetrics> {
  const formType = parseLandingFormType(formTypeRaw)
  const cacheKey = landingSummaryCacheKey(workspaceId, formType)
  const cached = await readAnalyticsCache<LandingPageCardMetrics>(cacheKey)
  if (cached) return cached

  const byId = await queryLandingPageCardMetrics([
    { workspaceId, formType },
  ])
  const result = byId[workspaceId] ?? emptyLandingPageCardMetrics()
  await writeAnalyticsCache(cacheKey, result, LANDING_SUMMARY_CACHE_TTL_SEC)
  return result
}

export type LandingPageCardMetricsRequest = {
  workspaceId: string
  formType?: string
}

/**
 * Batch card metrics for many landing pages.
 * Groups by form_type so ClickHouse does one scan set per form type, not per page.
 */
export async function getLandingPageCardMetricsBatch(
  pages: LandingPageCardMetricsRequest[],
): Promise<Record<string, LandingPageCardMetrics>> {
  const normalized = pages
    .filter((page) => typeof page.workspaceId === 'string' && page.workspaceId)
    .map((page) => ({
      workspaceId: page.workspaceId,
      formType: parseLandingFormType(page.formType),
    }))

  if (normalized.length === 0) return {}

  const result: Record<string, LandingPageCardMetrics> = {}
  const missing: Array<{ workspaceId: string; formType: LandingFormType }> = []

  await Promise.all(
    normalized.map(async (page) => {
      const cached = await readAnalyticsCache<LandingPageCardMetrics>(
        landingSummaryCacheKey(page.workspaceId, page.formType),
      )
      if (cached) {
        result[page.workspaceId] = cached
        return
      }
      missing.push(page)
    }),
  )

  if (missing.length === 0) return result

  const byFormType = new Map<LandingFormType, string[]>()
  for (const page of missing) {
    const list = byFormType.get(page.formType) ?? []
    list.push(page.workspaceId)
    byFormType.set(page.formType, list)
  }

  for (const [formType, workspaceIds] of byFormType) {
    const uniqueIds = [...new Set(workspaceIds)]
    const queried = await queryLandingPageCardMetrics(
      uniqueIds.map((workspaceId) => ({ workspaceId, formType })),
    )
    await Promise.all(
      uniqueIds.map(async (workspaceId) => {
        const metrics = queried[workspaceId] ?? emptyLandingPageCardMetrics()
        result[workspaceId] = metrics
        await writeAnalyticsCache(
          landingSummaryCacheKey(workspaceId, formType),
          metrics,
          LANDING_SUMMARY_CACHE_TTL_SEC,
        )
      }),
    )
  }

  return result
}

async function queryLandingPageCardMetrics(
  pages: Array<{ workspaceId: string; formType: LandingFormType }>,
): Promise<Record<string, LandingPageCardMetrics>> {
  if (pages.length === 0) return {}

  // Callers group by formType; mixed types would make submission SQL ambiguous.
  const formType = pages[0]!.formType
  const workspaceIds = [...new Set(pages.map((page) => page.workspaceId))]
  const ch = getClickHouseClient()
  const submissionPred = submissionEventSqlPredicate(formType)

  const res = await ch.query({
    query: `
      WITH
        metrics AS (
          SELECT
            workspace_id,
            uniqExactIf(
              user_id,
              created_at >= now() - INTERVAL 5 MINUTE
                AND event_name IN ('heartbeat', 'page_view')
            ) AS active_users,
            uniqExactIf(
              user_id,
              created_at >= now() - INTERVAL 7 DAY
                AND event_name = 'page_view'
            ) AS visitors_7d,
            uniqExactIf(
              session_id,
              ${submissionPred}
            ) AS form_submissions
          FROM events_raw
          WHERE workspace_id IN ({wids:Array(UUID)})
          GROUP BY workspace_id
        ),
        bounce AS (
          SELECT
            workspace_id,
            sumIf(1, is_bounce = 1) AS bounces,
            count() AS sessions
          FROM (
            SELECT
              workspace_id,
              session_id,
              toUInt8(count() = 1) AS is_bounce
            FROM events_raw
            WHERE workspace_id IN ({wids:Array(UUID)})
              AND created_at >= now() - INTERVAL ${CARD_BOUNCE_LOOKBACK}
            GROUP BY workspace_id, session_id
          )
          GROUP BY workspace_id
        )
      SELECT
        m.workspace_id AS workspace_id,
        m.active_users AS active_users,
        m.visitors_7d AS visitors_7d,
        m.form_submissions AS form_submissions,
        b.bounces AS bounces,
        b.sessions AS sessions
      FROM metrics AS m
      LEFT JOIN bounce AS b ON b.workspace_id = m.workspace_id
    `,
    query_params: { wids: workspaceIds },
    format: 'JSON',
  })

  const rows = (
    (await res.json()) as CHJson<{
      workspace_id: string
      active_users: string
      visitors_7d: string
      form_submissions: string
      bounces: string
      sessions: string
    }>
  ).data

  const byId: Record<string, LandingPageCardMetrics> = {}
  for (const workspaceId of workspaceIds) {
    byId[workspaceId] = emptyLandingPageCardMetrics()
  }
  for (const row of rows ?? []) {
    byId[row.workspace_id] = {
      activeUsers: n(row.active_users),
      visitors7d: n(row.visitors_7d),
      formSubmissions: n(row.form_submissions),
      bounceRate: bouncePct(n(row.bounces), n(row.sessions)),
    }
  }
  return byId
}

export function emptyLandingPageCardMetrics(): LandingPageCardMetrics {
  return {
    activeUsers: 0,
    visitors7d: 0,
    formSubmissions: 0,
    bounceRate: 0,
  }
}
