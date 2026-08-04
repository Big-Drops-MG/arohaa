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
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
import {
  compositeLighthouseScore,
  rateWebVital,
  scoreWebVital,
  webVitalUnit,
} from '../lib/web-vitals-score.js'
import type {
  AnalyticsWebVitals,
  WebVitalDeviceBreakdown,
  WebVitalMetricSummary,
  WebVitalName,
  WebVitalStateMetric,
} from '../types/analytics-web-vitals.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const VITAL_NAMES: readonly WebVitalName[] = ['LCP', 'CLS', 'INP']

const RESOLVED_DEVICE_SQL = `
  multiIf(
    device IN ('mobile', 'tablet', 'desktop'), device,
    viewport_width > 0 AND viewport_width < 768, 'mobile',
    viewport_width >= 768 AND viewport_width < 1024, 'tablet',
    'desktop'
  )
`

export function emptyAnalyticsWebVitals(
  rangeId: AnalyticsRangeId,
): AnalyticsWebVitals {
  return {
    rangeId,
    lighthouseScore: null,
    metrics: VITAL_NAMES.map((name) => ({
      name,
      p75: 0,
      avg: 0,
      samples: 0,
      rating: 'none',
      score: 0,
      unit: webVitalUnit(name),
    })),
    devices: [],
    states: [],
    totalSamples: 0,
  }
}

function buildMetricSummaries(
  rows: Array<{
    metric_name: string
    p75: string | number
    avg: string | number
    samples: string | number
  }>,
): WebVitalMetricSummary[] {
  const byName = new Map(
    rows.map((row) => [row.metric_name.toUpperCase(), row] as const),
  )

  return VITAL_NAMES.map((name) => {
    const row = byName.get(name)
    const samples = row ? n(row.samples) : 0
    const p75 = row && samples > 0 ? n(row.p75) : 0
    const avg = row && samples > 0 ? n(row.avg) : 0
    return {
      name,
      p75,
      avg,
      samples,
      rating: samples > 0 ? rateWebVital(name, p75) : 'none',
      score: samples > 0 ? scoreWebVital(name, p75) : 0,
      unit: webVitalUnit(name),
    }
  })
}

export async function getAnalyticsWebVitals({
  workspaceId,
  rangeId,
  custom,
}: {
  workspaceId: string
  rangeId: AnalyticsRangeId
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsWebVitals> {
  const now = new Date()
  const window = resolveAnalyticsWindow(rangeId, now, custom)
  const cacheKey = `analytics:web-vitals:v1:${workspaceId}:${rangeCacheKey(window)}`
  const cached = await readAnalyticsCache<AnalyticsWebVitals>(cacheKey)
  if (cached) return cached

  const where = `${rangeFilter()}
    AND event_name = 'web_vitals'
    AND metric_name IN ('LCP', 'CLS', 'INP')
    AND metric_value >= 0
    AND metric_value = metric_value`

  const p = {
    wid: workspaceId,
    ...rangeQueryParams(window),
  }

  const ch = getClickHouseClient()

  const [summaryRes, deviceRes, stateRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          metric_name,
          quantileExact(0.75)(metric_value) AS p75,
          avg(metric_value) AS avg,
          count() AS samples
        FROM events_raw
        WHERE ${where}
        GROUP BY metric_name
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          ${RESOLVED_DEVICE_SQL} AS device,
          quantileExactIf(0.75)(metric_value, metric_name = 'LCP') AS lcp_p75,
          quantileExactIf(0.75)(metric_value, metric_name = 'CLS') AS cls_p75,
          quantileExactIf(0.75)(metric_value, metric_name = 'INP') AS inp_p75,
          countIf(metric_name = 'LCP') AS lcp_samples,
          countIf(metric_name = 'CLS') AS cls_samples,
          countIf(metric_name = 'INP') AS inp_samples,
          count() AS samples
        FROM events_raw
        WHERE ${where}
        GROUP BY device
        ORDER BY samples DESC
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          state AS state,
          quantileExactIf(0.75)(metric_value, metric_name = 'LCP') AS lcp_p75,
          quantileExactIf(0.75)(metric_value, metric_name = 'CLS') AS cls_p75,
          quantileExactIf(0.75)(metric_value, metric_name = 'INP') AS inp_p75,
          countIf(metric_name = 'LCP') AS lcp_samples,
          countIf(metric_name = 'CLS') AS cls_samples,
          countIf(metric_name = 'INP') AS inp_samples,
          count() AS samples
        FROM events_raw
        WHERE ${where}
          AND state != ''
          AND country IN ('United States', 'USA', 'US')
        GROUP BY state
        ORDER BY samples DESC
        LIMIT 60
      `,
    }),
  ])

  type BreakdownRow = {
    lcp_p75: string | number
    cls_p75: string | number
    inp_p75: string | number
    lcp_samples: string | number
    cls_samples: string | number
    inp_samples: string | number
    samples: string | number
  }

  const summaryRows =
    (
      (await summaryRes.json()) as CHJson<{
        metric_name: string
        p75: string | number
        avg: string | number
        samples: string | number
      }>
    ).data ?? []

  const deviceRows =
    ((await deviceRes.json()) as CHJson<BreakdownRow & { device: string }>)
      .data ?? []

  const stateRows =
    ((await stateRes.json()) as CHJson<BreakdownRow & { state: string }>)
      .data ?? []

  const metrics = buildMetricSummaries(summaryRows)
  const byName = Object.fromEntries(
    metrics.map((m) => [m.name, m.samples > 0 ? m.p75 : null]),
  ) as Record<WebVitalName, number | null>

  const lighthouseScore = compositeLighthouseScore(byName)

  function mapBreakdown(row: BreakdownRow): {
    lcpP75: number | null
    clsP75: number | null
    inpP75: number | null
    samples: number
    performanceScore: number | null
  } {
    const lcpP75 = n(row.lcp_samples) > 0 ? n(row.lcp_p75) : null
    const clsP75 = n(row.cls_samples) > 0 ? n(row.cls_p75) : null
    const inpP75 = n(row.inp_samples) > 0 ? n(row.inp_p75) : null
    return {
      lcpP75,
      clsP75,
      inpP75,
      samples: n(row.samples),
      performanceScore: compositeLighthouseScore({
        LCP: lcpP75,
        CLS: clsP75,
        INP: inpP75,
      }),
    }
  }

  const devices: WebVitalDeviceBreakdown[] = deviceRows.map((row) => ({
    device: row.device || 'unknown',
    ...mapBreakdown(row),
  }))

  const states: WebVitalStateMetric[] = stateRows.map((row) => ({
    state: row.state,
    ...mapBreakdown(row),
  }))

  const totalSamples = metrics.reduce((sum, m) => sum + m.samples, 0)

  const result: AnalyticsWebVitals = {
    rangeId: window.rangeId,
    lighthouseScore,
    metrics,
    devices,
    states,
    totalSamples,
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}
