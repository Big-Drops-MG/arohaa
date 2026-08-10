import { notFound } from "next/navigation"
import {
  emptyInsightsSection,
  type InsightsSectionPayload,
} from "@/features/insights/model/insights"
import {
  parseInsightSection,
  type InsightSectionId,
} from "@/features/insights/model/insights-section"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  appendDashboardCustomRangeParams,
  appendDashboardUtmParams,
  resolveUtmFilterForActor,
} from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

async function fetchInsightsAnalytics(
  workspaceId: string,
  section: InsightSectionId,
  rangeId: RangeId,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange,
  segmentId?: string | null
): Promise<InsightsSectionPayload | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/insights`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
    url.searchParams.set("section", section)
    appendDashboardCustomRangeParams(url, rangeId, customRange)
    appendDashboardUtmParams(url, utmFilter)
    if (segmentId) url.searchParams.set("segment_id", segmentId)

    const res = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as InsightsSectionPayload
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadInsightsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  sectionRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange,
  segmentId?: string | null
): Promise<
  | { ok: true; data: InsightsSectionPayload }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw) ?? DEFAULT_TRAFFIC_RANGE_ID
  const section = parseInsightSection(sectionRaw)

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const resolvedUtm = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const analytics = await fetchInsightsAnalytics(
    row.id,
    section,
    rangeId,
    resolvedUtm,
    customRange,
    segmentId
  )

  if (!analytics) {
    return { ok: true, data: emptyInsightsSection(section) }
  }

  return { ok: true, data: analytics }
}

export async function loadInsightsDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  section = "volume",
  utmFilter,
  customRange,
  segmentId,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  section?: InsightSectionId
  utmFilter?: DashboardUtmFilter
  customRange?: DashboardCustomRange
  segmentId?: string | null
}): Promise<InsightsSectionPayload> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const resolvedUtm = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const analytics = await fetchInsightsAnalytics(
    row.id,
    section,
    rangeId,
    resolvedUtm,
    customRange,
    segmentId
  )
  return analytics ?? emptyInsightsSection(section)
}
