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
import { overviewChartPointsForRange } from "@/features/overview/utils/overview-chart-buckets"
import { overviewKpiMetricOrder } from "@/features/overview/model/overview"
import { defaultSegmentsByDateRange } from "@/features/segments/controller/segments-default-payload"
import { defaultSegmentsPerformanceByDateRange } from "@/features/segments/controller/segments-performance-default-payload"
import { defaultTrafficTablesByDateRange } from "@/features/traffic/controller/traffic-default-payload"
import {
  DEFAULT_TRAFFIC_RANGE_ID,
  TRAFFIC_DATE_RANGE_OPTIONS,
  parseTrafficRangeId,
  type DashboardCustomRange,
} from "@/features/traffic/model/traffic-range"
import type {
  OverviewAlert,
  OverviewCityMetric,
  OverviewDashboardData,
  OverviewFunnelStep,
  OverviewKpiMetricId,
  OverviewKpiSeriesByDateRange,
  OverviewKpiValuesByDateRange,
  OverviewLandingFormType,
  OverviewTrafficStat,
  OverviewZipcodeMetric,
} from "@/features/overview/model/overview"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import {
  appendDashboardCustomRangeParams,
  appendDashboardUtmParams,
  resolveUtmFilterForActor,
} from "@/lib/server/analytics-utm-params"
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
    formType === "none"
      ? (["Service Clicked"] as const)
      : formType === "zip"
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
  const k = data.kpis
  const kpisByDateRange: OverviewKpiValuesByDateRange = {
    [rangeId]: {
      visitors: fmtCount(k.visitors),
      sessions: fmtCount(k.sessions),
      "page-views": fmtCount(k.pageViews),
      "form-submitted": fmtCount(k.formSubmitted),
      fsr: fmtPct(k.fsr),
      "bounce-rate": fmtPct(k.bounceRate),
    },
  }

  const kpiSeriesByDateRange: OverviewKpiSeriesByDateRange = {
    [rangeId]: data.kpiSeries ?? { visitors: data.series },
  }

  const kpiByStateByDateRange = {
    [rangeId]: data.kpiByState ?? [],
  }

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
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
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
    kpiByStateByDateRange,
  }
}

export function buildEmptyOverviewForRange(
  landingPagePublicId: string,
  formType: OverviewLandingFormType,
  rangeId: RangeId,
  customRange?: DashboardCustomRange
): OverviewDashboardData {
  const base = getOverviewPlaceholderData(landingPagePublicId, formType)
  const zeroSeries = overviewChartPointsForRange(
    rangeId,
    new Date(),
    customRange
  )
  const kpiSeries = Object.fromEntries(
    overviewKpiMetricOrder(formType).map((metricId: OverviewKpiMetricId) => [
      metricId,
      zeroSeries,
    ])
  ) as Record<OverviewKpiMetricId, typeof zeroSeries>

  return {
    ...base,
    defaultDateRangeId: rangeId,
    kpisByDateRange: {
      [rangeId]: {
        visitors: "0",
        sessions: "0",
        "page-views": "0",
        "form-submitted": "0",
        fsr: "0.0%",
        "bounce-rate": "0.0%",
      },
    },
    kpiSeriesByDateRange: {
      [rangeId]: kpiSeries,
    },
    kpiByStateByDateRange: {
      [rangeId]: [],
    },
  }
}

// ── loader ────────────────────────────────────────────────────────────────────

export async function loadOverviewDashboardData(
  landingPagePublicId: string,
  rangeId: RangeId = DEFAULT_TRAFFIC_RANGE_ID,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<OverviewDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()
  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

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
    url.searchParams.set("range_id", rangeId)
    appendDashboardCustomRangeParams(url, rangeId, customRange)
    appendDashboardUtmParams(url, scopedUtmFilter)

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
      return buildEmptyOverviewForRange(
        landingPagePublicId,
        formType,
        rangeId,
        customRange
      )
    }

    const data = (await overviewResp.json()) as AnalyticsOverview
    return buildOverviewFromAnalytics(data, formType, data.rangeId ?? rangeId)
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[overview] analytics fetch failed", err)
    }
    return buildEmptyOverviewForRange(
      landingPagePublicId,
      formType,
      rangeId,
      customRange
    )
  } finally {
    clearTimeout(timer)
  }
}

