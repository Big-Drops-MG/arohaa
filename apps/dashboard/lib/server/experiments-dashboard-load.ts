import { notFound } from "next/navigation"
import { getExperimentsEmptyDashboardData } from "@/features/experiments/controller/experiments-empty-data"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import {
  experimentVariantPerformanceRateLabel,
  experimentVariantPerformanceSubmitLabel,
} from "@/features/experiments/utils/experiment-table-columns"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
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

interface AnalyticsExperimentRow {
  id: string
  name: string
  status: string
  variants: string
  startDate: string
  highlighted?: boolean
}

interface AnalyticsVariantPerformanceRow {
  variant: string
  visitors: number
  formSubmitted: number
  fsr: number
}

interface AnalyticsLocationPerformanceRow {
  city: string
  [variantKey: string]: string | number
}

interface AnalyticsStatePerformanceRow {
  state: string
  [variantKey: string]: string | number
}

interface AnalyticsZipcodePerformanceRow {
  zipcode: string
  [variantKey: string]: string | number
}

interface AnalyticsExperiments {
  experiments: AnalyticsExperimentRow[]
  variantPerformance: AnalyticsVariantPerformanceRow[]
  performanceByLocation: AnalyticsLocationPerformanceRow[]
  performanceByState: AnalyticsStatePerformanceRow[]
  performanceByZipcode: AnalyticsZipcodePerformanceRow[]
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

function buildDimensionPerformanceSection(
  title: string,
  dimensionKey: "city" | "state" | "zipcode",
  dimensionLabel: string,
  rows: Array<Record<string, string | number>>,
  variants: string[],
  rateLabel: string
): ExperimentsDashboardData["performanceByLocation"] {
  const columns = [
    { key: dimensionKey, label: dimensionLabel },
    ...variants.map((v) => ({
      key: `variant${v}`,
      label: `Variant ${v} ${rateLabel}`,
    })),
  ]

  return {
    title,
    columns,
    rows: rows.map((row) => {
      const result: Record<string, string> = {
        [dimensionKey]: String(row[dimensionKey] ?? "Unknown"),
      }
      for (const variant of variants) {
        result[`variant${variant}`] = String(row[`variant${variant}`] || "0%")
      }
      return result
    }),
  }
}

export function buildExperimentsDashboardData(
  data: AnalyticsExperiments,
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  rangeId: RangeId
): ExperimentsDashboardData {
  const {
    experiments,
    variantPerformance,
    performanceByLocation,
    performanceByState,
    performanceByZipcode,
  } = data

  const variants = variantPerformance.map((v) => v.variant)
  const rateLabel = experimentVariantPerformanceRateLabel(formType)

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    experiments,
    variantPerformance: {
      title: "Variant performance",
      columns: [
        { key: "variant", label: "Variant" },
        { key: "visitors", label: "Visitors" },
        {
          key: "formSubmitted",
          label: experimentVariantPerformanceSubmitLabel(formType),
        },
        { key: "fsr", label: rateLabel },
      ],
      rows: variantPerformance.map((row) => ({
        variant: row.variant,
        visitors: fmtCount(row.visitors),
        formSubmitted: fmtCount(row.formSubmitted),
        fsr: fmtPct(row.fsr),
      })),
    },
    performanceByLocation: buildDimensionPerformanceSection(
      "Performance by location",
      "city",
      "City",
      performanceByLocation,
      variants,
      rateLabel
    ),
    performanceByState: buildDimensionPerformanceSection(
      "Performance by state",
      "state",
      "State",
      performanceByState,
      variants,
      rateLabel
    ),
    performanceByZipcode: buildDimensionPerformanceSection(
      "Performance by zipcode",
      "zipcode",
      "Zipcode",
      performanceByZipcode,
      variants,
      rateLabel
    ),
  }
}

export async function fetchExperimentsAnalytics(
  workspaceId: string,
  landingPagePublicId: string,
  rangeId: RangeId,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<AnalyticsExperiments | null> {
  const apiBase = resolveIngestApiBase()
  const secret = resolveInternalApiSecret()

  if (!apiBase || !secret) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL(`${apiBase}/v1/analytics/experiments`)
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
          `[experiments] analytics API ${resp.status} ${url.pathname}`,
          body.slice(0, 200)
        )
      }
      return null
    }

    return (await resp.json()) as AnalyticsExperiments
  } catch (err: any) {
    if (err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[experiments] analytics fetch timed out")
      }
      return null
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[experiments] analytics fetch failed", err?.message || err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadExperimentsDashboardData({
  landingPagePublicId,
  rangeId = DEFAULT_TRAFFIC_RANGE_ID,
  utmFilter,
  customRange,
}: {
  landingPagePublicId: string
  rangeId?: RangeId
  utmFilter?: DashboardUtmFilter
  customRange?: DashboardCustomRange
}): Promise<ExperimentsDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageForActor(actor.id, landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchExperimentsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId,
    utmFilter,
    customRange
  )
  if (!analytics) {
    return getExperimentsEmptyDashboardData(
      landingPagePublicId,
      rangeId,
      formType
    )
  }

  return buildExperimentsDashboardData(analytics, formType, rangeId)
}

export async function loadExperimentsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined,
  utmFilter?: DashboardUtmFilter,
  customRange?: DashboardCustomRange
): Promise<
  | { ok: true; data: ExperimentsDashboardData }
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

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchExperimentsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId,
    utmFilter,
    customRange
  )
  if (!analytics) {
    return {
      ok: true,
      data: getExperimentsEmptyDashboardData(
        landingPagePublicId,
        rangeId,
        formType
      ),
    }
  }

  return {
    ok: true,
    data: buildExperimentsDashboardData(analytics, formType, rangeId),
  }
}
