import { notFound } from "next/navigation"
import { getDataExportEmptyDashboardData } from "@/features/data-export/controller/data-export-empty-data"
import {
  DATA_EXPORT_PAGE_SIZE,
  type DataExportDashboardData,
} from "@/features/data-export/model/data-export"
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
import { canAccessDataExport } from "@/lib/server/data-export-acl"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { appendDashboardCustomRangeParams } from "@/lib/server/analytics-utm-params"

type LeadsApiResponse = {
  rangeId?: RangeId
  leads?: Array<{
    sessionId: string
    createdAt: string
    zip: string
    email?: string
    utmSource?: string
    utmId?: string
    trustedFormUrl?: string
    formSubmitted?: boolean
    fields: Record<string, string>
  }>
  total?: number
  limit?: number
  offset?: number
  hasMore?: boolean
}

async function fetchLeads(
  workspaceId: string,
  rangeId: RangeId,
  customRange: DashboardCustomRange | undefined,
  limit: number,
  offset: number
): Promise<LeadsApiResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const url = new URL(`${apiBase}/v1/analytics/funnel/leads`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
    url.searchParams.set("limit", String(limit))
    url.searchParams.set("offset", String(offset))
    appendDashboardCustomRangeParams(url, rangeId, customRange)

    const res = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as LeadsApiResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadDataExportDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  customRange,
  limit = DATA_EXPORT_PAGE_SIZE,
  offset = 0,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  customRange?: DashboardCustomRange
  limit?: number
  offset?: number
}): Promise<DataExportDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()
  if (!canAccessDataExport(actor.email)) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const hasRedirect = Boolean(row.redirectPageUrl?.trim())
  if (!hasRedirect) {
    return getDataExportEmptyDashboardData(rangeId, false, row.brandName)
  }

  const analytics = await fetchLeads(
    row.id,
    rangeId,
    customRange,
    limit,
    offset
  )
  if (!analytics) {
    return getDataExportEmptyDashboardData(rangeId, true, row.brandName)
  }

  return {
    brandName: row.brandName,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: (analytics.rangeId ??
      rangeId) as DataExportDashboardData["defaultDateRangeId"],
    leads: (analytics.leads ?? []).map((lead) => ({
      sessionId: lead.sessionId,
      createdAt: lead.createdAt,
      zip: lead.zip,
      email: lead.email ?? "",
      utmSource: lead.utmSource ?? "",
      utmId: lead.utmId ?? "",
      trustedFormUrl: lead.trustedFormUrl ?? "",
      formSubmitted: Boolean(lead.formSubmitted),
      fields: lead.fields ?? {},
    })),
    total: analytics.total ?? 0,
    limit: analytics.limit ?? limit,
    offset: analytics.offset ?? offset,
    hasMore: Boolean(analytics.hasMore),
    hasRedirect: true,
  }
}

export async function loadDataExportDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  customRange: DashboardCustomRange | undefined,
  limitRaw: string | null | undefined,
  offsetRaw: string | null | undefined
): Promise<
  | { ok: true; data: DataExportDashboardData }
  | { ok: false; status: number; error: string }
> {
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  if (!canAccessDataExport(actor.email)) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(limitRaw ?? DATA_EXPORT_PAGE_SIZE) || DATA_EXPORT_PAGE_SIZE
    )
  )
  const offset = Math.max(0, Number(offsetRaw ?? 0) || 0)

  const data = await loadDataExportDashboardData({
    landingPagePublicId,
    rangeId,
    customRange,
    limit,
    offset,
  })
  return { ok: true, data }
}
