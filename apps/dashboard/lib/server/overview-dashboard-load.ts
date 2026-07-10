import { notFound } from "next/navigation"
import { defaultAlertsByDateRange } from "@/features/alerts/controller/alerts-default-payload"
import { defaultEventTrackingByDateRange } from "@/features/event-tracking/controller/event-tracking-default-payload"
import { defaultEventTrackingKpiSegmentsByDateRange } from "@/features/event-tracking/controller/event-tracking-default-payload"
import { defaultEventTrackingSubmissionByDateRange } from "@/features/event-tracking/controller/event-tracking-default-payload"
import { defaultExperimentsByDateRange } from "@/features/experiments/controller/experiments-default-payload"
import {
  defaultFormDropOffByField,
  defaultMultiStepFormTracking,
} from "@/features/funnel/controller/funnel-default-payload"
import { getOverviewPlaceholderData } from "@/features/overview/controller/overview-placeholder-data"
import { defaultSegmentsByDateRange } from "@/features/segments/controller/segments-default-payload"
import { defaultSegmentsPerformanceByDateRange } from "@/features/segments/controller/segments-performance-default-payload"
import { defaultTrafficTablesByDateRange } from "@/features/traffic/controller/traffic-default-payload"
import { parseTrafficRangeId } from "@/features/traffic/model/traffic-range"
import type {
  OverviewAlert,
  OverviewDashboardData,
  OverviewFunnelStep,
  OverviewKpiSeriesByDateRange,
  OverviewKpiValuesByDateRange,
  OverviewLandingFormType,
  OverviewTrafficStat,
} from "@/features/overview/model/overview"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { appendDashboardUtmParams } from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import type { AnalyticsOverview, RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"

// ── formatters ────────────────────────────────────────────────────────────────

function fmtCount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`
  if (v >= 1_000) return v.toLocaleString("en-US")
  return String(v)
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function fmtDuration(secs: number): string {
  if (!secs || secs < 1) return "-"
  if (secs < 60) return `${Math.round(secs)}s`
  return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
}

function fmtActiveUsers(count: number): string {
  const n = Math.max(0, Math.floor(count))
  return `${n.toLocaleString("en-US")} User${n === 1 ? "" : "s"}`
}

function funnelStepsFromOverviewApi(
  data: AnalyticsOverview,
  formType: OverviewLandingFormType
): OverviewFunnelStep[] {
  const funnelTail =
    formType === "zip"
      ? (["Zip Started", "Zip Submitted"] as const)
      : (["Form Started", "Form Submitted"] as const)
  const funnelLabels = ["Landing Page Visits", "Interactions", ...funnelTail]

  return data.funnel.map((step, i) => ({
    label: funnelLabels[i] ?? step.label,
    value: fmtCount(step.count),
  }))
}

// ── transform ─────────────────────────────────────────────────────────────────

function buildOverviewFromAnalytics(
  data: AnalyticsOverview,
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  rangeId: RangeId
): OverviewDashboardData {
  const RANGES: RangeId[] = ["24h", "7d", "30d", "3m", "12m", "24m"]

  const kpisByDateRange = Object.fromEntries(
    RANGES.map((rid) => {
      const k = data.kpis[rid]
      return [
        rid,
        {
          visitors: fmtCount(k.visitors),
          sessions: fmtCount(k.sessions),
          "page-views": fmtCount(k.pageViews),
          "form-submitted": fmtCount(k.formSubmitted),
          fsr: fmtPct(k.fsr),
          "bounce-rate": fmtPct(k.bounceRate),
        },
      ]
    })
  ) as OverviewKpiValuesByDateRange

  const kpiSeriesByDateRange = Object.fromEntries(
    RANGES.map((rid) => [
      rid,
      data.kpiSeries?.[rid] ?? { visitors: data.series[rid] },
    ])
  ) as OverviewKpiSeriesByDateRange

  const funnel: OverviewFunnelStep[] = funnelStepsFromOverviewApi(
    data,
    formType
  )

  const traffic: OverviewTrafficStat[] = [
    { label: "Unique Visitors", value: fmtCount(data.uniqueVisitors7d) },
    {
      label: "Avg Session Duration",
      value: fmtDuration(data.avgEngagedSecPerSession),
    },
  ]

  const segments: OverviewTrafficStat[] = [
    { label: "Top City", value: data.topCity },
    { label: "Best Day", value: data.bestDayLabel },
  ]

  const alerts: OverviewAlert[] = !data.hasEvents24h
    ? [
        {
          id: "no-events-24h",
          message:
            "No events received in the last 24 hours. Verify the SDK snippet is installed.",
          severity: "warning" as const,
        },
      ]
    : []

  return {
    formType,
    dateRangeOptions: [
      { id: "24h", label: "Last 24 hours" },
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "3m", label: "Last 3 months" },
      { id: "12m", label: "Last 12 months" },
      { id: "24m", label: "Last 24 months" },
    ],
    defaultDateRangeId: rangeId,
    kpisByDateRange,
    defaultKpiMetricId: "visitors",
    funnel,
    multiStepFormTracking: defaultMultiStepFormTracking(),
    formDropOffByField: defaultFormDropOffByField(),
    traffic,
    segments,
    alerts,
    activeUsersNow: fmtActiveUsers(data.activeUsersNow),
    trafficTablesByDateRange: defaultTrafficTablesByDateRange(formType),
    eventTrackingByDateRange: defaultEventTrackingByDateRange(),
    eventTrackingSubmissionByDateRange:
      defaultEventTrackingSubmissionByDateRange(),
    eventTrackingKpiSegmentsByDateRange:
      defaultEventTrackingKpiSegmentsByDateRange(),
    segmentsByDateRange: defaultSegmentsByDateRange(),
    segmentsPerformanceByDateRange:
      defaultSegmentsPerformanceByDateRange(formType),
    experimentsByDateRange: defaultExperimentsByDateRange(formType),
    alertsByDateRange: defaultAlertsByDateRange(),
    kpiSeriesByDateRange,
  }
}

// ── loader ────────────────────────────────────────────────────────────────────

export async function loadOverviewDashboardData(
  landingPagePublicId: string,
  rangeId: RangeId = "7d",
  utmFilter?: DashboardUtmFilter
): Promise<OverviewDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) {
    return getOverviewPlaceholderData(landingPagePublicId, formType)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/overview`)
    url.searchParams.set("workspace_id", row.id)
    url.searchParams.set("form_type", formType)
    appendDashboardUtmParams(url, utmFilter)

    const overviewResp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!overviewResp.ok) {
      const body = await overviewResp.text().catch(() => "")
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[overview] analytics API ${overviewResp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return getOverviewPlaceholderData(landingPagePublicId, formType)
    }

    const data = (await overviewResp.json()) as AnalyticsOverview
    return buildOverviewFromAnalytics(data, formType, rangeId)
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[overview] analytics fetch failed", err)
    }
    return getOverviewPlaceholderData(landingPagePublicId, formType)
  } finally {
    clearTimeout(timer)
  }
}

export async function loadOverviewDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter
): Promise<
  | { ok: true; data: OverviewDashboardData }
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

  const data = await loadOverviewDashboardData(
    landingPagePublicId,
    rangeId,
    utmFilter
  )
  return { ok: true, data }
}
