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
  buildInternalUserDelegationHeaders,
  FUNNEL_LEADS_DELEGATION_SCOPE,
  resolveVehicleNamesInLeadFields,
  resolveVehicleNamesInLevel2Stats,
} from "@workspace/database"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { canAccessDataExport } from "@/lib/server/data-export-acl"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { appendDashboardCustomRangeParams } from "@/lib/server/analytics-utm-params"
import {
  resolveLevel1Stats,
  type Level1Stat,
} from "@/features/data-lab/model/level1"
import {
  resolveLevel2Stats,
  type Level2Stat,
} from "@/features/data-lab/model/level2"
import {
  hasCompleteLevel3Stats,
  resolveLevel3Stats,
} from "@/features/data-lab/model/level3"
import type { IntelligenceCenterPayload } from "@/features/data-lab/model/intelligence"
import { mapDataExportLeadRow } from "@/features/data-lab/model/level1-from-leads"
import { DEFAULT_ROUTE_MAX_OFFSET } from "@/lib/server/route-query-limits"

type LeadsApiResponse = {
  rangeId?: RangeId
  leads?: Array<{
    sessionId: string
    macId?: string
    createdAt: string
    submittedAt?: string | null
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
  visibleLeadFieldKeys?: string[]
  level1Stats?: Level1Stat[]
  level2Stats?: Level2Stat[]
  level3?: IntelligenceCenterPayload | null
}

async function fetchLeads(
  workspaceId: string,
  actorId: string,
  rangeId: RangeId,
  customRange: DashboardCustomRange | undefined,
  limit: number,
  offset: number
): Promise<LeadsApiResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const delegationHeaders = buildInternalUserDelegationHeaders(secret, {
    userId: actorId,
    landingPageId: workspaceId,
    scope: FUNNEL_LEADS_DELEGATION_SCOPE,
  })

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
      headers: {
        "x-arohaa-internal": secret,
        ...delegationHeaders,
      },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error(`[data-export] leads API ${res.status}`, body.slice(0, 200))
      return null
    }
    return (await res.json()) as LeadsApiResponse
  } catch (err) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : ""
    if (name === "AbortError") {
      console.warn("[data-export] leads API request timed out")
    } else {
      console.error("[data-export] leads API request failed", err)
    }
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
  if (offset > DEFAULT_ROUTE_MAX_OFFSET) notFound()

  const actor = await requireLandingPageActor()
  if (!actor) notFound()
  if (!(await canAccessDataExport(actor))) {
    notFound()
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const hasRedirect = Boolean(row.redirectPageUrl?.trim())
  if (!hasRedirect) {
    return getDataExportEmptyDashboardData(rangeId, false, row.brandName)
  }

  const analytics = await fetchLeads(
    row.id,
    actor.id,
    rangeId,
    customRange,
    limit,
    offset
  )
  if (!analytics) {
    return getDataExportEmptyDashboardData(rangeId, true, row.brandName)
  }

  const rawMappedLeads = (analytics.leads ?? []).map((lead) =>
    mapDataExportLeadRow(lead as unknown as Record<string, unknown>)
  )
  let mappedLeads = rawMappedLeads
  let mappedLevel2Stats = analytics.level2Stats
  try {
    const resolved = await Promise.all([
      resolveVehicleNamesInLeadFields(rawMappedLeads),
      resolveVehicleNamesInLevel2Stats(analytics.level2Stats ?? []),
    ])
    mappedLeads = resolved[0]
    mappedLevel2Stats = resolved[1]
  } catch (error) {
    console.error("[data-export] vehicle model lookup failed", error)
  }
  const level1 = resolveLevel1Stats(analytics.level1Stats, mappedLeads)
  const level2 = resolveLevel2Stats(
    mappedLevel2Stats,
    mappedLeads,
    Array.isArray(mappedLevel2Stats)
  )
  const level3 = resolveLevel3Stats(
    analytics.level3,
    mappedLeads,
    analytics.visibleLeadFieldKeys ?? [],
    Boolean(analytics.level3 && hasCompleteLevel3Stats(analytics.level3))
  )

  return {
    brandName: row.brandName,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: (analytics.rangeId ??
      rangeId) as DataExportDashboardData["defaultDateRangeId"],
    leads: mappedLeads,
    visibleLeadFieldKeys: analytics.visibleLeadFieldKeys ?? [],
    total: analytics.total ?? 0,
    limit: analytics.limit ?? limit,
    offset: analytics.offset ?? offset,
    hasMore: Boolean(analytics.hasMore),
    hasRedirect: true,
    level1Stats: level1.stats,
    level1Complete: level1.complete,
    level2Stats: level2.stats,
    level2Complete: level2.complete,
    level3: level3.payload,
    level3Complete: level3.complete,
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
  if (!(await canAccessDataExport(actor))) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const offsetRawNum = Number(offsetRaw ?? 0) || 0
  if (offsetRawNum > DEFAULT_ROUTE_MAX_OFFSET) {
    return { ok: false, status: 400, error: "Invalid offset" }
  }

  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(limitRaw ?? DATA_EXPORT_PAGE_SIZE) || DATA_EXPORT_PAGE_SIZE
    )
  )
  const offset = Math.min(DEFAULT_ROUTE_MAX_OFFSET, Math.max(0, offsetRawNum))

  const data = await loadDataExportDashboardData({
    landingPagePublicId,
    rangeId,
    customRange,
    limit,
    offset,
  })
  return { ok: true, data }
}
