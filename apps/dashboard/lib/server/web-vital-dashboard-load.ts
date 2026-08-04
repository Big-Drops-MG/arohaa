import { notFound } from "next/navigation"
import { getWebVitalEmptyDashboardData } from "@/features/web-vital/controller/web-vital-empty-data"
import type { WebVitalDashboardData } from "@/features/web-vital/model/web-vital"
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

type AnalyticsWebVitalsResponse = Omit<
  WebVitalDashboardData,
  "dateRangeOptions" | "defaultDateRangeId"
> & {
  rangeId?: RangeId
}

export function buildWebVitalDashboardData(
  data: AnalyticsWebVitalsResponse,
  rangeId: RangeId
): WebVitalDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId as WebVitalDashboardData["defaultDateRangeId"],
    lighthouseScore: data.lighthouseScore,
    metrics: data.metrics,
    devices: data.devices,
    states: data.states,
    totalSamples: data.totalSamples,
  }
}

async function fetchWebVitalAnalytics(
  workspaceId: string,
  rangeId: RangeId,
  customRange?: DashboardCustomRange
): Promise<AnalyticsWebVitalsResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/web-vitals`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
    appendDashboardCustomRangeParams(url, rangeId, customRange)

    const res = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as AnalyticsWebVitalsResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadWebVitalDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  customRange,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  customRange?: DashboardCustomRange
}): Promise<WebVitalDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchWebVitalAnalytics(row.id, rangeId, customRange)
  if (!analytics) {
    return getWebVitalEmptyDashboardData(landingPagePublicId, rangeId)
  }

  return buildWebVitalDashboardData(analytics, rangeId)
}

export async function loadWebVitalDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: WebVitalDashboardData }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw)

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const data = await loadWebVitalDashboardData({
    landingPagePublicId,
    rangeId,
    customRange,
  })
  return { ok: true, data }
}
