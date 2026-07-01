import { notFound } from "next/navigation"
import { getSegmentsEmptyDashboardData } from "@/features/segments/controller/segments-empty-data"
import type { SegmentsDashboardData } from "@/features/segments/model/segments"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

// Duplicating type definition to avoid importing from api directly into dashboard
interface AnalyticsSegmentsSummaryKpis {
  topRegion: string
  topDevice: string
  bestDay: string
  bestTime: string
  highestFsr: number
}

interface AnalyticsSegmentsRow {
  label: string
  visitors: number
  formSubmitted: number
  fsr: number
}

interface AnalyticsSegments {
  summaryKpis: AnalyticsSegmentsSummaryKpis
  performanceByLocation: AnalyticsSegmentsRow[]
  performanceByDevice: AnalyticsSegmentsRow[]
  performanceByTime: AnalyticsSegmentsRow[]
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

export function buildSegmentsDashboardData(
  data: AnalyticsSegments,
  rangeId: RangeId
): SegmentsDashboardData {
  const {
    summaryKpis,
    performanceByLocation,
    performanceByDevice,
    performanceByTime,
  } = data

  const mapRows = (rows: AnalyticsSegmentsRow[]) =>
    rows.map((row) => ({
      label: row.label,
      visitors: fmtCount(row.visitors),
      formSubmitted: fmtCount(row.formSubmitted),
      fsr: fmtPct(row.fsr),
    }))

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
    summaryKpis: [
      { label: "Top Region", value: summaryKpis.topRegion },
      { label: "Top Device", value: summaryKpis.topDevice },
      { label: "Best Day", value: summaryKpis.bestDay },
      { label: "Best Time", value: summaryKpis.bestTime },
      { label: "Highest FSR", value: fmtPct(summaryKpis.highestFsr) },
    ],
    performanceByLocation: {
      title: "Performance by location",
      columns: [
        { key: "label", label: "City" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: mapRows(performanceByLocation),
    },
    performanceByDevice: {
      title: "Performance by device",
      columns: [
        { key: "label", label: "Device" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: mapRows(performanceByDevice),
    },
    performanceByTime: {
      title: "Performance by time",
      columns: [
        { key: "label", label: "Day" },
        { key: "visitors", label: "Visitors" },
        { key: "formSubmitted", label: "Form Submitted" },
        { key: "fsr", label: "FSR" },
      ],
      rows: mapRows(performanceByTime),
    },
  }
}

export async function fetchSegmentsAnalytics(
  workspaceId: string,
  rangeId: RangeId
): Promise<AnalyticsSegments | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/segments`)
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
          `[segments] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsSegments
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[segments] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[segments] analytics fetch failed", err?.message || err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadSegmentsDashboardData({
  landingPagePublicId,
  rangeId = "7d",
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<SegmentsDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) notFound()

  const analytics = await fetchSegmentsAnalytics(row.id, rangeId)
  if (!analytics) {
    return getSegmentsEmptyDashboardData(landingPagePublicId, rangeId as any)
  }

  return buildSegmentsDashboardData(analytics, rangeId)
}

export async function loadSegmentsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
): Promise<
  | { ok: true; data: SegmentsDashboardData }
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

  const analytics = await fetchSegmentsAnalytics(row.id, rangeId)
  if (!analytics) {
    return {
      ok: true,
      data: getSegmentsEmptyDashboardData(landingPagePublicId, rangeId as any),
    }
  }

  return { ok: true, data: buildSegmentsDashboardData(analytics, rangeId) }
}
