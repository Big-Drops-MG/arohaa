import { notFound } from "next/navigation"
import { getEventTrackingEmptyDashboardData } from "@/features/event-tracking/controller/event-tracking-empty-data"
import type { EventTrackingDashboardData } from "@/features/event-tracking/model/event-tracking"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

// Duplicating type definition to avoid importing from api directly into dashboard
interface AnalyticsEventsKpis {
  totalEvents: number
  zipSubmit: number
  callClicks: number
  formSubmitted: number
  fsr: number
}

interface AnalyticsEventsSubmissionRow {
  date: string
  formSubmitted: number
  fsr: number
}

interface AnalyticsEventsPieSegment {
  name: string
  value: number
}

interface AnalyticsEvents {
  kpis: AnalyticsEventsKpis
  submissionRows: AnalyticsEventsSubmissionRow[]
  pieSegments: AnalyticsEventsPieSegment[]
}

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

export function buildEventTrackingDashboardData(
  data: AnalyticsEvents,
  rangeId: RangeId
): EventTrackingDashboardData {
  const { kpis } = data

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
    kpis: [
      { label: "Total Events", value: fmtCount(kpis.totalEvents) },
      { label: "ZIP Submit", value: fmtCount(kpis.zipSubmit) },
      { label: "Call Clicks", value: fmtCount(kpis.callClicks) },
      { label: "Form Submitted", value: fmtCount(kpis.formSubmitted) },
      { label: "FSR", value: fmtPct(kpis.fsr) },
    ],
    submissionRows: data.submissionRows.map((row) => ({
      date: row.date,
      formSubmitted: fmtCount(row.formSubmitted),
      fsr: fmtPct(row.fsr),
    })),
    pieSegments: data.pieSegments
      .map((s) => ({
        name: s.name,
        value: s.value,
        color:
          s.name === "ZIP Submit"
            ? "#111827"
            : s.name === "Call Clicks"
              ? "#6B7280"
              : "#D1D5DB",
      }))
      .filter((s) => s.value > 0),
  }
}

export async function fetchEventTrackingAnalytics(
  workspaceId: string,
  rangeId: RangeId
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
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[events] analytics fetch failed", err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadEventTrackingDashboardData({
  landingPagePublicId,
  rangeId = "7d",
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<EventTrackingDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchEventTrackingAnalytics(row.id, rangeId)
  if (!analytics) {
    return getEventTrackingEmptyDashboardData(
      landingPagePublicId,
      rangeId as any
    )
  }

  return buildEventTrackingDashboardData(analytics, rangeId)
}

export async function loadEventTrackingDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
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

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }

  const analytics = await fetchEventTrackingAnalytics(row.id, rangeId)
  if (!analytics) {
    return {
      ok: true,
      data: getEventTrackingEmptyDashboardData(
        landingPagePublicId,
        rangeId as any
      ),
    }
  }

  return { ok: true, data: buildEventTrackingDashboardData(analytics, rangeId) }
}
