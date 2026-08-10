import { getClickHouseClient } from './clickhouse.service.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindow,
  type AnalyticsCustomRange,
  type AnalyticsRangeId,
} from '../lib/analytics-range.js'
import {
  utmFilterParams,
  utmFilterCacheKey,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'
import {
  chDayBucketKey,
  chToDayOfWeek,
  chToHour,
  chWeekBucketKey,
} from '../lib/analytics-timezone.js'
import { formatDayOfWeek, DAY_ORDER } from '../lib/day-of-week.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import type {
  AnalyticsInsights,
  InsightChart,
  InsightChartPoint,
  InsightKpi,
  InsightSectionId,
} from '../types/analytics-insights.js'
import { emptyAnalyticsInsights } from '../types/analytics-insights.js'

export { emptyAnalyticsInsights }

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100

const pct = (num: number, den: number) =>
  den > 0 ? round1((num / den) * 100) : 0

const TOP_N = 6

const FIELD = (key: string) =>
  `nullIf(JSONExtractString(JSONExtractRaw(properties, 'fields'), '${key}'), '')`

const LEAD_EVENT = `event_name IN ('form_success', 'service_click')`
const ZIP_SUBMIT = `event_name = 'zip_submit'`

const AGE_EXPR = `
  multiIf(
    match(${FIELD('dob')}, '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'),
      toYear(today()) - toInt32OrZero(substring(${FIELD('dob')}, 7, 4)),
    match(${FIELD('dob-0-year')}, '^[0-9]{4}$'),
      toYear(today()) - toInt32OrZero(${FIELD('dob-0-year')}),
    match(${FIELD('driver_0_age')}, '^[0-9]+$'),
      toInt32OrZero(${FIELD('driver_0_age')}),
    -1
  )
`

const AGE_BAND_EXPR = `
  multiIf(
    ${AGE_EXPR} < 0, 'Unknown',
    ${AGE_EXPR} < 25, 'Under 25',
    ${AGE_EXPR} < 35, '25-34',
    ${AGE_EXPR} < 45, '35-44',
    ${AGE_EXPR} < 55, '45-54',
    ${AGE_EXPR} < 65, '55-64',
    '65+'
  )
`

const AGE_BANDS = [
  'Under 25',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+',
  'Unknown',
] as const

const TF_EXPR = `
  (
    JSONExtractString(properties, 'xxTrustedFormCertUrl') != ''
    OR JSONExtractString(properties, 'TrustedFormCertUrl') != ''
    OR ${FIELD('xxTrustedFormCertUrl')} != ''
    OR ${FIELD('TrustedFormCertUrl')} != ''
  )
`

function kpi(
  id: string,
  label: string,
  value: number,
  format: InsightKpi['format'] = 'number',
): InsightKpi {
  return { id, label, value, format }
}

function pivotSeries(
  rows: Array<{ bucket: string; series: string; value: number }>,
  topSeries: string[],
): { points: InsightChartPoint[]; seriesKeys: string[] } {
  const keys = topSeries.length > 0 ? topSeries : ['Other']
  const byBucket = new Map<string, InsightChartPoint>()
  for (const row of rows) {
    const series = keys.includes(row.series) ? row.series : 'Other'
    if (!keys.includes(series) && series === 'Other' && !keys.includes('Other')) {
      keys.push('Other')
    }
    let point = byBucket.get(row.bucket)
    if (!point) {
      point = { label: row.bucket }
      for (const k of keys) point[k] = 0
      byBucket.set(row.bucket, point)
    }
    point[series] = (Number(point[series]) || 0) + row.value
  }
  const points = [...byBucket.values()].sort((a, b) =>
    String(a.label).localeCompare(String(b.label)),
  )
  return { points, seriesKeys: keys.includes('Other') ? keys : keys }
}

async function queryJson<T>(
  query: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const ch = getClickHouseClient()
  const res = await ch.query({ format: 'JSON', query_params: params, query })
  return ((await res.json()) as CHJson<T>).data ?? []
}

type Ctx = {
  where: string
  p: Record<string, unknown>
  window: ReturnType<typeof resolveAnalyticsWindow>
}

