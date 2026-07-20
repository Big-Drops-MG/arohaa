import { redis } from './redis.service.js'
import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeLookbackFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsGranularity,
  type AnalyticsWindow,
} from '../lib/analytics-range.js'
import {
  utmFilterParams,
  utmFilterSql,
  utmFilterCacheKey,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import {
  addAnalyticsEtDays,
  analyticsDayKey,
  analyticsEtToUtcMs,
  analyticsHourKey,
  analyticsMondayKey,
  analyticsMonthKey,
  chDayBucketKey,
  chHourBucketKey,
  chMonthBucketKey,
  chToDate,
  chWeekBucketKey,
  formatAnalyticsSeriesHour,
  formatAnalyticsSeriesMonthDay,
  formatAnalyticsSeriesMonthYear,
  getAnalyticsEtParts,
  parseAnalyticsEtDayKey,
  parseAnalyticsEtMonthKey,
  startOfAnalyticsEtDay,
  startOfAnalyticsEtHour,
} from '../lib/analytics-timezone.js'
import type {
  ReferrerRow,
  TopPageRow,
  TrafficByDeviceRow,
  TrafficByLocationRow,
  TrafficByTimeRow,
  TrafficDashboardResponse,
  TrafficRangeId,
  TrafficUtmParamKey,
  UtmParamTab,
  UtmParameterRow,
} from '../types/analytics-traffic.js'

type CHJson<T> = { data: T[] }

const TOP_N = 20
const UTM_TOP_PER_SOURCE = 30

const UTM_PARAM_TABS: ReadonlyArray<{
  key: TrafficUtmParamKey
  label: string
}> = [
  { key: 'utm_source', label: 'Source' },
  { key: 'utm_medium', label: 'Medium' },
  { key: 'utm_campaign', label: 'Campaign' },
  { key: 'utm_term', label: 'Term' },
  { key: 'utm_content', label: 'Content' },
  { key: 'utm_id', label: 'ID' },
  { key: 'utm_s1', label: 'S1' },
] as const

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round2 = (v: number) => Math.round(v * 100) / 100

function bouncePct(bounces: number, sessions: number): number {
  return sessions > 0 ? round2((bounces / sessions) * 100) : 0
}

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round2((formSuccessSessions / sessions) * 100) : 0
}

function useEventsRaw(
  window: AnalyticsWindow,
  utmFilter?: AnalyticsUtmFilter,
): boolean {
  return window.granularity === 'hour' || Boolean(utmFilter)
}

/** Map half-open [range_from, range_to) onto daily_metrics `day` (ET calendar). */
function dailyMetricsDayFilter(): string {
  return `workspace_id = {wid:UUID} AND day >= ${chToDate("toDateTime64({range_from:String}, 3, 'UTC')")} AND day <= ${chToDate("toDateTime64({range_to:String}, 3, 'UTC') - INTERVAL 1 MILLISECOND")}`
}

// Strip query strings from URLs before path() so top pages are not split by UTM params.
const PAGE_PATH_EXPR = `
  multiIf(
    url = '', '/',
    positionCaseInsensitive(url, '://') > 0,
      coalesce(nullIf(path(cutQueryStringAndFragment(url)), ''), '/'),
    startsWith(url, '/'),
      coalesce(nullIf(splitByChar('?', url)[1], ''), '/'),
    concat('/', coalesce(nullIf(splitByChar('?', url)[1], ''), ''))
  )
`

const REFERRER_DOMAIN_EXPR = `
  multiIf(
    referrer_source != '' AND referrer_source NOT IN ('direct', 'unknown'),
    referrer_source,
    referrer != '' AND referrer != 'direct',
    replaceRegexpOne(
      domain(
        if(
          positionCaseInsensitive(referrer, '://') > 0,
          cutQueryStringAndFragment(referrer),
          concat('https://', referrer)
        )
      ),
      '^www\\.',
      ''
    ),
    'Direct'
  )
`

