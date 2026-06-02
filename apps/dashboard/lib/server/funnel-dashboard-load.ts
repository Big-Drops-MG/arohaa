import { notFound } from "next/navigation"
import { getFunnelEmptyDashboardData } from "@/features/funnel/controller/funnel-empty-data"
import {
  type FunnelDashboardData,
  funnelKpiMetricIdAtIndex,
} from "@/features/funnel/model/funnel"
import type {
  OverviewFunnelStep,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import { formatFunnelTrendChange } from "@/features/funnel/utils/funnel-trend"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  TRAFFIC_DATE_RANGE_OPTIONS,
  parseTrafficRangeId,
} from "@/features/traffic/model/traffic-range"
import type { AnalyticsFunnel, RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageInWorkspace } from "@/lib/server/landing-pages-store"
import { getOrCreateOwnerWorkspace } from "@/lib/server/resolve-workspace"

export { parseTrafficRangeId as parseFunnelRangeId } from "@/features/traffic/model/traffic-range"

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
  return `${Math.round(safeNum(v))}%`
}

function fmtChange(pct: number | null) {
  return formatFunnelTrendChange(pct)
}

function metricLabelsForFormType(formType: OverviewLandingFormType): string[] {
  const tail =
    formType === "zip"
      ? (["Zip Started", "Zip Submitted"] as const)
      : (["Form Started", "Form Submitted"] as const)
  return ["Landing Page Visits", "Interactions", ...tail]
}

function relabelMetrics(
  metrics: AnalyticsFunnel["metrics"],
  formType: OverviewLandingFormType
) {
  const labels = metricLabelsForFormType(formType)
  return metrics.map((metric, index) => ({
    ...metric,
    label: labels[index] ?? metric.label,
  }))
}

export function buildFunnelDashboardData(
  data: AnalyticsFunnel,
  formType: OverviewLandingFormType
): FunnelDashboardData {
  const metrics = relabelMetrics(data.metrics, formType)

  return {
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: data.rangeId,
    defaultKpiMetricId: "landing-page-visits",
    metrics: metrics.map((metric, index) => ({
      id: funnelKpiMetricIdAtIndex(index),
      label: metric.label,
      value: fmtCount(metric.count),
      ...fmtChange(metric.changePct),
    })),
    multiStepSteps: data.multiStepSteps.map((step) => ({
      label: step.label,
      value: fmtCount(step.count),
      ...fmtChange(step.changePct),
    })),
    dropOffRows: data.dropOffRows.map((row) => ({
      fieldName: row.fieldName,
      dropOffs: fmtCount(row.dropOffs),
      percentDrop: fmtPct(row.percentDrop),
      emphasized: row.emphasized,
    })),
  }
}

export function buildOverviewFunnelSteps(
  data: AnalyticsFunnel,
  formType: OverviewLandingFormType
): OverviewFunnelStep[] {
  return relabelMetrics(data.metrics, formType).map((metric) => ({
    label: metric.label,
    value: fmtCount(metric.count),
    ...fmtChange(metric.changePct),
  }))
}

export async function fetchFunnelAnalytics(
  workspaceId: string,
  rangeId: RangeId
): Promise<AnalyticsFunnel | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/funnel`)
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
          `[funnel] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsFunnel
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[funnel] analytics fetch failed", err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadFunnelDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<FunnelDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const row = await getActiveLandingPageInWorkspace(ws.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchFunnelAnalytics(row.id, rangeId)
  if (!analytics) {
    return getFunnelEmptyDashboardData(landingPagePublicId, rangeId)
  }

  return buildFunnelDashboardData(analytics, formType)
}

export async function loadFunnelDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
): Promise<
  | { ok: true; data: FunnelDashboardData }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw)

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const row = await getActiveLandingPageInWorkspace(ws.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchFunnelAnalytics(row.id, rangeId)
  if (!analytics) {
    return {
      ok: true,
      data: getFunnelEmptyDashboardData(landingPagePublicId, rangeId),
    }
  }

  return { ok: true, data: buildFunnelDashboardData(analytics, formType) }
}

export async function loadOverviewFunnelSteps({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<OverviewFunnelStep[] | null> {
  const actor = await requireLandingPageActor()
  if (!actor) return null

  const ws = await getOrCreateOwnerWorkspace(actor.id)
  const row = await getActiveLandingPageInWorkspace(ws.id, landingPagePublicId)
  if (!row) return null

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchFunnelAnalytics(row.id, rangeId)
  if (!analytics) return null

  return buildOverviewFunnelSteps(analytics, formType)
}