export async function loadOverviewDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: OverviewDashboardData }
  | { ok: false; status: number; error: string }
> {
  const rangeId = parseTrafficRangeId(rangeIdRaw)

  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const data = await loadOverviewDashboardData(
    landingPagePublicId,
    rangeId,
    scopedUtmFilter,
    customRange
  )
  return { ok: true, data }
}

export async function loadOverviewCityMetricsForApi(
  landingPagePublicId: string,
  stateRaw: string | null | undefined,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: { state: string; cities: OverviewCityMetric[] } }
  | { ok: false; status: number; error: string }
> {
  const state = stateRaw?.trim() ?? ""
  if (!state) {
    return { ok: false, status: 400, error: "state is required" }
  }

  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const formType = parseOverviewLandingFormType(row.formType)
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: true, data: { state, cities: [] } }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/overview/cities`)
    url.searchParams.set("workspace_id", row.id)
    url.searchParams.set("state", state)
    url.searchParams.set("form_type", formType)
    url.searchParams.set("range_id", rangeId)
    appendDashboardCustomRangeParams(url, rangeId, customRange)
    appendDashboardUtmParams(url, scopedUtmFilter)

    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      const body = await resp.text().catch(() => "")
      console.error(
        `[overview] cities API ${resp.status} for ${state}`,
        body.slice(0, 200)
      )
      return {
        ok: false,
        status: 502,
        error: "Failed to load city metrics",
      }
    }

    const data = (await resp.json()) as {
      state: string
      cities: OverviewCityMetric[]
    }
    return {
      ok: true,
      data: {
        state: data.state || state,
        cities: Array.isArray(data.cities)
          ? data.cities.map((row) => ({
              ...row,
              zipCount: Number(row.zipCount ?? 0) || 0,
              zipcodes: Array.isArray(row.zipcodes) ? row.zipcodes : [],
            }))
          : [],
      },
    }
  } catch (err) {
    console.error(`[overview] cities fetch failed for ${state}`, err)
    return { ok: false, status: 504, error: "City metrics request failed" }
  } finally {
    clearTimeout(timer)
  }
}

export async function loadOverviewZipcodeMetricsForApi(
  landingPagePublicId: string,
  stateRaw: string | null | undefined,
  cityRaw: string | null | undefined,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<
  | {
      ok: true
      data: { state: string; city: string; zipcodes: OverviewZipcodeMetric[] }
    }
  | { ok: false; status: number; error: string }
> {
  const state = stateRaw?.trim() ?? ""
  const city = cityRaw?.trim() ?? ""
  if (!state) {
    return { ok: false, status: 400, error: "state is required" }
  }
  if (!city) {
    return { ok: false, status: 400, error: "city is required" }
  }

  const rangeId = parseTrafficRangeId(rangeIdRaw)
  const actor = await requireLandingPageActor()
  if (!actor) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  const scopedUtmFilter = await resolveUtmFilterForActor(
    actor,
    landingPagePublicId,
    utmFilter
  )

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const formType = parseOverviewLandingFormType(row.formType)
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()
  if (!apiBase || !secret) {
    return { ok: true, data: { state, city, zipcodes: [] } }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/overview/zipcodes`)
    url.searchParams.set("workspace_id", row.id)
    url.searchParams.set("state", state)
    url.searchParams.set("city", city)
    url.searchParams.set("form_type", formType)
    url.searchParams.set("range_id", rangeId)
    appendDashboardCustomRangeParams(url, rangeId, customRange)
    appendDashboardUtmParams(url, scopedUtmFilter)

    const resp = await fetch(url.toString(), {
      headers: { "x-arohaa-internal": secret },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!resp.ok) {
      return { ok: true, data: { state, city, zipcodes: [] } }
    }

    const data = (await resp.json()) as {
      state: string
      city: string
      zipcodes: OverviewZipcodeMetric[]
    }
    return {
      ok: true,
      data: {
        state: data.state || state,
        city: data.city || city,
        zipcodes: Array.isArray(data.zipcodes) ? data.zipcodes : [],
      },
    }
  } catch {
    return { ok: true, data: { state, city, zipcodes: [] } }
  } finally {
    clearTimeout(timer)
  }
}
