import { TtlMemoryCache } from '../lib/ttl-memory-cache.js'
import { getClickHouseClient } from './clickhouse.service.js'
import type {
  ReferrerRow,
  TopPageRow,
  TrafficByDeviceRow,
  TrafficByLocationRow,
  TrafficByTimeRow,
  TrafficDashboardResponse,
  TrafficRangeId,
  UtmParameterRow,
} from '../types/analytics-traffic.js'

type CHJson<T> = { data: T[] }

const TOP_N = 20
const UTM_TOP_PER_SOURCE = 30

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round2 = (v: number) => Math.round(v * 100) / 100

function bouncePct(bounces: number, sessions: number): number {
  return sessions > 0 ? round2((bounces / sessions) * 100) : 0
}

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round2((formSuccessSessions / sessions) * 100) : 0
}

const RANGE_CLICKHOUSE_INTERVAL: Record<TrafficRangeId, string> = {
  '24h': '24 HOUR',
  '7d': '7 DAY',
  '30d': '30 DAY',
  '3m': '3 MONTH',
  '12m': '12 MONTH',
  '24m': '24 MONTH',
}

/** Slightly wider lookback so the first bucket is not clipped at range boundaries. */
const RANGE_QUERY_LOOKBACK: Record<TrafficRangeId, string> = {
  '24h': '25 HOUR',
  '7d': '7 DAY',
  '30d': '30 DAY',
  '3m': '3 MONTH',
  '12m': '12 MONTH',
  '24m': '24 MONTH',
}

const RANGE_FILTER = (rangeId: TrafficRangeId) =>
  `workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${RANGE_CLICKHOUSE_INTERVAL[rangeId]}`

const RANGE_LOOKBACK_FILTER = (rangeId: TrafficRangeId) =>
  `workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${RANGE_QUERY_LOOKBACK[rangeId]}`

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

const ACTIVE_USERS_QUERY = `
  SELECT uniqExactIf(
    user_id,
    created_at >= now() - INTERVAL 5 MINUTE
      AND event_name IN ('heartbeat', 'page_view')
  ) AS active_users
  FROM events
  WHERE workspace_id = {wid:UUID}
`

function kpiQuery(rangeId: TrafficRangeId): string {
  return `
    SELECT
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExact(session_id) AS sessions,
      countIf(event_name = 'page_view') AS page_views
    FROM events
    WHERE ${RANGE_FILTER(rangeId)}
  `
}

/** Bounce = session with exactly one event in the range. */
function bounceQuery(rangeId: TrafficRangeId): string {
  const interval = RANGE_CLICKHOUSE_INTERVAL[rangeId]
  return `
    SELECT
      sumIf(1, is_bounce = 1) AS bounces,
      count() AS sessions
    FROM (
      SELECT session_id, toUInt8(count() = 1) AS is_bounce
      FROM events
      WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL ${interval}
      GROUP BY session_id
    )
  `
}

function trafficByTimeQuery(rangeId: TrafficRangeId): string {
  const bucketExpr =
    rangeId === '24h'
      ? 'toStartOfHour(created_at)'
      : rangeId === '7d' || rangeId === '30d'
        ? 'toDate(created_at)'
        : rangeId === '3m'
          ? 'toMonday(toDate(created_at))'
          : 'toStartOfMonth(created_at)'

  return `
    SELECT
      ${bucketExpr} AS bucket,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExact(session_id) AS sessions,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted
    FROM events
    WHERE ${RANGE_LOOKBACK_FILTER(rangeId)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `
}

