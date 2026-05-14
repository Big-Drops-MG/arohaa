import { notFound } from "next/navigation"
import { getOverviewPlaceholderData } from "@/features/overview/controller/overview-placeholder-data"
import type {
  OverviewAlert,
  OverviewDashboardData,
  OverviewFunnelStep,
  OverviewKpiSeriesByDateRange,
  OverviewKpiValuesByDateRange,
  OverviewTrafficStat,
} from "@/features/overview/model/overview"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"
import type { AnalyticsOverview, RangeId } from "@/lib/server/analytics-types"

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

// ── transform ─────────────────────────────────────────────────────────────────

function buildOverviewFromAnalytics(
  data: AnalyticsOverview,
  formType: ReturnType<typeof parseOverviewLandingFormType>
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
    RANGES.map((rid) => [rid, { visitors: data.series[rid] }])
  ) as OverviewKpiSeriesByDateRange

  const funnelTail =
    formType === "zip"
      ? (["Zip Started", "Zip Submitted"] as const)
      : (["Form Started", "Form Submitted"] as const)
  const funnelLabels = ["Landing Page Visits", "Interactions", ...funnelTail]

  const funnel: OverviewFunnelStep[] = data.funnel.map((step, i) => ({
    label: funnelLabels[i] ?? step.label,
    value: fmtCount(step.count),
  }))

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

  const alerts: OverviewAlert[] = data.hasEvents24h
    ? []
    : [
        {
          id: "no-events-24h",
          message:
            "No events received in the last 24 hours. Verify the SDK snippet is installed.",
          severity: "warning",
        },
      ]

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
    defaultDateRangeId: "7d",
    kpisByDateRange,
    defaultKpiMetricId: "visitors",
    funnel,
    traffic,
    segments,
    alerts,
    kpiSeriesByDateRange,
  }
}

// ── loader ────────────────────────────────────────────────────────────────────

export async function loadOverviewDashboardData(
  landingPagePublicId: string
): Promise<OverviewDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const row = await getActiveLandingPageInWorkspace(ws.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const apiBase =
    process.env.INGEST_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_AROHAA_INGEST_API_BASE?.trim()
  const secret = process.env.AROHAA_INTERNAL_API_SECRET?.trim()

  if (!apiBase || !secret) {
    return getOverviewPlaceholderData(landingPagePublicId, formType)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const resp = await fetch(
      `${apiBase}/v1/analytics/overview?workspace_id=${encodeURIComponent(row.id)}`,
      {
        headers: { "x-arohaa-internal": secret },
        signal: controller.signal,
        cache: "no-store",
      }
    )

    if (!resp.ok) {
      return getOverviewPlaceholderData(landingPagePublicId, formType)
    }

    const data = (await resp.json()) as AnalyticsOverview
    return buildOverviewFromAnalytics(data, formType)
  } catch {
    return getOverviewPlaceholderData(landingPagePublicId, formType)
  } finally {
    clearTimeout(timer)
  }
}
