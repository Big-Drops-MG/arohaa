import { notFound } from "next/navigation"
import { getExperimentsEmptyDashboardData } from "@/features/experiments/controller/experiments-empty-data"
import type { ExperimentsDashboardData } from "@/features/experiments/model/experiments"
import {
  experimentVariantPerformanceRateLabel,
  experimentVariantPerformanceSubmitLabel,
} from "@/features/experiments/utils/experiment-table-columns"
import { parseOverviewLandingFormType } from "@/features/overview/model/overview"
import type { RangeId } from "@/lib/server/analytics-types"
import {
  resolveIngestApiBase,
  resolveInternalApiSecret,
} from "@/lib/server/analytics-env"
import { requireLandingPageActor } from "@/lib/server/landing-auth"
import { getActiveLandingPageByPublicId } from "@/lib/server/landing-pages-store"

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

interface AnalyticsExperiments {
  experiments: AnalyticsExperimentRow[]
  variantPerformance: AnalyticsVariantPerformanceRow[]
  performanceByLocation: AnalyticsLocationPerformanceRow[]
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

export function buildExperimentsDashboardData(
  data: AnalyticsExperiments,
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  rangeId: RangeId
): ExperimentsDashboardData {
  const { experiments, variantPerformance, performanceByLocation } = data

  const variants = variantPerformance.map((v) => v.variant)
  const rateLabel = experimentVariantPerformanceRateLabel(formType)
  const locationColumns = [
    { key: "city", label: "City" },
    ...variants.map((v) => ({
      key: `variant${v}`,
      label: `Variant ${v} ${rateLabel}`,
    })),
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
    defaultDateRangeId: rangeId as any,
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
        { key: "fsr", label: experimentVariantPerformanceRateLabel(formType) },
      ],
      rows: variantPerformance.map((row) => ({
        variant: row.variant,
        visitors: fmtCount(row.visitors),
        formSubmitted: fmtCount(row.formSubmitted),
        fsr: fmtPct(row.fsr),
      })),
    },
    performanceByLocation: {
      title: "Performance by location",
      columns: locationColumns,
      rows: performanceByLocation.map((row) => {
        const result: Record<string, string> = { city: row.city }
        for (const variant of variants) {
          result[`variant${variant}`] = String(row[`variant${variant}`] || "0%")
        }
        return result
      }),
    },
  }
}

export async function fetchExperimentsAnalytics(
  workspaceId: string,
  landingPagePublicId: string,
  rangeId: RangeId
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
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[experiments] analytics fetch failed", err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadExperimentsDashboardData({
  landingPagePublicId,
  rangeId = "7d",
}: {
  landingPagePublicId: string
  rangeId?: RangeId
}): Promise<ExperimentsDashboardData> {
  const actor = await requireLandingPageActor()
  if (!actor) notFound()

  const row = await getActiveLandingPageByPublicId(landingPagePublicId)
  if (!row) notFound()

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchExperimentsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId
  )
  if (!analytics) {
    return getExperimentsEmptyDashboardData(
      landingPagePublicId,
      rangeId as any,
      formType
    )
  }

  return buildExperimentsDashboardData(analytics, formType, rangeId)
}

export async function loadExperimentsDashboardDataForApi(
  landingPagePublicId: string,
  rangeIdRaw: string | null | undefined
): Promise<
  | { ok: true; data: ExperimentsDashboardData }
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

  const formType = parseOverviewLandingFormType(row.formType)

  const analytics = await fetchExperimentsAnalytics(
    row.id,
    landingPagePublicId,
    rangeId
  )
  if (!analytics) {
    return {
      ok: true,
      data: getExperimentsEmptyDashboardData(
        landingPagePublicId,
        rangeId as any,
        formType
      ),
    }
  }

  return {
    ok: true,
    data: buildExperimentsDashboardData(analytics, formType, rangeId),
  }
}