const UTM_LABEL_EXPR = `
  arrayStringConcat(
    arrayFilter(x -> x != '', [utm_source, utm_medium, utm_campaign, utm_id, utm_s1]),
    ' / '
  )
`

const ACTIVE_USERS_QUERY = (utmFilter?: AnalyticsUtmFilter) => `
  SELECT uniqExactIf(
    user_id,
    created_at >= now() - INTERVAL 5 MINUTE
      AND event_name IN ('heartbeat', 'page_view')
  ) AS active_users
  FROM events_raw
  WHERE workspace_id = {wid:UUID}${utmFilterSql(utmFilter)}
`

function kpiQuery(window: AnalyticsWindow, utmFilter?: AnalyticsUtmFilter): string {
  if (useEventsRaw(window, utmFilter)) {
    return `
      SELECT
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        countIf(event_name = 'page_view') AS page_views
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)}
    `
  }
  return `
    SELECT
      uniqMerge(visitors) AS visitors,
      uniqMerge(sessions) AS sessions,
      sum(pageviews) AS page_views
    FROM daily_metrics
    WHERE ${dailyMetricsDayFilter()}
  `
}

/** Bounce = session with exactly one event in the range. */
function bounceQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      sumIf(1, is_bounce = 1) AS bounces,
      count() AS sessions
    FROM (
      SELECT session_id, toUInt8(count() = 1) AS is_bounce
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)}
      GROUP BY session_id
    )
  `
}

function timeBucketExpr(
  granularity: AnalyticsGranularity,
  source: 'events' | 'daily',
): string {
  if (source === 'events') {
    if (granularity === 'hour') return chHourBucketKey('created_at')
    if (granularity === 'day') return chDayBucketKey('created_at')
    if (granularity === 'week') return chWeekBucketKey('created_at')
    return chMonthBucketKey('created_at')
  }
  if (granularity === 'day') return 'toString(day)'
  if (granularity === 'week') return 'toString(toMonday(day))'
  return "formatDateTime(toDateTime(day), '%Y-%m')"
}

function trafficByTimeQuery(
  window: AnalyticsWindow,
  utmFilter?: AnalyticsUtmFilter,
): string {
  if (useEventsRaw(window, utmFilter)) {
    return `
      SELECT
        ${timeBucketExpr(window.granularity, 'events')} AS bucket,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, event_name = 'form_success') AS form_submitted
      FROM events_raw
      WHERE ${rangeLookbackFilter(utmFilter)}
      GROUP BY bucket
      ORDER BY bucket ASC
    `
  }

  return `
    SELECT
      ${timeBucketExpr(window.granularity, 'daily')} AS bucket,
      uniqMerge(visitors) AS visitors,
      uniqMerge(sessions) AS sessions,
      uniqMerge(form_submitted) AS form_submitted
    FROM daily_metrics
    WHERE ${dailyMetricsDayFilter()}
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function trafficByDeviceQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      lower(device) AS device,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExact(session_id) AS sessions
    FROM events_raw
    WHERE ${rangeFilter(utmFilter)}
    GROUP BY device
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function topPagesQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      page,
      uniqExact(user_id) AS visitors
    FROM (
      SELECT
        user_id,
        ${PAGE_PATH_EXPR} AS page
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)} AND event_name = 'page_view'
    )
    GROUP BY page
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function trafficByLocationQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      city_label AS city,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExact(session_id) AS sessions
    FROM (
      SELECT
        if(city = '', 'Unknown', city) AS city_label,
        user_id,
        session_id,
        event_name
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)}
    )
    GROUP BY city_label
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function referrersQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      if(referrer_domain = '', 'Direct', referrer_domain) AS domain,
      uniqExact(user_id) AS visitors
    FROM (
      SELECT
        user_id,
        ${REFERRER_DOMAIN_EXPR} AS referrer_domain
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)} AND event_name = 'page_view'
    )
    GROUP BY domain
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function utmParametersQuery(utmFilter?: AnalyticsUtmFilter): string {
  return `
    SELECT
      ${UTM_LABEL_EXPR} AS domain,
      visitors
    FROM (
      SELECT
        sess_utm_source AS utm_source,
        sess_utm_medium AS utm_medium,
        sess_utm_campaign AS utm_campaign,
        sess_utm_id AS utm_id,
        sess_utm_s1 AS utm_s1,
        uniqExact(user_id) AS visitors
      FROM (
        SELECT
          session_id,
          any(user_id) AS user_id,
          anyIf(utm_source, utm_source != '') AS sess_utm_source,
          anyIf(utm_medium, utm_medium != '') AS sess_utm_medium,
          anyIf(utm_campaign, utm_campaign != '') AS sess_utm_campaign,
          anyIf(utm_id, utm_id != '') AS sess_utm_id,
          anyIf(utm_s1, utm_s1 != '') AS sess_utm_s1
        FROM events_raw
        WHERE ${rangeFilter(utmFilter)}
        GROUP BY session_id
        HAVING max(event_name = 'page_view') = 1
      )
      WHERE sess_utm_source != ''
      GROUP BY utm_source, utm_medium, utm_campaign, utm_id, utm_s1
      HAVING ${UTM_LABEL_EXPR} != ''
      ORDER BY utm_source ASC, visitors DESC
      LIMIT ${UTM_TOP_PER_SOURCE} BY utm_source
    )
    ORDER BY
      sum(visitors) OVER (PARTITION BY utm_source) DESC,
      utm_source ASC,
      visitors DESC
  `
}

