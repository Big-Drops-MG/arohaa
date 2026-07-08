import { getClickHouseClient } from './clickhouse.service.js'
import { db, experiments, landingPages, eq } from '@workspace/database'
import type {
  AnalyticsExperiments,
  AnalyticsLocationPerformanceRow,
  AnalyticsStatePerformanceRow,
  AnalyticsZipcodePerformanceRow,
  RangeId,
} from '../types/analytics-experiments.js'
import { readAnalyticsCache, writeAnalyticsCache } from '../lib/analytics-cache.js'
import {
  utmFilterParams,
  utmFilterSql,
  type AnalyticsUtmFilter,
} from '../lib/analytics-utm-filter.js'

type CHJson<T> = { data: T[] }

const n = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0) || 0

const round1 = (v: number) => Math.round(v * 10) / 10

function fsrPct(formSuccessSessions: number, sessions: number): number {
  return sessions > 0 ? round1((formSuccessSessions / sessions) * 100) : 0
}

function getInterval(rangeId: RangeId): string {
  if (rangeId === '24h') return '24 HOUR'
  if (rangeId === '7d') return '7 DAY'
  if (rangeId === '30d') return '30 DAY'
  if (rangeId === '3m') return '3 MONTH'
  if (rangeId === '12m') return '12 MONTH'
  return '24 MONTH'
}

type LocationDimension = 'city' | 'state' | 'zipcode'

type LocationRow = {
  location_label: string
  variant_label: string
  form_submitted: string
  sessions: string
}

function zipcodeBreakdownQuery(interval: string, utmSql: string): string {
  return `
    SELECT
      if(session_zip = '', 'Unknown', session_zip) AS location_label,
      if(variant_label = '', 'Unknown', variant_label) AS variant_label,
      countIf(has_form_success = 1) AS form_submitted,
      count() AS sessions
    FROM (
      SELECT
        session_id,
        anyIf(variant, variant != '') AS variant_label,
        max(event_name = 'form_success') AS has_form_success,
        anyIf(
          if(zipcode != '', zipcode, nullIf(JSONExtractString(properties, 'zip'), '')),
          zipcode != '' OR JSONExtractString(properties, 'zip') != ''
        ) AS session_zip
      FROM events_raw
      WHERE workspace_id = {wid:UUID}
        AND lp_public_id = {lp:String}
        AND created_at >= now() - INTERVAL ${interval}${utmSql}
      GROUP BY session_id
    )
    GROUP BY location_label, variant_label
    ORDER BY sessions DESC
  `
}

function locationBreakdownQuery(
  dimension: LocationDimension,
  interval: string,
  utmSql: string,
): string {
  const labelExpr =
    dimension === 'state'
      ? `if(state != '', state, if(utm_term != '', utm_term, 'Unknown'))`
      : `if(${dimension} = '', 'Unknown', ${dimension})`

  return `
    SELECT
      ${labelExpr} AS location_label,
      if(variant = '', 'Unknown', variant) AS variant_label,
      uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
      uniqExact(session_id) AS sessions
    FROM events_raw
    WHERE workspace_id = {wid:UUID} 
      AND lp_public_id = {lp:String}
      AND created_at >= now() - INTERVAL ${interval}${utmSql}
    GROUP BY location_label, variant_label
    ORDER BY sessions DESC
  `
}

function aggregatePerformanceByDimension<T extends Record<string, string | number>>(
  rows: LocationRow[],
  outputKey: keyof T & string,
): T[] {
  type Accumulator = {
    row: Record<string, string | number>
    conversions: number
    sessions: number
  }

  const map = new Map<string, Accumulator>()
  for (const row of rows) {
    const label = row.location_label
    if (!map.has(label)) {
      map.set(label, {
        row: { [outputKey]: label },
        conversions: 0,
        sessions: 0,
      })
    }
    const entry = map.get(label)!
    const fs = n(row.form_submitted)
    const ses = n(row.sessions)
    entry.row[`variant${row.variant_label}`] = `${fsrPct(fs, ses)}%`
    entry.conversions += fs
    entry.sessions += ses
  }

  return Array.from(map.values())
    .sort((a, b) => b.conversions - a.conversions || b.sessions - a.sessions)
    .map((entry) => entry.row as T)
}