async function volumeInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const [kpiRows, dailySimple, bounceRows, bounceTotal] = await Promise.all([
    queryJson<{
      visitors: string
      sessions: string
      page_views: string
      zip_started: string
      zip_submitted: string
      leads: string
      tf_leads: string
    }>(
      `
      SELECT
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        countIf(event_name = 'page_view') AS page_views,
        uniqExactIf(session_id, event_name = 'zip_start') AS zip_started,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zip_submitted,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        countIf(${LEAD_EVENT} AND ${TF_EXPR}) AS tf_leads
      FROM events_raw
      WHERE ${ctx.where}
      `,
      ctx.p,
    ),
    queryJson<{
      day: string
      visitors: string
      sessions: string
      zip_started: string
      zip_submitted: string
      leads: string
      page_views: string
      form_starts: string
      tf: string
      lead_count: string
    }>(
      `
      SELECT
        ${dayKey} AS day,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, event_name = 'zip_start') AS zip_started,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zip_submitted,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        countIf(event_name = 'page_view') AS page_views,
        uniqExactIf(session_id, event_name = 'form_start') AS form_starts,
        countIf(${LEAD_EVENT} AND ${TF_EXPR}) AS tf,
        countIf(${LEAD_EVENT}) AS lead_count
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; bounced: string; sessions: string }>(
      `
      SELECT
        day,
        countIf(cnt = 1) AS bounced,
        count() AS sessions
      FROM (
        SELECT session_id, ${dayKey} AS day, count() AS cnt
        FROM events_raw
        WHERE ${ctx.where}
        GROUP BY session_id, day
      )
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ bounced: string; sessions: string }>(
      `
      SELECT
        countIf(cnt = 1) AS bounced,
        count() AS sessions
      FROM (
        SELECT session_id, count() AS cnt
        FROM events_raw
        WHERE ${ctx.where}
        GROUP BY session_id
      )
      `,
      ctx.p,
    ),
  ])

  const k = kpiRows[0]
  const visitors = n(k?.visitors)
  const sessions = n(k?.sessions)
  const zipStarted = n(k?.zip_started)
  const zipSubmitted = n(k?.zip_submitted)
  const leads = n(k?.leads)
  const bounced = n(bounceTotal[0]?.bounced)

  const bounceByDay = new Map(
    bounceRows.map((r) => [r.day, pct(n(r.bounced), n(r.sessions))]),
  )

  const funnelPoints = dailySimple.map((r) => ({
    label: r.day,
    Visitors: n(r.visitors),
    Sessions: n(r.sessions),
    'Zip Started': n(r.zip_started),
    'Zip Submitted': n(r.zip_submitted),
    'Lead Completed': n(r.leads),
  }))

  const completionPoints = dailySimple.map((r) => ({
    label: r.day,
    value: pct(n(r.leads), n(r.zip_submitted)),
  }))

  const trueLeadPoints = dailySimple.map((r) => ({
    label: r.day,
    value: pct(n(r.leads), n(r.visitors)),
  }))

  const bouncePoints = dailySimple.map((r) => ({
    label: r.day,
    value: bounceByDay.get(r.day) ?? 0,
  }))

  const pvPoints = dailySimple.map((r) => ({
    label: r.day,
    value: n(r.sessions) > 0 ? round2(n(r.page_views) / n(r.sessions)) : 0,
  }))

  const partialPoints = dailySimple.map((r) => ({
    label: r.day,
    Partial: Math.max(0, n(r.form_starts) - n(r.leads)),
    Complete: n(r.leads),
  }))

  const tfPoints = dailySimple.map((r) => ({
    label: r.day,
    value: pct(n(r.tf), n(r.lead_count)),
  }))

  const charts: InsightChart[] = [
    {
      id: 'funnel-daily',
      title: 'Visitors → Lead Completed',
      helper: 'Daily funnel volume',
      type: 'multi-line',
      fullWidth: true,
      seriesKeys: [
        'Visitors',
        'Sessions',
        'Zip Started',
        'Zip Submitted',
        'Lead Completed',
      ],
      points: funnelPoints,
    },
    {
      id: 'lead-completion',
      title: 'Lead completion rate',
      helper: 'Leads ÷ zip submitted',
      type: 'line',
      seriesKeys: ['value'],
      points: completionPoints,
    },
    {
      id: 'true-lead-rate',
      title: 'True lead rate',
      helper: 'Leads ÷ visitors',
      type: 'line',
      seriesKeys: ['value'],
      points: trueLeadPoints,
    },
    {
      id: 'bounce-rate',
      title: 'Bounce rate',
      type: 'line',
      seriesKeys: ['value'],
      points: bouncePoints,
    },
    {
      id: 'pv-per-session',
      title: 'Page views per session',
      type: 'line',
      seriesKeys: ['value'],
      points: pvPoints,
    },
    {
      id: 'partial-vs-complete',
      title: 'Partial vs complete leads',
      type: 'stacked-bar',
      seriesKeys: ['Partial', 'Complete'],
      points: partialPoints,
    },
    {
      id: 'trustedform-rate',
      title: 'TrustedForm capture rate',
      type: 'line',
      seriesKeys: ['value'],
      points: tfPoints,
    },
  ]

  return {
    section: 'volume',
    kpis: [
      kpi('visitors', 'Visitors', visitors),
      kpi('sessions', 'Sessions', sessions),
      kpi('zip_start', 'Zip started', zipStarted),
      kpi('zip_submit', 'Zip submitted', zipSubmitted),
      kpi('leads', 'Leads', leads),
      kpi('true_lead', 'True lead %', pct(leads, visitors), 'percent'),
      kpi('bounce', 'Bounce %', pct(bounced, sessions), 'percent'),
    ],
    charts,
  }
}

