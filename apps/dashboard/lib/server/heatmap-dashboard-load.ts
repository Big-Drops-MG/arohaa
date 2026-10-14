import { notFound } from "next/navigation"
import { getHeatmapUnavailableDashboardData } from "@/features/heatmap/controller/heatmap-empty-data"
import {
  parseHeatmapDevice,
  parseHeatmapMode,
  type HeatmapDashboardData,
  type HeatmapDevice,
  type HeatmapMode,
} from "@/features/heatmap/model/heatmap"
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
import {
  appendDashboardCustomRangeParams,
  appendDashboardUtmParams,
  resolveUtmFilterForActor,
} from "@/lib/server/analytics-utm-params"
import {
  resolveHeatmapPageUrl,
  sanitizeHeatmapPageUrl,
} from "@/lib/server/route-query-limits"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"

type AnalyticsHeatmapResponse = {
  rangeId: string
  mode: HeatmapMode
  device: HeatmapDevice
  pageUrl: string | null
  pageUrls: string[]
  cells: HeatmapDashboardData["cells"]
  points: HeatmapDashboardData["points"]
  scrollBuckets: HeatmapDashboardData["scrollBuckets"]
  sections: HeatmapDashboardData["sections"]
  fields?: HeatmapDashboardData["fields"]
  maxValue: number
  totalEvents: number
}

export type HeatmapAnalyticsFetchResult =
  | { ok: true; data: AnalyticsHeatmapResponse }
  | { ok: false; reason: "unavailable" }

export function buildHeatmapDashboardData(
  data: AnalyticsHeatmapResponse,
  rangeId: RangeId
): HeatmapDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    mode: data.mode,
    device: data.device,
    pageUrl: data.pageUrl,
    pageUrls: data.pageUrls,
    cells: data.cells,
    points: data.points ?? [],
    scrollBuckets: data.scrollBuckets,
    sections: data.sections,
    fields: data.fields ?? [],
    maxValue: data.maxValue,
    totalEvents: data.totalEvents,
    opacity: 0.65,
  }
}

export async function fetchHeatmapAnalytics(
  workspaceId: string,
  rangeId: RangeId,
  options: {
    mode: HeatmapMode
    device: HeatmapDevice
    pageUrl?: string | null
    customRange?: DashboardCustomRange
    utmFilter?: DashboardUtmFilter
  }
): Promise<HeatmapAnalyticsFetchResult> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return { ok: false, reason: "unavailable" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  const pageUrl = sanitizeHeatmapPageUrl(options.pageUrl)

  try {
    const url = new URL(`${apiBase}/v1/analytics/heatmap`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
    url.searchParams.set("mode", options.mode)
    url.searchParams.set("device", options.device)
    if (pageUrl) {
      url.searchParams.set("page_url", pageUrl)
    }
    appendDashboardCustomRangeParams(url, rangeId, options.customRange)
    appendDashboardUtmParams(url, options.utmFilter)

    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[heatmap] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return { ok: false, reason: "unavailable" }
    }

    return {
      ok: true,
      data: (await resp.json()) as AnalyticsHeatmapResponse,
    }
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: unknown }).name)
        : ""
    if (name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[heatmap] analytics fetch timed out")
      }
      return { ok: false, reason: "unavailable" }
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[heatmap] analytics fetch failed", err)
    }
    return { ok: false, reason: "unavailable" }
  } finally {
    clearTimeout(timer)
  }
}

export async function loadHeatmapDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  mode = "click",
  device = "desktop",
  pageUrl,
  customRange,
  utmFilter,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  mode?: HeatmapMode
  device?: HeatmapDevice
  pageUrl?: string | null
  customRange?: DashboardCustomRange
  utmFilter?: DashboardUtmFilter
}): Promise<HeatmapDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const resolvedPageUrl = resolveHeatmapPageUrl(pageUrl, row.landingPageUrl)
  const analytics = await fetchHeatmapAnalytics(row.id, rangeId, {
    mode,
    device,
    pageUrl: resolvedPageUrl,
    customRange,
    utmFilter: scopedUtmFilter,
  })
  if (!analytics.ok) {
    return getHeatmapUnavailableDashboardData(
      landingPagePublicId,
      rangeId,
      mode,
      device,
      resolvedPageUrl
    )
  }

  return buildHeatmapDashboardData(analytics.data, rangeId)
}

export async function loadHeatmapDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  options: {
    modeRaw?: string | null
    deviceRaw?: string | null
    pageUrl?: string | null
    customRange?: DashboardCustomRange
    utmFilter?: DashboardUtmFilter
  } = {}
): Promise<
  | { ok: true; data: HeatmapDashboardData }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const mode = parseHeatmapMode(options.modeRaw)
  const device = parseHeatmapDevice(options.deviceRaw)

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    options.utmFilter
  )

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const resolvedPageUrl = resolveHeatmapPageUrl(
    options.pageUrl,
    row.landingPageUrl
  )
  const analytics = await fetchHeatmapAnalytics(row.id, rangeId, {
    mode,
    device,
    pageUrl: resolvedPageUrl,
    customRange: options.customRange,
    utmFilter: scopedUtmFilter,
  })
  if (!analytics.ok) {
    // Do not return ok:true with an empty heatmap — that looks like zero clicks.
    return {
      ok: false,
      status: 503,
      error: "Analytics temporarily unavailable",
    }
  }

  return { ok: true, data: buildHeatmapDashboardData(analytics.data, rangeId) }
}
