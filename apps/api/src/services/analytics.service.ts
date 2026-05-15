import { getClickHouseClient } from './clickhouse.service.js'

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

export interface AnalyticsOverview {
  kpis: Record<RangeId, RangeKpis>
  series: Record<RangeId, SeriesPoint[]>
  funnel: FunnelStep[]
  uniqueVisitors7d: number
  avgEngagedSecPerSession: number
  topCity: string
  bestDayLabel: string
  hasEvents24h: boolean
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

const DOW: Record<string, string> = {
  '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday',
  '5': 'Friday', '6': 'Saturday', '7': 'Sunday',
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

function buildSeries(
  rangeId: RangeId,
  hourly: Map<string, number>,
  daily: Map<string, number>,
  weekly: Map<string, number>,
  monthly: Map<string, number>,
  now: Date,
): SeriesPoint[] {
  const pts: SeriesPoint[] = []

  if (rangeId === '24h') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCMinutes(0, 0, 0)
      d.setUTCHours(d.getUTCHours() - i)
      pts.push({ label: seriesLabel(d, rangeId), value: hourly.get(d.toISOString().slice(0, 13)) ?? 0 })
    }
  } else if (rangeId === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - i)
      pts.push({ label: seriesLabel(d, rangeId), value: daily.get(d.toISOString().slice(0, 10)) ?? 0 })
    }
  } else if (rangeId === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - i)
      pts.push({ label: seriesLabel(d, rangeId), value: daily.get(d.toISOString().slice(0, 10)) ?? 0 })
    }
  } else if (rangeId === '3m') {
    const monday = getMonday(now)
    for (let i = 12; i >= 0; i--) {
      const d = new Date(monday + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - i * 7)
      pts.push({ label: seriesLabel(d, rangeId), value: weekly.get(d.toISOString().slice(0, 10)) ?? 0 })
    }
  } else if (rangeId === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      pts.push({ label: seriesLabel(d, rangeId), value: monthly.get(d.toISOString().slice(0, 7)) ?? 0 })
    }
  } else {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      pts.push({ label: seriesLabel(d, rangeId), value: monthly.get(d.toISOString().slice(0, 7)) ?? 0 })
    }
  }

  return pts
}