function trafficByDeviceQuery(rangeId: TrafficRangeId): string {
  return `
    SELECT
      lower(device) AS device,
      uniqExactIf(user_id, event_name = 'page_view') AS visitors,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExact(session_id) AS sessions
    FROM events
    WHERE ${RANGE_FILTER(rangeId)}
    GROUP BY device
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function topPagesQuery(rangeId: TrafficRangeId): string {
  return `
    SELECT
      page,
      uniqExact(user_id) AS visitors
    FROM (
      SELECT
        user_id,
        ${PAGE_PATH_EXPR} AS page
      FROM events
      WHERE ${RANGE_FILTER(rangeId)} AND event_name = 'page_view'
    )
    GROUP BY page
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function trafficByLocationQuery(rangeId: TrafficRangeId): string {
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
      FROM events
      WHERE ${RANGE_FILTER(rangeId)}
    )
    GROUP BY city_label
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function referrersQuery(rangeId: TrafficRangeId): string {
  return `
    SELECT
      if(referrer_domain = '', 'Direct', referrer_domain) AS domain,
      uniqExact(user_id) AS visitors
    FROM (
      SELECT
        user_id,
        ${REFERRER_DOMAIN_EXPR} AS referrer_domain
      FROM events
      WHERE ${RANGE_FILTER(rangeId)} AND event_name = 'page_view'
    )
    GROUP BY domain
    ORDER BY visitors DESC
    LIMIT ${TOP_N}
  `
}

function utmParametersQuery(rangeId: TrafficRangeId): string {
  return `
    SELECT
      ${UTM_LABEL_EXPR} AS domain,
      visitors
    FROM (
      SELECT
        utm_source,
        utm_medium,
        utm_campaign,
        utm_id,
        utm_s1,
        uniqExact(user_id) AS visitors
      FROM (
        SELECT
          session_id,
          any(user_id) AS user_id,
          anyIf(utm_source, utm_source != '') AS utm_source,
          anyIf(utm_medium, utm_medium != '') AS utm_medium,
          anyIf(utm_campaign, utm_campaign != '') AS utm_campaign,
          anyIf(utm_id, utm_id != '') AS utm_id,
          anyIf(utm_s1, utm_s1 != '') AS utm_s1
        FROM events
        WHERE ${RANGE_FILTER(rangeId)}
        GROUP BY session_id
        HAVING max(event_name = 'page_view') = 1
      )
      WHERE utm_source != ''
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

function getMonday(d: Date): string {
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() + diff)
  mon.setUTCHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function bucketLabel(bucket: Date, rangeId: TrafficRangeId): string {
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

function normalizeBucketKey(raw: string, rangeId: TrafficRangeId): string {
  if (rangeId === '24h') {
    return raw.slice(0, 13).replace(' ', 'T')
  }
  if (rangeId === '12m' || rangeId === '24m') {
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

function buildTrafficByTime(
  rangeId: TrafficRangeId,
  rows: TimeAggRow[],
  now: Date,
): TrafficByTimeRow[] {
  const agg = new Map<
    string,
    { visitors: number; sessions: number; formSubmitted: number }
  >()
  for (const row of rows) {
    const key = normalizeBucketKey(row.bucket, rangeId)
    agg.set(key, {
      visitors: n(row.visitors),
      sessions: n(row.sessions),
      formSubmitted: n(row.form_submitted),
    })
  }

  const out: TrafficByTimeRow[] = []

  if (rangeId === '24h') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCMinutes(0, 0, 0)
      d.setUTCHours(d.getUTCHours() - i)
      const key = d.toISOString().slice(0, 13)
      const m = agg.get(key)
      out.push({
        date: bucketLabel(d, rangeId),
        visitors: m?.visitors ?? 0,
        sessions: m?.sessions ?? 0,
        formSubmitted: m?.formSubmitted ?? 0,
      })
    }
    return out
  }

  if (rangeId === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      const m = agg.get(key)
      out.push({
        date: bucketLabel(d, rangeId),
        visitors: m?.visitors ?? 0,
        sessions: m?.sessions ?? 0,
        formSubmitted: m?.formSubmitted ?? 0,
      })
    }
    return out
  }

  if (rangeId === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      const m = agg.get(key)
      out.push({
        date: bucketLabel(d, rangeId),
        visitors: m?.visitors ?? 0,
        sessions: m?.sessions ?? 0,
        formSubmitted: m?.formSubmitted ?? 0,
      })
    }
    return out
  }

  if (rangeId === '3m') {
    const monday = getMonday(now)
    for (let i = 12; i >= 0; i--) {
      const d = new Date(monday + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - i * 7)
      const key = d.toISOString().slice(0, 10)
      const m = agg.get(key)
      out.push({
        date: bucketLabel(d, rangeId),
        visitors: m?.visitors ?? 0,
        sessions: m?.sessions ?? 0,
        formSubmitted: m?.formSubmitted ?? 0,
      })
    }
    return out
  }

  const monthCount = rangeId === '12m' ? 12 : 24
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = d.toISOString().slice(0, 7)
    const m = agg.get(key)
    out.push({
      date: bucketLabel(d, rangeId),
      visitors: m?.visitors ?? 0,
      sessions: m?.sessions ?? 0,
      formSubmitted: m?.formSubmitted ?? 0,
    })
  }
  return out
}

export interface GetAnalyticsTrafficParams {
  workspaceId: string
  rangeId: TrafficRangeId
}

const TRAFFIC_RESPONSE_CACHE = new TtlMemoryCache<TrafficDashboardResponse>(45_000)

export async function getAnalyticsTraffic({
  workspaceId,
  rangeId,
}: GetAnalyticsTrafficParams): Promise<TrafficDashboardResponse> {
  const cacheKey = `${workspaceId}:${rangeId}`
  const cached = TRAFFIC_RESPONSE_CACHE.get(cacheKey)
  if (cached) return cached

  const ch = getClickHouseClient()
  const p = { wid: workspaceId }
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
  ] = await Promise.all([
    q(ACTIVE_USERS_QUERY),
    q(kpiQuery(rangeId)),
    q(bounceQuery(rangeId)),
    q(trafficByTimeQuery(rangeId)),
    q(trafficByDeviceQuery(rangeId)),
    q(topPagesQuery(rangeId)),
    q(trafficByLocationQuery(rangeId)),
    q(referrersQuery(rangeId)),
    q(utmParametersQuery(rangeId)),
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

  const response: TrafficDashboardResponse = {
    rangeId,
    kpis: {
      activeUsersNow: n(activeRow?.active_users),
      visitors,
      sessions,
      pageViews,
      bounceRate: bouncePct(n(bounceRow?.bounces), bounceSessions),
    },
    trafficByTime: buildTrafficByTime(rangeId, timeRows, new Date()),
    trafficByDevice,
    topPages,
    trafficByLocation,
    referrers,
    utmParameters,
  }

  TRAFFIC_RESPONSE_CACHE.set(cacheKey, response)
  return response
}

export function emptyAnalyticsTraffic(rangeId: TrafficRangeId): TrafficDashboardResponse {
  return {
    rangeId,
    kpis: {
      activeUsersNow: 0,
      visitors: 0,
      sessions: 0,
      pageViews: 0,
      bounceRate: 0,
    },
    trafficByTime: buildTrafficByTime(rangeId, [], new Date()),
    trafficByDevice: [],
    topPages: [],
    trafficByLocation: [],
    referrers: [],
    utmParameters: [],
  }
}
