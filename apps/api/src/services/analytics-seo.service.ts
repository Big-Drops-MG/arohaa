import { and, desc, eq, gte, isNotNull, lt, ne, sql } from '@workspace/database'
import {
  db,
  decryptVapidPrivateKey,
  fetchGscSearchAnalytics,
  gscPageFilterFromLanding,
  landingPages,
  refreshGscAccessToken,
  seoResults,
  workspaceGscConnections,
} from '@workspace/database'
import type {
  AnalyticsSeo,
  RangeId,
  SeoContentItem,
  SeoResultRow,
  SeoSortField,
  SeoSource,
  SeoSyncRowInput,
} from '../types/analytics-seo.js'
import {
  invalidateAnalyticsCache,
  readAnalyticsCache,
  writeAnalyticsCache,
} from '../lib/analytics-cache.js'
import {
  previousRangeFilter,
  previousRangeQueryParams,
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

function priorWindow(window: AnalyticsWindow): { start: Date; end: Date } {
  const duration = Math.max(0, window.end.getTime() - window.start.getTime())
  return {
    start: new Date(window.start.getTime() - duration),
    end: window.start,
  }
}

function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function buildContentFromRows(
  currentRows: Array<{ pageUrl: string; pageTitle?: string; clicks: number }>,
  previousByUrl: Map<string, number>,
): SeoContentItem[] {
  const byUrl = new Map<
    string,
    { pageUrl: string; pageTitle: string; clicks: number }
  >()
  for (const row of currentRows) {
    const key = row.pageUrl
    const existing = byUrl.get(key)
    const title = (row.pageTitle ?? '').trim()
    if (existing) {
      existing.clicks += row.clicks
      if (!existing.pageTitle && title) existing.pageTitle = title
    } else {
      byUrl.set(key, {
        pageUrl: key,
        pageTitle: title,
        clicks: row.clicks,
      })
    }
  }

  return [...byUrl.values()]
    .map((item) => {
      const previousClicks = previousByUrl.get(item.pageUrl) ?? 0
      return {
        pageUrl: item.pageUrl,
        pageTitle: item.pageTitle || item.pageUrl,
        clicks: item.clicks,
        previousClicks,
        changePct: changePct(item.clicks, previousClicks),
      }
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50)
}

function googleOrganicSqlFilter(): string {
  return `
    (
      referrer_source = 'Google'
      OR lower(utm_source) = 'google'
    )
    AND lower(utm_medium) NOT IN ('cpc', 'ppc', 'paid', 'display', 'paidsocial')
  `
}

async function seoOrganicFromClickHouse({
  workspaceId,
  window,
  brandName,
}: {
  workspaceId: string
  window: AnalyticsWindow
  brandName: string
}): Promise<{ rows: SeoResultRow[]; content: SeoContentItem[] }> {
  const ch = getClickHouseClient()

  const currentResult = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      ...rangeQueryParams(window),
    },
    query: `
      SELECT
        url AS page_url,
        anyHeavy(nullIf(JSONExtractString(properties, 'page_title'), '')) AS page_title,
        uniqExact(session_id) AS sessions,
        count() AS views
      FROM events_raw
      WHERE ${rangeFilter()}
        AND event_name = 'page_view'
        AND url != ''
        AND ${googleOrganicSqlFilter()}
      GROUP BY url
      ORDER BY sessions DESC
      LIMIT 200
    `,
  })

  const priorResult = await ch.query({
    format: 'JSON',
    query_params: {
      wid: workspaceId,
      ...previousRangeQueryParams(window),
    },
    query: `
      SELECT
        url AS page_url,
        uniqExact(session_id) AS sessions
      FROM events_raw
      WHERE ${previousRangeFilter()}
        AND event_name = 'page_view'
        AND url != ''
        AND ${googleOrganicSqlFilter()}
      GROUP BY url
    `,
  })

  const currentRows =
    (
      (await currentResult.json()) as CHJson<{
        page_url: string
        page_title: string
        sessions: string | number
        views: string | number
      }>
    ).data ?? []

  const priorRows =
    (
      (await priorResult.json()) as CHJson<{
        page_url: string
        sessions: string | number
      }>
    ).data ?? []

  const previousByUrl = new Map<string, number>()
  for (const row of priorRows) {
    previousByUrl.set(
      String(row.page_url ?? ''),
      Math.max(0, Number(row.sessions) || 0),
    )
  }

  const reportDate = window.end.toISOString()
  const rows: SeoResultRow[] = currentRows.map((row, index) => {
    const pageUrl = String(row.page_url ?? '').slice(0, 2048)
    const pageTitle =
      String(row.page_title ?? '').trim() || brandName || pageUrl
    const sessions = Math.max(0, Number(row.sessions) || 0)
    const views = Math.max(0, Number(row.views) || 0)
    return {
      id: `organic:${index}:${pageUrl.slice(0, 64)}`,
      query: '',
      pageUrl,
      pageTitle,
      clicks: sessions,
      impressions: views,
      ctr: 0,
      position: 0,
      reportDate,
    }
  })

  const content = buildContentFromRows(
    rows.map((r) => ({
      pageUrl: r.pageUrl,
      pageTitle: r.pageTitle,
      clicks: r.clicks,
    })),
    previousByUrl,
  )

  return { rows, content }
}