export async function getAnalyticsOverview(workspaceId: string): Promise<AnalyticsOverview> {
  const ch = getClickHouseClient()
  const p = { wid: workspaceId }

  const [kpiRes, bounceRes, hourlyRes, dailyRes, monthlyRes, funnelRes, cityRes, dowRes, engagedRes] =
    await Promise.all([
      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT
            uniqExactIf(user_id, created_at >= now() - INTERVAL 24 HOUR AND event_name = 'page_view') AS vis_24h,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 24 HOUR) AS ses_24h,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 24 HOUR) AS pv_24h,
            uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL 24 HOUR) AS fs_24h,
            uniqExactIf(user_id, created_at >= now() - INTERVAL 7 DAY AND event_name = 'page_view') AS vis_7d,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 7 DAY) AS ses_7d,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 7 DAY) AS pv_7d,
            uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL 7 DAY) AS fs_7d,
            uniqExactIf(user_id, created_at >= now() - INTERVAL 30 DAY AND event_name = 'page_view') AS vis_30d,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 30 DAY) AS ses_30d,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 30 DAY) AS pv_30d,
            uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL 30 DAY) AS fs_30d,
            uniqExactIf(user_id, created_at >= now() - INTERVAL 3 MONTH AND event_name = 'page_view') AS vis_3m,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 3 MONTH) AS ses_3m,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 3 MONTH) AS pv_3m,
            uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL 3 MONTH) AS fs_3m,
            uniqExactIf(user_id, created_at >= now() - INTERVAL 12 MONTH AND event_name = 'page_view') AS vis_12m,
            uniqExactIf(session_id, created_at >= now() - INTERVAL 12 MONTH) AS ses_12m,
            countIf(event_name = 'page_view' AND created_at >= now() - INTERVAL 12 MONTH) AS pv_12m,
            uniqExactIf(session_id, event_name = 'form_success' AND created_at >= now() - INTERVAL 12 MONTH) AS fs_12m,
            uniqExactIf(user_id, event_name = 'page_view') AS vis_24m,
            uniqExact(session_id) AS ses_24m,
            countIf(event_name = 'page_view') AS pv_24m,
            uniqExactIf(session_id, event_name = 'form_success') AS fs_24m
          FROM events
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH
        `,
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
            FROM events
            WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 24 MONTH
            GROUP BY session_id
          )
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT toStartOfHour(created_at) AS hour,
                 uniqExactIf(user_id, event_name = 'page_view') AS visitors
          FROM events
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 25 HOUR
          GROUP BY hour ORDER BY hour ASC
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT toDate(created_at) AS day,
                 uniqExactIf(user_id, event_name = 'page_view') AS visitors
          FROM events
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 91 DAY
          GROUP BY day ORDER BY day ASC
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT toStartOfMonth(created_at) AS month,
                 uniqExactIf(user_id, event_name = 'page_view') AS visitors
          FROM events
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 25 MONTH
          GROUP BY month ORDER BY month ASC
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT
            countIf(event_name = 'page_view') AS page_views,
            uniqExactIf(session_id, event_name IN ('button_click','link_click','form_start','scroll_depth')) AS interactions,
            uniqExactIf(session_id, event_name = 'form_start') AS form_started,
            uniqExactIf(session_id, event_name = 'form_success') AS form_submitted
          FROM events
          WHERE workspace_id = {wid:UUID} AND created_at >= now() - INTERVAL 7 DAY
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT city FROM events
          WHERE workspace_id = {wid:UUID} AND city != '' AND created_at >= now() - INTERVAL 7 DAY
          GROUP BY city ORDER BY count() DESC LIMIT 1
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT toDayOfWeek(created_at, 1) AS dow FROM events
          WHERE workspace_id = {wid:UUID} AND event_name = 'page_view' AND created_at >= now() - INTERVAL 7 DAY
          GROUP BY dow ORDER BY count() DESC LIMIT 1
        `,
      }),

      ch.query({
        format: 'JSON', query_params: p,
        query: `
          SELECT avg(max_engaged) AS avg_sec
          FROM (
            SELECT session_id, max(metric_value) AS max_engaged
            FROM events
            WHERE workspace_id = {wid:UUID} AND event_name = 'heartbeat'
              AND metric_name = 'engaged_seconds' AND created_at >= now() - INTERVAL 7 DAY
            GROUP BY session_id
          )
        `,
      }),
    ])

  type KR = Record<string, string>

  const kd = ((await kpiRes.json()) as CHJson<KR>).data[0] ?? {}
  const bd = ((await bounceRes.json()) as CHJson<KR>).data[0] ?? {}
  const hourlyRows = ((await hourlyRes.json()) as CHJson<{ hour: string; visitors: string }>).data
  const dailyRows = ((await dailyRes.json()) as CHJson<{ day: string; visitors: string }>).data
  const monthlyRows = ((await monthlyRes.json()) as CHJson<{ month: string; visitors: string }>).data
  const fd = ((await funnelRes.json()) as CHJson<KR>).data[0] ?? {}
  const cityRow = ((await cityRes.json()) as CHJson<{ city: string }>).data[0]
  const dowRow = ((await dowRes.json()) as CHJson<{ dow: string }>).data[0]
  const engRow = ((await engagedRes.json()) as CHJson<{ avg_sec: string | null }>).data[0]

  const hourly = new Map(hourlyRows.map(r => [r.hour.slice(0, 13).replace(' ', 'T'), n(r.visitors)]))
  const daily = new Map(dailyRows.map(r => [r.day.slice(0, 10), n(r.visitors)]))
  const monthly = new Map(monthlyRows.map(r => [r.month.slice(0, 7), n(r.visitors)]))

  const weekly = new Map<string, number>()
  for (const r of dailyRows) {
    const key = getMonday(new Date(r.day.slice(0, 10) + 'T00:00:00Z'))
    weekly.set(key, (weekly.get(key) ?? 0) + n(r.visitors))
  }

  const now = new Date()

  const RANGES: RangeId[] = ['24h', '7d', '30d', '3m', '12m', '24m']
  const series = Object.fromEntries(
    RANGES.map(rid => [rid, buildSeries(rid, hourly, daily, weekly, monthly, now)])
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

  return {
    kpis: {
      '24h': mkKpis('24h'), '7d': mkKpis('7d'), '30d': mkKpis('30d'),
      '3m': mkKpis('3m'), '12m': mkKpis('12m'), '24m': mkKpis('24m'),
    },
    series,
    funnel: [
      { label: 'Landing Page Visits', count: n(fd.page_views) },
      { label: 'Interactions', count: n(fd.interactions) },
      { label: 'Form Started', count: n(fd.form_started) },
      { label: 'Form Submitted', count: n(fd.form_submitted) },
    ],
    uniqueVisitors7d: n(kd.vis_7d),
    avgEngagedSecPerSession: n(engRow?.avg_sec),
    topCity: cityRow?.city ?? '-',
    bestDayLabel: DOW[dowRow?.dow ?? ''] ?? '-',
    hasEvents24h: n(kd.ses_24h) > 0,
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
      FROM events
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
        FROM events
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
  return {
    activeUsers: n(row?.active_users),
    formSubmissions7d: n(row?.form_submissions_7d),
    bounceRate7d: bouncePct(n(bounceRow?.bounce_7d), ses7d),
  }
}