function utmParamDimensionQuery(
  dimension: TrafficUtmParamKey,
  utmFilter?: AnalyticsUtmFilter,
): string {
  return `
    SELECT
      value,
      uniqExact(user_id) AS visitors
    FROM (
      SELECT
        any(user_id) AS user_id,
        anyIf(${dimension}, ${dimension} != '') AS value
      FROM events_raw
      WHERE ${rangeFilter(utmFilter)}
      GROUP BY session_id
      HAVING max(event_name = 'page_view') = 1
    )
    WHERE value != ''
    GROUP BY value
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function bucketLabel(bucket: Date, granularity: AnalyticsGranularity): string {
  if (granularity === 'hour') {
    return formatAnalyticsSeriesHour(bucket)
  }
  if (granularity === 'month') {
    return formatAnalyticsSeriesMonthYear(bucket)
  }
  return formatAnalyticsSeriesMonthDay(bucket)
}

function normalizeBucketKey(
  raw: string,
  granularity: AnalyticsGranularity,
): string {
  if (granularity === 'hour') {
    return raw.slice(0, 13).replace(' ', 'T')
  }
  if (granularity === 'month') {
    return raw.slice(0, 7)
  }
  return raw.slice(0, 10)
}

function formatDevice(device: string): string {
  const normalized = device.trim().toLowerCase() || 'desktop'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

type TimeAggRow = {
  bucket: string
  visitors: string
  sessions: string
  form_submitted: string
}

function startOfAnalyticsEtMonth(date: Date): Date {
  const { year, month } = getAnalyticsEtParts(date)
  return new Date(analyticsEtToUtcMs(year, month, 1, 0, 0, 0))
}

function addAnalyticsEtMonths(date: Date, months: number): Date {
  const { year, month } = getAnalyticsEtParts(date)
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1))
  return new Date(
    analyticsEtToUtcMs(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
    ),
  )
}

function buildTrafficByTime(
  window: AnalyticsWindow,
  rows: TimeAggRow[],
): TrafficByTimeRow[] {
  const { granularity } = window
  const agg = new Map<
    string,
    { visitors: number; sessions: number; formSubmitted: number }
  >()
  for (const row of rows) {
    const key = normalizeBucketKey(row.bucket, granularity)
    agg.set(key, {
      visitors: n(row.visitors),
      sessions: n(row.sessions),
      formSubmitted: n(row.form_submitted),
    })
  }

  const out: TrafficByTimeRow[] = []

  const pushBucket = (d: Date, key: string) => {
    const m = agg.get(key)
    out.push({
      date: bucketLabel(d, granularity),
      visitors: m?.visitors ?? 0,
      sessions: m?.sessions ?? 0,
      formSubmitted: m?.formSubmitted ?? 0,
    })
  }

  if (granularity === 'hour') {
    let cursor = startOfAnalyticsEtHour(window.start)
    while (cursor < window.seriesEnd) {
      pushBucket(cursor, analyticsHourKey(cursor))
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000)
    }
    return out
  }

  if (granularity === 'day') {
    let cursor = startOfAnalyticsEtDay(window.start)
    while (cursor < window.seriesEnd) {
      pushBucket(cursor, analyticsDayKey(cursor))
      cursor = addAnalyticsEtDays(cursor, 1)
    }
    return out
  }

  if (granularity === 'week') {
    let cursor = startOfAnalyticsEtDay(
      parseAnalyticsEtDayKey(analyticsMondayKey(window.start)),
    )
    while (cursor < window.seriesEnd) {
      pushBucket(cursor, analyticsDayKey(cursor))
      cursor = addAnalyticsEtDays(cursor, 7)
    }
    return out
  }

  let cursor = startOfAnalyticsEtMonth(window.start)
  while (cursor < window.seriesEnd) {
    const key = analyticsMonthKey(cursor)
    pushBucket(parseAnalyticsEtMonthKey(key), key)
    cursor = addAnalyticsEtMonths(cursor, 1)
  }
  return out
}

export interface GetAnalyticsTrafficParams {
  workspaceId: string
  rangeId: TrafficRangeId
  custom?: AnalyticsCustomRange
  utmFilter?: AnalyticsUtmFilter
}

export async function getAnalyticsTraffic({
  workspaceId,
  rangeId,
  custom,
  utmFilter,
}: GetAnalyticsTrafficParams): Promise<TrafficDashboardResponse> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const utmKey = utmFilterCacheKey(utmFilter)
  const cacheKey = `analytics:traffic:v4:${workspaceId}:${rangeCacheKey(window, utmKey)}`
  try {
    const cachedStr = await redis.get(cacheKey)
    if (cachedStr) {
      return JSON.parse(cachedStr) as TrafficDashboardResponse
    }
  } catch (err) {
    // ignore cache read errors
  }

  const ch = getClickHouseClient()
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const q = (query: string) => ch.query({ format: 'JSON', query_params: p, query })

  const [
    activeRes,
    kpiRes,
    bounceRes,
    timeRes,
    deviceRes,
    pagesRes,
    locationRes,
    referrersRes,
    utmRes,
    ...utmParamResults
  ] = await Promise.all([
    q(ACTIVE_USERS_QUERY(utmFilter)),
    q(kpiQuery(window, utmFilter)),
    q(bounceQuery(utmFilter)),
    q(trafficByTimeQuery(window, utmFilter)),
    q(trafficByDeviceQuery(utmFilter)),
    q(topPagesQuery(utmFilter)),
    q(trafficByLocationQuery(utmFilter)),
    q(referrersQuery(utmFilter)),
    q(utmParametersQuery(utmFilter)),
    ...UTM_PARAM_TABS.map((tab) =>
      q(utmParamDimensionQuery(tab.key, utmFilter)),
    ),
  ])

  type KpiRow = { visitors: string; sessions: string; page_views: string }
  type BounceRow = { bounces: string; sessions: string }
  type ActiveRow = { active_users: string }
  type DeviceRow = {
    device: string
    visitors: string
    form_submitted: string
    sessions: string
  }
  type LocationRow = DeviceRow & { city: string }

  const kpiRow = ((await kpiRes.json()) as CHJson<KpiRow>).data[0]
  const bounceRow = ((await bounceRes.json()) as CHJson<BounceRow>).data[0]
  const activeRow = ((await activeRes.json()) as CHJson<ActiveRow>).data[0]
  const timeRows = ((await timeRes.json()) as CHJson<TimeAggRow>).data ?? []
  const deviceRows = ((await deviceRes.json()) as CHJson<DeviceRow>).data ?? []
  const pageRows = ((await pagesRes.json()) as CHJson<{ page: string; visitors: string }>).data ?? []
  const locationRows = ((await locationRes.json()) as CHJson<LocationRow>).data ?? []
  const referrerRows = ((await referrersRes.json()) as CHJson<{ domain: string; visitors: string }>).data ?? []
  const utmRows = ((await utmRes.json()) as CHJson<{ domain: string; visitors: string }>).data ?? []

  const visitors = n(kpiRow?.visitors)
  const sessions = n(kpiRow?.sessions)
  const pageViews = n(kpiRow?.page_views)
  const bounceSessions = n(bounceRow?.sessions)

  const trafficByDevice: TrafficByDeviceRow[] = deviceRows.map(row => {
    const deviceSessions = n(row.sessions)
    const formSubmitted = n(row.form_submitted)
    return {
      device: formatDevice(row.device),
      visitors: n(row.visitors),
      formSubmitted,
      fsr: fsrPct(formSubmitted, deviceSessions),
    }
  })

  const topPages: TopPageRow[] = pageRows.map(row => ({
    page: row.page || '/',
    visitors: n(row.visitors),
  }))

  const trafficByLocation: TrafficByLocationRow[] = locationRows.map(row => {
    const locSessions = n(row.sessions)
    const formSubmitted = n(row.form_submitted)
    return {
      city: row.city || 'Unknown',
      visitors: n(row.visitors),
      formSubmitted,
      fsr: fsrPct(formSubmitted, locSessions),
    }
  })

  const referrers: ReferrerRow[] = referrerRows.map(row => ({
    domain: row.domain || 'Direct',
    visitors: n(row.visitors),
  }))

  const utmParameters: UtmParameterRow[] = utmRows.map(row => ({
    domain: row.domain,
    visitors: n(row.visitors),
  }))

  const utmByParam: UtmParamTab[] = []
  for (let i = 0; i < UTM_PARAM_TABS.length; i++) {
    const tab = UTM_PARAM_TABS[i]!
    const result = utmParamResults[i]
    if (!result) continue
    const rows =
      (
        (await result.json()) as CHJson<{ value: string; visitors: string }>
      ).data ?? []
    if (rows.length === 0) continue
    utmByParam.push({
      key: tab.key,
      label: tab.label,
      rows: rows.map((row) => ({
        value: row.value,
        visitors: n(row.visitors),
      })),
    })
  }

  const response: TrafficDashboardResponse = {
    rangeId,
    kpis: {
      activeUsersNow: n(activeRow?.active_users),
      visitors,
      sessions,
      pageViews,
      bounceRate: bouncePct(n(bounceRow?.bounces), bounceSessions),
    },
    trafficByTime: buildTrafficByTime(window, timeRows),
    trafficByDevice,
    topPages,
    trafficByLocation,
    referrers,
    utmByParam,
    utmParameters,
  }

  try {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', 45)
  } catch (err) {
    // ignore cache write errors
  }
  return response
}

export function emptyAnalyticsTraffic(rangeId: TrafficRangeId): TrafficDashboardResponse {
  const window = resolveAnalyticsWindow(rangeId)
  return {
    rangeId,
    kpis: {
      activeUsersNow: 0,
      visitors: 0,
      sessions: 0,
      pageViews: 0,
      bounceRate: 0,
    },
    trafficByTime: buildTrafficByTime(window, []),
    trafficByDevice: [],
    topPages: [],
    trafficByLocation: [],
    referrers: [],
    utmByParam: [],
    utmParameters: [],
  }
}
