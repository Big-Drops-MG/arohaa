import { getEventTrackingEmptyDashboardData } from "@/features/event-tracking/controller/event-tracking-empty-data"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import type { EventTrackingKpiSegment } from "@/features/event-tracking/model/event-tracking"
import { eventTrackingKpisForFormType } from "@/features/event-tracking/utils/event-tracking-kpis-for-form-type"
import { eventTrackingKpiSegmentOrder } from "@/features/event-tracking/utils/event-tracking-segment-labels"
import { withSubmissionShare } from "@/features/event-tracking/utils/event-tracking-submission-share"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import type { DashboardUtmFilter } from "@/features/dashboard/model/utm-attribution-filter"
import { appendDashboardUtmParams } from "@/lib/server/analytics-utm-params"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageForActor } from "@/lib/server/landing-pages-store"
import { notFound } from "next/navigation"

interface AnalyticsEventsKpis {
  totalEvents: number
  zipSubmit?: number
  callClicks?: number
  formStarted?: number
  formSubmitted?: number
  fsr?: number
  zsr?: number
}

interface AnalyticsEventsSubmissionRow {
  date: string
  zipSubmitted?: number
  formSubmitted?: number
  fsr?: number
  zsr?: number
}

interface AnalyticsEvents {
  kpis: AnalyticsEventsKpis
  submissionRows: AnalyticsEventsSubmissionRow[]
}

function safeNum(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0
}

function fmtPct(value: number | undefined): string {
  return `${safeNum(value).toFixed(1)}%`
}

function fmtCount(v: number | undefined): string {
  const n = safeNum(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1_000) return n.toLocaleString("en-US")
  return String(n)
}

function buildKpiSegments(
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  kpis: AnalyticsEventsKpis
): EventTrackingKpiSegment[] {
  const order = eventTrackingKpiSegmentOrder(formType)

  return order.map((id) => {
    if (id === "call-clicks") {
      return { id, value: safeNum(kpis.callClicks) }
    }
    if (id === "form-start") {
      return { id, value: safeNum(kpis.formStarted) }
    }
    if (formType === "zip") {
      return { id, value: safeNum(kpis.zipSubmit) }
    }
    return { id, value: safeNum(kpis.formSubmitted) }
  })
}

export function buildEventTrackingDashboardData(
  data: AnalyticsEvents,
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  rangeId: RangeId
): EventTrackingDashboardData {
  const { kpis } = data
  const kpiSource = {
    totalEvents: safeNum(kpis.totalEvents),
    callClicks: safeNum(kpis.callClicks),
    formStarted: safeNum(kpis.formStarted),
    zipSubmit: safeNum(kpis.zipSubmit),
    formSubmitted: safeNum(kpis.formSubmitted),
    fsr: safeNum(kpis.fsr),
    zsr: safeNum(kpis.zsr),
  }
  const kpiList = eventTrackingKpisForFormType(formType, kpiSource)

  const submissionRows = withSubmissionShare(
    (data.submissionRows ?? []).map((row) => ({
      date: row.date,
      formSubmitted: fmtCount(
        formType === "zip" ? row.zipSubmitted : row.formSubmitted
      ),
      fsr: fmtPct(formType === "zip" ? row.zsr : row.fsr),
    }))
  )

  const kpiSegments = buildKpiSegments(formType, kpis)

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
    kpis: kpiList,
    submissionRows,
    kpiSegments,
    pieSegments: [],
  }
}

export async function fetchEventTrackingAnalytics(
  workspaceId: string,
  rangeId: RangeId,
  utmFilter?: DashboardUtmFilter
): Promise<AnalyticsEvents | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/events`)
    url.searchParams.set("workspace_id", workspaceId)
    url.searchParams.set("range_id", rangeId)
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
          `[events] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsEvents
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[events] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[events] analytics fetch failed", err?.message || err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadEventTrackingDashboardData({
  landingPagePublicId,
  rangeId = "7d",
  utmFilter,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  utmFilter?: DashboardUtmFilter
}): Promise<EventTrackingDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchEventTrackingAnalytics(
    row.id,
    rangeId,
    utmFilter
  )
  if (!analytics) {
    return getEventTrackingEmptyDashboardData(
      landingPagePublicId,
      rangeId,
      formType
    )
  }

  return buildEventTrackingDashboardData(analytics, formType, rangeId)
}

export async function loadEventTrackingDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter
): Promise<
  | { ok: true; data: EventTrackingDashboardData }
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

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchEventTrackingAnalytics(
    row.id,
    rangeId,
    utmFilter
  )
  if (!analytics) {
    return {
      ok: true,
      data: getEventTrackingEmptyDashboardData(
        landingPagePublicId,
        rangeId,
        formType
      ),
    }
  }

  return {
    ok: true,
    data: buildEventTrackingDashboardData(analytics, formType, rangeId),
  }
}
