import { and, desc, eq, gte, lt, sql } from '@workspace/database'
import { db, landingPages, seoResults } from '@workspace/database'
import type {
  AnalyticsSeo,
  RangeId,
  SeoResultRow,
  SeoSortField,
  SeoSyncRowInput,
} from '../types/analytics-seo.js'
import {
  invalidateAnalyticsCache,
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
import {
  rangeCacheKey,
  rangeFilter,
  rangeQueryParams,
  resolveAnalyticsWindowForLanding,
  type AnalyticsCustomRange,
  type AnalyticsWindow,
} from '../lib/analytics-range.js'
import { getClickHouseClient } from './clickhouse.service.js'

type CHJson<T> = { data: T[] }

function sortRows(
  rows: SeoResultRow[],
  sortBy: SeoSortField,
  sortOrder: 'asc' | 'desc',
): SeoResultRow[] {
  const dir = sortOrder === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sortBy === 'query') {
      return a.query.localeCompare(b.query) * dir
    }
    const av = a[sortBy]
    const bv = b[sortBy]
    if (av === bv) return 0
    return av > bv ? dir : -dir
  })
}

function toRow(row: typeof seoResults.$inferSelect): SeoResultRow {
  return {
    id: row.id,
    query: row.query,
    pageUrl: row.pageUrl,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    reportDate: row.reportDate.toISOString(),
  }
}

function pathQueryFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch {
    return url.slice(0, 512) || '/'
  }
}

async function seoRowsFromPageViews({
  workspaceId,
  window,
}: {
  workspaceId: string
  window: AnalyticsWindow
}): Promise<SeoResultRow[]> {
  const ch = getClickHouseClient()
  const result = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      ...rangeQueryParams(window),
    },
    query: `
      SELECT
        url AS page_url,
        uniqExact(session_id) AS clicks,
        count() AS impressions
      FROM events_raw
      WHERE ${rangeFilter()}
        AND event_name = 'page_view'
        AND url != ''
      GROUP BY url
      ORDER BY impressions DESC
      LIMIT 200
    `,
  })

  const rows =
    (
      (await result.json()) as CHJson<{
        page_url: string
        clicks: string | number
        impressions: string | number
      }>
    ).data ?? []

  const reportDate = window.end.toISOString()
  return rows.map((row, index) => {
    const impressions = Math.max(0, Number(row.impressions) || 0)
    const clicks = Math.max(0, Number(row.clicks) || 0)
    const pageUrl = String(row.page_url ?? '').slice(0, 2048)
    const ctr =
      impressions > 0
        ? Math.round((clicks / impressions) * 1000) / 10
        : 0
    return {
      id: `derived:${index}:${pageUrl.slice(0, 64)}`,
      query: pathQueryFromUrl(pageUrl),
      pageUrl,
      clicks,
      impressions,
      ctr,
      position: index + 1,
      reportDate,
    }
  })
}

function summarizeSeoRows(
  sorted: SeoResultRow[],
  rangeId: RangeId,
  sortBy: SeoSortField,
  sortOrder: 'asc' | 'desc',
): AnalyticsSeo {
  const totalClicks = sorted.reduce((sum, row) => sum + row.clicks, 0)
  const totalImpressions = sorted.reduce((sum, row) => sum + row.impressions, 0)
  const avgCtr =
    sorted.length > 0
      ? sorted.reduce((sum, row) => sum + row.ctr, 0) / sorted.length
      : 0
  const avgPosition =
    sorted.length > 0
      ? sorted.reduce((sum, row) => sum + row.position, 0) / sorted.length
      : 0

  return {
    rangeId,
    sortBy,
    sortOrder,
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr: Math.round(avgCtr * 10) / 10,
      avgPosition: Math.round(avgPosition * 10) / 10,
      rowCount: sorted.length,
    },
    rows: sorted,
  }
}

export async function getAnalyticsSeo({
  workspaceId,
  lpPublicId,
  rangeId,
  sortBy = 'clicks',
  sortOrder = 'desc',
  custom,
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
  sortBy?: SeoSortField
  sortOrder?: 'asc' | 'desc'
  custom?: AnalyticsCustomRange
}): Promise<AnalyticsSeo> {
  const now = new Date()
  const window = await resolveAnalyticsWindowForLanding(
    rangeId,
    workspaceId,
    now,
    custom,
  )
  const cacheKey = `analytics:seo:v3-derived:${workspaceId}:${lpPublicId}:${rangeCacheKey(window)}:${sortBy}:${sortOrder}`
  const cached = await readAnalyticsCache<AnalyticsSeo>(cacheKey)
  if (cached) return cached

  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  if (!lp || lp.id !== workspaceId) {
    return emptyAnalyticsSeo(window.rangeId, sortBy, sortOrder)
  }

  const dbRows = await db
    .select()
    .from(seoResults)
    .where(
      and(
        eq(seoResults.landingPageId, lp.id),
        gte(seoResults.reportDate, window.start),
        lt(seoResults.reportDate, window.end),
      ),
    )
    .orderBy(desc(seoResults.reportDate))

  let mapped = dbRows.map(toRow)
  if (mapped.length === 0) {
    try {
      mapped = await seoRowsFromPageViews({ workspaceId, window })
    } catch {
      mapped = []
    }
  }

  const sorted = sortRows(mapped, sortBy, sortOrder)
  const result = summarizeSeoRows(sorted, window.rangeId, sortBy, sortOrder)

  await writeAnalyticsCache(cacheKey, result)
  return result
}

export async function syncSeoResults({
  workspaceId,
  lpPublicId,
  rows,
}: {
  workspaceId: string
  lpPublicId: string
  rows: SeoSyncRowInput[]
}): Promise<{ inserted: number }> {
  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  if (!lp || lp.id !== workspaceId) {
    throw new Error('Landing page not found for workspace')
  }

  if (rows.length === 0) return { inserted: 0 }

  const values = rows.map((row) => ({
    landingPageId: lp.id,
    query: row.query.trim(),
    pageUrl: row.pageUrl.trim(),
    clicks: Math.max(0, Math.floor(row.clicks)),
    impressions: Math.max(0, Math.floor(row.impressions)),
    ctr: Math.max(0, row.ctr),
    position: Math.max(0, row.position),
    reportDate: new Date(row.reportDate),
  }))

  await db
    .insert(seoResults)
    .values(values)
    .onConflictDoUpdate({
      target: [
        seoResults.landingPageId,
        seoResults.query,
        seoResults.pageUrl,
        seoResults.reportDate,
      ],
      set: {
        clicks: sql`excluded.clicks`,
        impressions: sql`excluded.impressions`,
        ctr: sql`excluded.ctr`,
        position: sql`excluded.position`,
      },
    })

  await invalidateAnalyticsCache(`analytics:seo:${workspaceId}:${lpPublicId}:`)

  return { inserted: values.length }
}

export function emptyAnalyticsSeo(
  rangeId: RangeId = '7d',
  sortBy: SeoSortField = 'clicks',
  sortOrder: 'asc' | 'desc' = 'desc',
): AnalyticsSeo {
  return {
    rangeId,
    sortBy,
    sortOrder,
    summary: {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      rowCount: 0,
    },
    rows: [],
  }
}