async function sourceInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const weekKey = chWeekBucketKey('created_at')

  const [bySourceDay, byIdDay, weeklyMix, topSources] = await Promise.all([
    queryJson<{ day: string; source: string; visitors: string; sessions: string; leads: string; zips: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(utm_source = '', '(direct)', utm_source) AS source,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, source
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; utm_id: string; sessions: string; leads: string }>(
      `
      SELECT
        ${dayKey} AS day,
        if(utm_id = '', '(none)', utm_id) AS utm_id,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day, utm_id
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ week: string; source: string; visitors: string }>(
      `
      SELECT
        ${weekKey} AS week,
        if(utm_source = '', '(direct)', utm_source) AS source,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY week, source
      ORDER BY week ASC
      `,
      ctx.p,
    ),
    queryJson<{ source: string; visitors: string; sessions: string; leads: string; zips: string }>(
      `
      SELECT
        if(utm_source = '', '(direct)', utm_source) AS source,
        uniqExactIf(user_id, event_name = 'page_view') AS visitors,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY source
      ORDER BY visitors DESC
      LIMIT 20
      `,
      ctx.p,
    ),
  ])

  const top = topSources.slice(0, TOP_N).map((r) => r.source)
  const visitorPivot = pivotSeries(
    bySourceDay.map((r) => ({
      bucket: r.day,
      series: top.includes(r.source) ? r.source : 'Other',
      value: n(r.visitors),
    })),
    [...top, 'Other'],
  )

  const zsrPivot = pivotSeries(
    bySourceDay
      .filter((r) => top.includes(r.source))
      .map((r) => ({
        bucket: r.day,
        series: r.source,
        value: pct(n(r.zips), n(r.sessions)),
      })),
    top,
  )

  const leadPivot = pivotSeries(
    bySourceDay
      .filter((r) => top.includes(r.source))
      .map((r) => ({
        bucket: r.day,
        series: r.source,
        value: pct(n(r.leads), n(r.sessions)),
      })),
    top,
  )

  const topIds = [
    ...new Set(
      byIdDay
        .map((r) => ({ id: r.utm_id, leads: n(r.leads) }))
        .sort((a, b) => b.leads - a.leads)
        .map((r) => r.id),
    ),
  ].slice(0, TOP_N)

  const idPivot = pivotSeries(
    byIdDay
      .filter((r) => topIds.includes(r.utm_id))
      .map((r) => ({
        bucket: r.day,
        series: r.utm_id,
        value: pct(n(r.leads), n(r.sessions)),
      })),
    topIds,
  )

  const mixPivot = pivotSeries(
    weeklyMix.map((r) => ({
      bucket: r.week,
      series: top.includes(r.source) ? r.source : 'Other',
      value: n(r.visitors),
    })),
    [...top, 'Other'],
  )

  const best = topSources[0]

  return {
    section: 'source',
    kpis: [
      kpi('top_source', 'Top source visitors', n(best?.visitors)),
      kpi('top_zsr', 'Top source ZSR', pct(n(best?.zips), n(best?.sessions)), 'percent'),
      kpi('top_lead', 'Top source lead rate', pct(n(best?.leads), n(best?.sessions)), 'percent'),
      kpi('sources', 'Sources', topSources.length),
    ],
    charts: [
      {
        id: 'visitors-by-source',
        title: 'Visitors by utm_source',
        type: 'stacked-bar',
        fullWidth: true,
        seriesKeys: visitorPivot.seriesKeys,
        points: visitorPivot.points,
      },
      {
        id: 'zsr-by-source',
        title: 'ZSR by utm_source',
        type: 'multi-line',
        seriesKeys: zsrPivot.seriesKeys,
        points: zsrPivot.points,
      },
      {
        id: 'lead-by-source',
        title: 'Lead rate by utm_source',
        type: 'multi-line',
        seriesKeys: leadPivot.seriesKeys,
        points: leadPivot.points,
      },
      {
        id: 'lead-by-utm-id',
        title: 'Lead rate by utm_id',
        type: 'multi-line',
        fullWidth: true,
        seriesKeys: idPivot.seriesKeys,
        points: idPivot.points,
      },
      {
        id: 'source-mix',
        title: 'Source mix shift (weekly)',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: mixPivot.seriesKeys,
        points: mixPivot.points,
      },
    ],
  }
}

async function timeInsights(ctx: Ctx): Promise<AnalyticsInsights> {
  const dayKey = chDayBucketKey('created_at')
  const hourExpr = chToHour('created_at')
  const dowExpr = chToDayOfWeek('created_at', 1)

  const [byHour, byDow, overnight, stageHour, profileHour] = await Promise.all([
    queryJson<{ hour: string; leads: string; sessions: string; zips: string }>(
      `
      SELECT
        ${hourExpr} AS hour,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY hour
      ORDER BY hour ASC
      `,
      ctx.p,
    ),
    queryJson<{ dow: string; leads: string; sessions: string; zips: string }>(
      `
      SELECT
        ${dowExpr} AS dow,
        uniqExactIf(session_id, ${LEAD_EVENT}) AS leads,
        uniqExact(session_id) AS sessions,
        uniqExactIf(session_id, ${ZIP_SUBMIT}) AS zips
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY dow
      ORDER BY dow ASC
      `,
      ctx.p,
    ),
    queryJson<{ day: string; overnight: string; daytime: string }>(
      `
      SELECT
        ${dayKey} AS day,
        uniqExactIf(session_id, ${LEAD_EVENT} AND (${hourExpr} >= 22 OR ${hourExpr} < 6)) AS overnight,
        uniqExactIf(session_id, ${LEAD_EVENT} AND ${hourExpr} >= 6 AND ${hourExpr} < 22) AS daytime
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY day
      ORDER BY day ASC
      `,
      ctx.p,
    ),
    queryJson<{ hour: string; stage: string; sessions: string }>(
      `
      SELECT
        ${hourExpr} AS hour,
        if(nullIf(JSONExtractString(properties, 'stepName'), '') = '', concat('Step ', toString(JSONExtractUInt(properties, 'stepIndex'))), JSONExtractString(properties, 'stepName')) AS stage,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${ctx.where}
        AND event_name = 'form_step_view'
      GROUP BY hour, stage
      ORDER BY hour ASC
      LIMIT 500
      `,
      ctx.p,
    ),
    queryJson<{
      hour: string
      insured: string
      dui: string
      homeowner: string
      leads: string
    }>(
      `
      SELECT
        ${hourExpr} AS hour,
        countIf(${LEAD_EVENT} AND lower(${FIELD('currently_insured')}) IN ('yes', 'true', 'y')) AS insured,
        countIf(${LEAD_EVENT} AND lower(${FIELD('driver_0_dui')}) IN ('yes', 'true', 'y')) AS dui,
        countIf(${LEAD_EVENT} AND (
          lower(${FIELD('homeowner')}) IN ('yes', 'true', 'y', 'own')
          OR lower(${FIELD('driver_0_homeowner')}) IN ('yes', 'true', 'y', 'own')
        )) AS homeowner,
        countIf(${LEAD_EVENT}) AS leads
      FROM events_raw
      WHERE ${ctx.where}
      GROUP BY hour
      ORDER BY hour ASC
      `,
      ctx.p,
    ),
  ])

  const ageHour = await queryJson<{ hour: string; band: string; leads: string }>(
    `
    SELECT
      ${hourExpr} AS hour,
      ${AGE_BAND_EXPR} AS band,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where}
      AND ${LEAD_EVENT}
    GROUP BY hour, band
    `,
    ctx.p,
  )

  const ageDow = await queryJson<{ dow: string; band: string; leads: string }>(
    `
    SELECT
      ${dowExpr} AS dow,
      ${AGE_BAND_EXPR} AS band,
      count() AS leads
    FROM events_raw
    WHERE ${ctx.where}
      AND ${LEAD_EVENT}
    GROUP BY dow, band
    `,
    ctx.p,
  )

  const hourLabels = Array.from({ length: 24 }, (_, i) => String(i))
  const hourMap = new Map(byHour.map((r) => [String(n(r.hour)), r]))
  const leadsByHour = hourLabels.map((h) => ({
    label: h,
    value: n(hourMap.get(h)?.leads),
  }))
  const zsrByHour = hourLabels.map((h) => ({
    label: h,
    value: pct(n(hourMap.get(h)?.zips), n(hourMap.get(h)?.sessions)),
  }))

  const dowMap = new Map(byDow.map((r) => [formatDayOfWeek(r.dow), r]))
  const leadsByDow = DAY_ORDER.map((d) => ({
    label: d.slice(0, 3),
    value: n(dowMap.get(d)?.leads),
  }))
  const zsrByDow = DAY_ORDER.map((d) => ({
    label: d.slice(0, 3),
    value: pct(n(dowMap.get(d)?.zips), n(dowMap.get(d)?.sessions)),
  }))

  const peakHour = [...leadsByHour].sort((a, b) => Number(b.value) - Number(a.value))[0]
  const bestDay = [...leadsByDow].sort((a, b) => Number(b.value) - Number(a.value))[0]
  const peakZsr = [...zsrByHour].sort((a, b) => Number(b.value) - Number(a.value))[0]

  const overnightShare =
    overnight.length === 0
      ? 0
      : pct(
          overnight.reduce((s, r) => s + n(r.overnight), 0),
          overnight.reduce((s, r) => s + n(r.overnight) + n(r.daytime), 0),
        )

  const topStages = [
    ...new Set(
      stageHour
        .map((r) => ({ stage: r.stage, v: n(r.sessions) }))
        .sort((a, b) => b.v - a.v)
        .map((r) => r.stage),
    ),
  ].slice(0, 5)

  const stagePivot = pivotSeries(
    stageHour
      .filter((r) => topStages.includes(r.stage))
      .map((r) => ({
        bucket: String(n(r.hour)),
        series: r.stage,
        value: n(r.sessions),
      })),
    topStages,
  )

  const profilePoints = hourLabels.map((h) => {
    const row = profileHour.find((r) => String(n(r.hour)) === h)
    const leads = n(row?.leads)
    return {
      label: h,
      Insured: pct(n(row?.insured), leads),
      DUI: pct(n(row?.dui), leads),
      Homeowner: pct(n(row?.homeowner), leads),
    }
  })

  const ageHourPoints = ageHour.map((r) => ({
    row: r.band,
    col: String(n(r.hour)),
    value: n(r.leads),
  }))

  const ageDowPoints = ageDow.map((r) => ({
    row: r.band,
    col: formatDayOfWeek(r.dow).slice(0, 3),
    value: n(r.leads),
  }))

  return {
    section: 'time',
    kpis: [
      kpi('peak_hour', 'Peak hour', n(peakHour?.label)),
      kpi('best_day_leads', 'Best day leads', n(bestDay?.value)),
      kpi('overnight', 'Overnight lead %', overnightShare, 'percent'),
      kpi('peak_zsr_hour', 'Peak ZSR hour', n(peakZsr?.label)),
    ],
    charts: [
      {
        id: 'leads-by-hour',
        title: 'Leads by hour of day',
        type: 'bar',
        seriesKeys: ['value'],
        points: leadsByHour,
      },
      {
        id: 'leads-by-dow',
        title: 'Leads by day of week',
        type: 'bar',
        seriesKeys: ['value'],
        points: leadsByDow,
      },
      {
        id: 'zsr-by-hour',
        title: 'ZSR by hour',
        type: 'bar',
        seriesKeys: ['value'],
        points: zsrByHour,
      },
      {
        id: 'zsr-by-dow',
        title: 'ZSR by day of week',
        type: 'bar',
        seriesKeys: ['value'],
        points: zsrByDow,
      },
      {
        id: 'age-by-hour',
        title: 'Age band by hour',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: [...AGE_BANDS],
        colKeys: hourLabels,
        points: ageHourPoints,
      },
      {
        id: 'age-by-dow',
        title: 'Age band by day of week',
        type: 'heatmap',
        fullWidth: true,
        rowKeys: [...AGE_BANDS],
        colKeys: DAY_ORDER.map((d) => d.slice(0, 3)),
        points: ageDowPoints,
      },
      {
        id: 'dropoff-stage-hour',
        title: 'Drop-off stage by hour',
        type: 'stacked-bar',
        seriesKeys: stagePivot.seriesKeys,
        points: stagePivot.points,
      },
      {
        id: 'profile-by-hour',
        title: 'Insured / DUI / homeowner by hour',
        type: 'multi-line',
        seriesKeys: ['Insured', 'DUI', 'Homeowner'],
        points: profilePoints,
      },
      {
        id: 'overnight-share',
        title: 'Overnight vs daytime lead share',
        type: 'stacked-area',
        fullWidth: true,
        seriesKeys: ['Overnight', 'Daytime'],
        points: overnight.map((r) => ({
          label: r.day,
          Overnight: n(r.overnight),
          Daytime: n(r.daytime),
        })),
      },
    ],
  }
}

export async function getAnalyticsInsights({
  workspaceId,
  section,
  rangeId,
  utmFilter,
  custom,
}: {
  workspaceId: string
  section: InsightSectionId
  rangeId: AnalyticsRangeId
  utmFilter?: AnalyticsUtmFilter
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsInsights> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const utmKey = utmFilterCacheKey(utmFilter)
  const cacheKey = `analytics:insights:v1:${section}:${workspaceId}:${rangeCacheKey(window, utmKey)}`
  const cached = await readAnalyticsCache<AnalyticsInsights>(cacheKey)
  if (cached) return cached

  const where = rangeFilter(utmFilter)
  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
    ...utmFilterParams(utmFilter),
  }
  const ctx: Ctx = { where, p, window }

  let result: AnalyticsInsights
  try {
    switch (section) {
      case 'volume':
        result = await volumeInsights(ctx)
        break
      case 'source':
        result = await sourceInsights(ctx)
        break
      case 'time':
        result = await timeInsights(ctx)
        break
      default:
        result = await loadExtendedInsights(section, ctx)
        break
    }
  } catch (err) {
    console.error(`[analytics-insights] ${section} failed`, err)
    result = emptyAnalyticsInsights(section)
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

async function loadExtendedInsights(
  section: InsightSectionId,
  ctx: Ctx,
): Promise<AnalyticsInsights> {
  const { getExtendedInsights } = await import(
    './analytics-insights-extended.service.js'
  )
  return getExtendedInsights(section, ctx)
}

export type InsightsQueryCtx = Ctx
export {
  n,
  pct,
  round1,
  round2,
  kpi,
  pivotSeries,
  queryJson,
  TOP_N,
  FIELD,
  LEAD_EVENT,
  ZIP_SUBMIT,
  AGE_EXPR,
  AGE_BAND_EXPR,
  AGE_BANDS,
  TF_EXPR,
}
