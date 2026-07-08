import { getClickHouseClient } from './clickhouse.service.js'
import { db, experiments, landingPages, eq, and, sql, sum, inArray } from '@workspace/database'
import type {
  AnalyticsExperiments,
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

  // 1. Fetch active experiments from Postgres
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

  // Map to response format
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

  const [variantRes, locationRes] = await Promise.all([
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
      query: `
        SELECT
          if(city = '', 'Unknown', city) AS city,
          if(variant = '', 'Unknown', variant) AS variant_label,
          uniqExactIf(session_id, event_name = 'form_success') AS form_submitted,
          uniqExact(session_id) AS sessions
        FROM events_raw
        WHERE workspace_id = {wid:UUID} 
          AND lp_public_id = {lp:String}
          AND created_at >= now() - INTERVAL ${interval}${utmSql}
        GROUP BY city, variant_label
        ORDER BY sessions DESC
      `,
    }),
  ])

  type VariantRow = {
    variant_label: string
    visitors: string
    form_submitted: string
    sessions: string
  }

  type LocationRow = {
    city: string
    variant_label: string
    form_submitted: string
    sessions: string
  }

  const variantRows = ((await variantRes.json()) as CHJson<VariantRow>).data ?? []
  const locationRows = ((await locationRes.json()) as CHJson<LocationRow>).data ?? []

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

  // Group location by city, tracking totals so we can rank top-performing
  // locations first instead of listing them alphabetically.
  type CityAccumulator = {
    row: Record<string, string | number>
    conversions: number
    sessions: number
  }
  const cityMap = new Map<string, CityAccumulator>()
  for (const row of locationRows) {
    if (!cityMap.has(row.city)) {
      cityMap.set(row.city, {
        row: { city: row.city },
        conversions: 0,
        sessions: 0,
      })
    }
    const entry = cityMap.get(row.city)!
    const fs = n(row.form_submitted)
    const ses = n(row.sessions)
    entry.row[`variant${row.variant_label}`] = `${fsrPct(fs, ses)}%`
    entry.conversions += fs
    entry.sessions += ses
  }

  const performanceByLocation = Array.from(cityMap.values())
    .sort(
      (a, b) => b.conversions - a.conversions || b.sessions - a.sessions,
    )
    .map((entry) => entry.row) as any[]

  const result = {
    experiments: formattedExperiments,
    variantPerformance,
    performanceByLocation,
  }

  await writeAnalyticsCache(cacheKey, result)
  return result
}

export function emptyAnalyticsExperiments(): AnalyticsExperiments {
  return {
    experiments: [],
    variantPerformance: [],
    performanceByLocation: [],
  }
}
