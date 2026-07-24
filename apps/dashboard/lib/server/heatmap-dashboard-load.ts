import { notFound } from "next/navigation"
import { getHeatmapEmptyDashboardData } from "@/features/heatmap/controller/heatmap-empty-data"
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
import { appendDashboardCustomRangeParams } from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

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
  maxValue: number
  totalEvents: number
}

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
  }
): Promise<AnalyticsHeatmapResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/heatmap`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
    url.searchParams.set("mode", options.mode)
    url.searchParams.set("device", options.device)
    if (options.pageUrl) {
      url.searchParams.set("page_url", options.pageUrl)
    }
    appendDashboardCustomRangeParams(url, rangeId, options.customRange)

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
      return null
    }

    return (await resp.json()) as AnalyticsHeatmapResponse
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name: unknown }).name)
        : ""
    if (name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[heatmap] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[heatmap] analytics fetch failed", err)
    }
    return null
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
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  mode?: HeatmapMode
  device?: HeatmapDevice
  pageUrl?: string | null
  customRange?: DashboardCustomRange
}): Promise<HeatmapDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchHeatmapAnalytics(row.id, rangeId, {
    mode,
    device,
    pageUrl,
    customRange,
  })
  if (!analytics) {
    return getHeatmapEmptyDashboardData(
      landingPagePublicId,
      rangeId,
      mode,
      device
    )
  }

  return buildHeatmapDashboardData(analytics, rangeId)
}

export async function loadHeatmapDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  options: {
    modeRaw?: string | null
    deviceRaw?: string | null
    pageUrl?: string | null
    customRange?: DashboardCustomRange
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

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const analytics = await fetchHeatmapAnalytics(row.id, rangeId, {
    mode,
    device,
    pageUrl: options.pageUrl,
    customRange: options.customRange,
  })
  if (!analytics) {
    return {
      ok: true,
      data: getHeatmapEmptyDashboardData(
        landingPagePublicId,
        rangeId,
        mode,
        device
      ),
    }
  }

  return { ok: true, data: buildHeatmapDashboardData(analytics, rangeId) }
}
