import { and, desc, eq, gte, sql } from '@workspace/database'
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

function getRangeStart(rangeId: RangeId): Date {
  const now = new Date()
  const start = new Date(now)
  if (rangeId === '24h') start.setHours(start.getHours() - 24)
  else if (rangeId === '7d') start.setDate(start.getDate() - 7)
  else if (rangeId === '30d') start.setDate(start.getDate() - 30)
  else if (rangeId === '3m') start.setMonth(start.getMonth() - 3)
  else if (rangeId === '12m') start.setFullYear(start.getFullYear() - 1)
  else start.setFullYear(start.getFullYear() - 2)
  return start
}

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

export async function getAnalyticsSeo({
  workspaceId,
  lpPublicId,
  rangeId,
  sortBy = 'clicks',
  sortOrder = 'desc',
}: {
  workspaceId: string
  lpPublicId: string
  rangeId: RangeId
  sortBy?: SeoSortField
  sortOrder?: 'asc' | 'desc'
}): Promise<AnalyticsSeo> {
  const cacheKey = `analytics:seo:${workspaceId}:${lpPublicId}:${rangeId}:${sortBy}:${sortOrder}`
  const cached = await readAnalyticsCache<AnalyticsSeo>(cacheKey)
  if (cached) return cached

  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  if (!lp || lp.id !== workspaceId) {
    return emptyAnalyticsSeo(rangeId, sortBy, sortOrder)
  }

  const rangeStart = getRangeStart(rangeId)
  const dbRows = await db
    .select()
    .from(seoResults)
    .where(
      and(
        eq(seoResults.landingPageId, lp.id),
        gte(seoResults.reportDate, rangeStart),
      ),
    )
    .orderBy(desc(seoResults.reportDate))

  const mapped = dbRows.map(toRow)
  const sorted = sortRows(mapped, sortBy, sortOrder)

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

  const result = {
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
