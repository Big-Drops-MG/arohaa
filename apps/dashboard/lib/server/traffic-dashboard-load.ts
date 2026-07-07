import { notFound } from "next/navigation"
import { getTrafficEmptyDashboardData } from "@/features/traffic/controller/traffic-empty-data"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  TRAFFIC_DATE_RANGE_OPTIONS,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import type { TrafficDashboardData } from "@/features/traffic/model/traffic"
import type { AnalyticsTraffic, RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"

export { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"

function safeNum(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function fmtCount(v: number): string {
  const n = safeNum(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1_000) return n.toLocaleString("en-US")
  return String(n)
}

function fmtPct(v: number): string {
  return `${safeNum(v).toFixed(1)}%`
}

const DATE_RANGE_OPTIONS = TRAFFIC_DATE_RANGE_OPTIONS

export function buildTrafficDashboardData(
  data: AnalyticsTraffic
): TrafficDashboardData {
  const { kpis } = data

  return {
    dateRangeOptions: DATE_RANGE_OPTIONS,
    defaultDateRangeId: data.rangeId,
    defaultKpiMetricId: "active-users",
    kpis: [
      {
        id: "active-users",
        label: "Active Users Right Now",
        value: `${fmtCount(kpis.activeUsersNow)} Users`,
      },
      { id: "visitors", label: "Visitors", value: fmtCount(kpis.visitors) },
      { id: "sessions", label: "Sessions", value: fmtCount(kpis.sessions) },
      {
        id: "page-views",
        label: "Page Views",
        value: fmtCount(kpis.pageViews),
      },
      {
        id: "bounce-rate",
        label: "Bounce Rate",
        value: fmtPct(kpis.bounceRate),
      },
    ],
    trafficByTime: {
      title: "Traffic by time",
      columns: [
        { key: "date", label: "Date" },
        { key: "visitors", label: "Visitors" },
        { key: "sessions", label: "Sessions" },
        { key: "formSubmitted", label: "Form Submitted" },
      ],
      rows: data.trafficByTime.map((row) => ({
        date: row.date,
        visitors: fmtCount(row.visitors),
        sessions: fmtCount(row.sessions),
        formSubmitted: fmtCount(row.formSubmitted),
      })),
    },
    trafficByDevice: {
      title: "Traffic by device",
      columns: [
        { key: "device", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: data.trafficByDevice.map((row) => ({
        device: row.device,
        visitors: fmtCount(row.visitors),
        formSubmitted: fmtCount(row.formSubmitted),
        fsr: fmtPct(row.fsr),
      })),
    },
    topPages: {
      title: "Top pages",
      columns: [
        { key: "page", label: "Pages" },
        { key: "visitors", label: "Visitors", align: "right" },
      ],
      rows: data.topPages.map((row) => ({
        page: row.page || "/",
        visitors: fmtCount(row.visitors),
      })),
    },
    trafficByLocation: {
      title: "Traffic by location",
      columns: [
        { key: "city", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: data.trafficByLocation.map((row) => ({
        city: row.city || "Unknown",
        visitors: fmtCount(row.visitors),
        formSubmitted: fmtCount(row.formSubmitted),
        fsr: fmtPct(row.fsr),
      })),
    },
    referrers: data.referrers.map((row) => ({
      domain: row.domain || "Direct",
      visitors: fmtCount(row.visitors),
    })),
    utmParameters: data.utmParameters.map((row) => ({
      domain: row.domain,
      visitors: fmtCount(row.visitors),
    })),
  }
}

export async function fetchTrafficAnalytics(
  workspaceId: string,
  rangeId: RangeId
): Promise<AnalyticsTraffic | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/traffic`)
    url.searchParams.set("workspace_id", workspaceId)
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
          `[traffic] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsTraffic
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[traffic] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[traffic] analytics fetch failed", err?.message || err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadTrafficDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<TrafficDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchTrafficAnalytics(row.id, rangeId)
  if (!analytics) {
    return getTrafficEmptyDashboardData(landingPagePublicId, rangeId)
  }

  return buildTrafficDashboardData(analytics)
}

export async function loadTrafficDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
): Promise<
  | { ok: true; data: TrafficDashboardData }
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

  const analytics = await fetchTrafficAnalytics(row.id, rangeId)
  if (!analytics) {
    return {
      ok: true,
      data: getTrafficEmptyDashboardData(landingPagePublicId, rangeId),
    }
  }

  return { ok: true, data: buildTrafficDashboardData(analytics) }
}
