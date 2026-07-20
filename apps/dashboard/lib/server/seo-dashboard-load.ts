import { notFound } from "next/navigation"
import { getSeoEmptyDashboardData } from "@/features/seo/controller/seo-empty-data"
import type {
  SeoDashboardData,
  SeoSortField,
  SeoSortOrder,
} from "@/features/seo/model/seo"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  TRAFFIC_DATE_RANGE_OPTIONS,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { appendDashboardCustomRangeParams } from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

interface AnalyticsSeoResponse {
  summary: SeoDashboardData["summary"]
  rows: SeoDashboardData["rows"]
  sortBy: SeoSortField
  sortOrder: SeoSortOrder
}

export function buildSeoDashboardData(
  data: AnalyticsSeoResponse,
  rangeId: RangeId
): SeoDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId as SeoDashboardData["defaultDateRangeId"],
    defaultSortBy: data.sortBy,
    defaultSortOrder: data.sortOrder,
    summary: {
      ...data.summary,
      totalClicks: data.summary.totalClicks,
      totalImpressions: data.summary.totalImpressions,
    },
    rows: data.rows.map((row) => ({
      ...row,
      clicks: row.clicks,
      impressions: row.impressions,
    })),
  }
}

async function fetchSeoAnalytics(
  workspaceId: string,
  lpPublicId: string,
  rangeId: RangeId,
  sortBy: SeoSortField,
  sortOrder: SeoSortOrder,
  customRange?: DashboardCustomRange
): Promise<AnalyticsSeoResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/seo`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("lp_public_id", lpPublicId)
    url.searchParams.set("range_id", rangeId)
    url.searchParams.set("sort_by", sortBy)
    url.searchParams.set("sort_order", sortOrder)
    appendDashboardCustomRangeParams(url, rangeId, customRange)

    const res = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as AnalyticsSeoResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadSeoDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  sortBy = "clicks",
  sortOrder = "desc",
  customRange,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  sortBy?: SeoSortField
  sortOrder?: SeoSortOrder
  customRange?: DashboardCustomRange
}): Promise<SeoDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchSeoAnalytics(
    row.id,
    landingPagePublicId,
    rangeId,
    sortBy,
    sortOrder,
    customRange
  )
  if (!analytics) {
    return getSeoEmptyDashboardData(landingPagePublicId, rangeId)
  }

  return buildSeoDashboardData(analytics, rangeId)
}

export async function loadSeoDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  sortByRaw: string | null | undefined,
  sortOrderRaw: string | null | undefined,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: SeoDashboardData }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw)

  const sortFields: SeoSortField[] = [
    "clicks",
    "impressions",
    "ctr",
    "position",
    "query",
  ]
  const sortBy = sortFields.includes(sortByRaw as SeoSortField)
    ? (sortByRaw as SeoSortField)
    : "clicks"
  const sortOrder: SeoSortOrder = sortOrderRaw === "asc" ? "asc" : "desc"

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const data = await loadSeoDashboardData({
    landingPagePublicId,
    rangeId,
    sortBy,
    sortOrder,
    customRange,
  })
  return { ok: true, data }
}

export async function syncSeoRowsForApi(
  landingPagePublicId: string,
  rows: SeoDashboardData["rows"]
): Promise<
  { ok: true; inserted: number } | { ok: false; status: number; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: false, status: 503, error: "Analytics API not configured" }
  }

  const res = await fetch(`${apiBase}/v1/analytics/seo/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-arohaa-internal": secret,
    },
    body: JSON.stringify({
      workspace_id: row.id,
      lp_public_id: landingPagePublicId,
      rows: rows.map((entry) => ({
        query: entry.query,
        pageUrl: entry.pageUrl,
        clicks: entry.clicks,
        impressions: entry.impressions,
        ctr: entry.ctr,
        position: entry.position,
        reportDate: entry.reportDate,
      })),
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    return { ok: false, status: res.status, error: "SEO sync failed" }
  }

  const json = (await res.json()) as { inserted: number }
  return { ok: true, inserted: json.inserted ?? rows.length }
}
