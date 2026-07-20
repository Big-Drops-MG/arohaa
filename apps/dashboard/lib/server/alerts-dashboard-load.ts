import { notFound } from "next/navigation"
import { getAlertsEmptyDashboardData } from "@/features/alerts/controller/alerts-empty-data"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import type {
  OverviewAlert,
  OverviewAlertSeverity,
} from "@/features/overview/model/overview"
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
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  appendDashboardCustomRangeParams,
  appendDashboardUtmParams,
} from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

interface AnalyticsAlertItem {
  id: string
  message: string
  date: string
  severity: "warning" | "info"
}

interface AnalyticsAlertsResponse {
  items: AnalyticsAlertItem[]
}

function mapAlertSeverity(
  severity: AnalyticsAlertItem["severity"]
): OverviewAlertSeverity {
  if (severity === "info") return "alert"
  return "warning"
}

export function mapAnalyticsAlerts(
  items: AnalyticsAlertItem[]
): OverviewAlert[] {
  return items.map((item) => ({
    id: item.id,
    message: item.message,
    severity: mapAlertSeverity(item.severity),
    dateLabel: item.date,
  }))
}

export function buildAlertsDashboardData(
  data: AnalyticsAlertsResponse,
  rangeId: RangeId
): AlertsDashboardData {
  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    items: mapAnalyticsAlerts(data.items),
  }
}

export async function fetchAlertsAnalytics(
  workspaceId: string,
  landingPagePublicId: string,
  rangeId: RangeId,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<AnalyticsAlertsResponse | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/alerts`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("lp_public_id", landingPagePublicId)
    url.searchParams.set("range_id", rangeId)
    appendDashboardCustomRangeParams(url, rangeId, customRange)
    appendDashboardUtmParams(url, utmFilter)

    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[alerts] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsAlertsResponse
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[alerts] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[alerts] analytics fetch failed", err?.message || err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadAlertsDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  utmFilter,
  customRange,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  utmFilter?: DashboardUtmFilter
  customRange?: DashboardCustomRange
}): Promise<AlertsDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchAlertsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId,
    utmFilter,
    customRange
  )
  if (!analytics) {
    return getAlertsEmptyDashboardData(landingPagePublicId, rangeId)
  }

  return buildAlertsDashboardData(analytics, rangeId)
}

export async function loadAlertsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: AlertsDashboardData }
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

  const analytics = await fetchAlertsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId,
    utmFilter,
    customRange
  )
  if (!analytics) {
    return {
      ok: true,
      data: getAlertsEmptyDashboardData(landingPagePublicId, rangeId),
    }
  }

  return { ok: true, data: buildAlertsDashboardData(analytics, rangeId) }
}