export async function getAnalyticsExperiments({
  workspaceId,
  lpPublicId,
  rangeId,
  utmFilter,
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
  utmFilter?: AnalyticsUtmFilter
}): Promise<AnalyticsExperiments> {
  const cacheKey = `analytics:experiments:${workspaceId}:${lpPublicId}:${rangeId}:${utmFilter ? `${utmFilter.dimension}:${utmFilter.value}` : 'all'}`
  const cached = await readAnalyticsCache<AnalyticsExperiments>(cacheKey)
  if (cached) return cached

  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  let activeExperiments: typeof experiments.$inferSelect[] = []
  if (lp) {
    activeExperiments = await db.query.experiments.findMany({
      where: eq(experiments.landingPageId, lp.id),
      orderBy: (exp, { desc }) => [desc(exp.createdAt)],
    })
  }

  const formattedExperiments = activeExperiments.map(exp => ({
    id: exp.id,
    name: exp.name,
    status: exp.status,
    variants: (exp.variants as string[]).join(' / '),
    startDate: exp.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    highlighted: exp.highlighted === 'true'
  }))

  const ch = getClickHouseClient()
  const interval = getInterval(rangeId)
  const utmSql = utmFilterSql(utmFilter)
  const p = { wid: workspaceId, lp: lpPublicId, ...utmFilterParams(utmFilter) }

  const [variantRes, cityRes, stateRes, zipcodeRes] = await Promise.all([
    ch.query({
      format: 'JSON',
      query_params: p,
      query: `
        SELECT
          if(variant = '', 'Unknown', variant) AS variant_label,
          uniqExactIf(user_id, event_name = 'page_view') AS visitors,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events_raw
        WHERE workspace_id = {wid:UUID} 
          AND lp_public_id = {lp:String}
          AND created_at >= now() - INTERVAL ${interval}${utmSql}
        GROUP BY variant_label
        ORDER BY visitors DESC
      `,
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: locationBreakdownQuery('city', interval, utmSql),
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: locationBreakdownQuery('state', interval, utmSql),
    }),
    ch.query({
      format: 'JSON',
      query_params: p,
      query: zipcodeBreakdownQuery(interval, utmSql),
    }),
  ])

  type VariantRow = {
    variant_label: string
    visitors: string
    form_submitted: string
    sessions: string
  }

  const variantRows = ((await variantRes.json()) as CHJson<VariantRow>).data ?? []
  const cityRows = ((await cityRes.json()) as CHJson<LocationRow>).data ?? []
  const stateRows = ((await stateRes.json()) as CHJson<LocationRow>).data ?? []
  const zipcodeRows = ((await zipcodeRes.json()) as CHJson<LocationRow>).data ?? []

  const variantPerformance = variantRows.map(row => {
    const visitors = n(row.visitors)
    const fs = n(row.form_submitted)
    const ses = n(row.sessions)
    return {
      variant: row.variant_label,
      visitors,
      formSubmitted: fs,
      fsr: fsrPct(fs, ses)
    }
  })

  const result = {
    experiments: formattedExperiments,
    variantPerformance,
    performanceByLocation: aggregatePerformanceByDimension<AnalyticsLocationPerformanceRow>(cityRows, 'city'),
    performanceByState: aggregatePerformanceByDimension<AnalyticsStatePerformanceRow>(stateRows, 'state'),
    performanceByZipcode: aggregatePerformanceByDimension<AnalyticsZipcodePerformanceRow>(zipcodeRows, 'zipcode'),
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

export function emptyAnalyticsExperiments(): AnalyticsExperiments {
  return {
    experiments: [],
    variantPerformance: [],
    performanceByLocation: [],
    performanceByState: [],
    performanceByZipcode: [],
  }
}