function summarizeSeoRows(
  sorted: SeoResultRow[],
  rangeId: RangeId,
  sortBy: SeoSortField,
  sortOrder: 'asc' | 'desc',
  source: SeoSource,
  gsc: AnalyticsSeo['gsc'],
  content: SeoContentItem[],
): AnalyticsSeo {
  const totalClicks = sorted.reduce((sum, row) => sum + row.clicks, 0)
  const totalImpressions = sorted.reduce((sum, row) => sum + row.impressions, 0)
  const avgCtr =
    source === 'gsc' && sorted.length > 0
      ? sorted.reduce((sum, row) => sum + row.ctr, 0) / sorted.length
      : 0
  const avgPosition =
    source === 'gsc' && sorted.length > 0
      ? sorted.reduce((sum, row) => sum + row.position, 0) / sorted.length
      : 0

  return {
    rangeId,
    sortBy,
    sortOrder,
    source,
    gsc,
    summary: {
      totalClicks,
      totalImpressions,
      avgCtr: Math.round(avgCtr * 10) / 10,
      avgPosition: Math.round(avgPosition * 10) / 10,
      rowCount: sorted.length,
    },
    content,
    rows: sorted,
  }
}

async function loadGscMeta(lp: typeof landingPages.$inferSelect): Promise<{
  connected: boolean
  accountEmail: string | null
}> {
  const connection = await db.query.workspaceGscConnections.findFirst({
    where: eq(workspaceGscConnections.workspaceId, lp.workspaceId),
    columns: {
      status: true,
      googleAccountEmail: true,
    },
  })
  return {
    connected: Boolean(connection && connection.status === 'active'),
    accountEmail: connection?.googleAccountEmail ?? null,
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
  const cacheKey = `analytics:seo:v4:${workspaceId}:${lpPublicId}:${rangeCacheKey(window)}:${sortBy}:${sortOrder}`
  const cached = await readAnalyticsCache<AnalyticsSeo>(cacheKey)
  if (cached) return cached

  const lp = await db.query.landingPages.findFirst({
    where: eq(landingPages.publicId, lpPublicId),
  })

  if (!lp || lp.id !== workspaceId) {
    return emptyAnalyticsSeo(window.rangeId, sortBy, sortOrder)
  }

  const gscMeta = await loadGscMeta(lp)
  const gscInfo: AnalyticsSeo['gsc'] = {
    connected: gscMeta.connected,
    siteUrl: lp.gscSiteUrl ?? null,
    accountEmail: gscMeta.accountEmail,
    lastSyncedAt: lp.gscLastSyncedAt?.toISOString() ?? null,
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

  const useGsc = Boolean(lp.gscSiteUrl?.trim())

  if (useGsc) {
    const mapped = dbRows.map(toRow)
    const prior = priorWindow(window)
    const priorDbRows = await db
      .select({
        pageUrl: seoResults.pageUrl,
        clicks: seoResults.clicks,
      })
      .from(seoResults)
      .where(
        and(
          eq(seoResults.landingPageId, lp.id),
          gte(seoResults.reportDate, prior.start),
          lt(seoResults.reportDate, prior.end),
        ),
      )
    const previousByUrl = new Map<string, number>()
    for (const row of priorDbRows) {
      previousByUrl.set(
        row.pageUrl,
        (previousByUrl.get(row.pageUrl) ?? 0) + row.clicks,
      )
    }
    const content = buildContentFromRows(
      mapped.map((r) => ({
        pageUrl: r.pageUrl,
        pageTitle: lp.brandName,
        clicks: r.clicks,
      })),
      previousByUrl,
    )
    const sorted = sortRows(mapped, sortBy, sortOrder)
    const result = summarizeSeoRows(
      sorted,
      window.rangeId,
      sortBy,
      sortOrder,
      'gsc',
      gscInfo,
      content,
    )
    await writeAnalyticsCache(cacheKey, result)
    return result
  }

  let organic: { rows: SeoResultRow[]; content: SeoContentItem[] } = {
    rows: [],
    content: [],
  }
  try {
    organic = await seoOrganicFromClickHouse({
      workspaceId,
      window,
      brandName: lp.brandName,
    })
  } catch {
    organic = { rows: [], content: [] }
  }

  const sorted = sortRows(organic.rows, sortBy, sortOrder)
  const result = summarizeSeoRows(
    sorted,
    window.rangeId,
    sortBy,
    sortOrder,
    'organic',
    gscInfo,
    organic.content,
  )
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

  await invalidateAnalyticsCache(`analytics:seo:`)
  return { inserted: values.length }
}

export async function syncLandingPageFromGsc(lp: {
  id: string
  publicId: string
  workspaceId: string
  gscSiteUrl: string | null
  normalizedUrl: string
  origin: string
  hostname: string
}): Promise<{ inserted: number }> {
  if (!lp.gscSiteUrl?.trim()) {
    throw new Error('Landing page has no gscSiteUrl')
  }

  const connection = await db.query.workspaceGscConnections.findFirst({
    where: eq(workspaceGscConnections.workspaceId, lp.workspaceId),
  })
  if (!connection || connection.status !== 'active') {
    throw new Error('Workspace Search Console is not connected')
  }

  const refreshToken = decryptVapidPrivateKey(connection.refreshTokenEncrypted)
  const accessToken = await refreshGscAccessToken(refreshToken)

  const end = new Date()
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
  const pageFilter = gscPageFilterFromLanding(lp)

  const gscRows = await fetchGscSearchAnalytics({
    accessToken,
    siteUrl: lp.gscSiteUrl.trim(),
    startDate: start,
    endDate: end,
    pageFilter,
  })

  const result = await syncSeoResults({
    workspaceId: lp.id,
    lpPublicId: lp.publicId,
    rows: gscRows.map((row) => ({
      query: row.query,
      pageUrl: row.pageUrl,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      reportDate: row.reportDate,
    })),
  })

  await db
    .update(landingPages)
    .set({ gscLastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(landingPages.id, lp.id))

  return result
}

export async function syncAllGscLandingPages(): Promise<{
  synced: number
  failed: number
}> {
  const rows = await db
    .select({
      id: landingPages.id,
      publicId: landingPages.publicId,
      workspaceId: landingPages.workspaceId,
      gscSiteUrl: landingPages.gscSiteUrl,
      normalizedUrl: landingPages.normalizedUrl,
      origin: landingPages.origin,
      hostname: landingPages.hostname,
    })
    .from(landingPages)
    .where(
      and(isNotNull(landingPages.gscSiteUrl), ne(landingPages.gscSiteUrl, '')),
    )

  let synced = 0
  let failed = 0
  for (const lp of rows) {
    try {
      await syncLandingPageFromGsc(lp)
      synced += 1
    } catch {
      failed += 1
    }
  }
  return { synced, failed }
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
    source: 'organic',
    gsc: {
      connected: false,
      siteUrl: null,
      accountEmail: null,
      lastSyncedAt: null,
    },
    summary: {
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      rowCount: 0,
    },
    content: [],
    rows: [],
  }
}
