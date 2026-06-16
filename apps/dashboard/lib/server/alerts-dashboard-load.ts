import { notFound } from "next/navigation"
import { getAlertsEmptyDashboardData } from "@/features/alerts/controller/alerts-empty-data"
import type { AlertsDashboardData } from "@/features/alerts/model/alerts"
import type {
  OverviewAlert,
  OverviewAlertSeverity,
} from "@/features/overview/model/overview"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

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

function mapAnalyticsAlerts(items: AnalyticsAlertItem[]): OverviewAlert[] {
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
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: rangeId as any,
    items: mapAnalyticsAlerts(data.items),
  }
}

export async function fetchAlertsAnalytics(
  workspaceId: string,
  landingPagePublicId: string,
  rangeId: RangeId
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
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[alerts] analytics fetch failed", err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadAlertsDashboardData({
  landingPagePublicId,
  rangeId = "7d",
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<AlertsDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchAlertsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId
  )
  if (!analytics) {
    return getAlertsEmptyDashboardData(landingPagePublicId, rangeId as any)
  }

  return buildAlertsDashboardData(analytics, rangeId)
}

export async function loadAlertsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
): Promise<
  | { ok: true; data: AlertsDashboardData }
  | { ok: false; status: number; error: string }
> {
  const validRanges = ["24h", "7d", "30d", "3m", "12m", "24m"]
  const rangeId = validRanges.includes(rangeIdRaw as string)
    ? (rangeIdRaw as RangeId)
    : "7d"

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const analytics = await fetchAlertsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId
  )
  if (!analytics) {
    return {
      ok: true,
      data: getAlertsEmptyDashboardData(landingPagePublicId, rangeId as any),
    }
  }

  return { ok: true, data: buildAlertsDashboardData(analytics, rangeId) }
}
