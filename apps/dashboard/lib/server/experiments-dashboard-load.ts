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
import { getExperimentConfigForLandingPage } from "@/lib/server/experiments-store"

interface AnalyticsVariantPerformanceRow {
  variant: string
  visitors: number
  formSubmitted: number
  fsr: number
  isControl?: boolean
  visitorsLiftAbs?: number | null
  visitorsLiftPct?: number | null
  formSubmittedLiftAbs?: number | null
  formSubmittedLiftPct?: number | null
  fsrLiftAbs?: number | null
  fsrLiftPct?: number | null
}

interface AnalyticsExperiments {
  experiments: Array<{
    id: string
    name: string
    status: string
    variants: string
    startDate: string
    endDate?: string | null
    noEndDate?: boolean
    highlighted?: boolean
  }>
  variantPerformance: AnalyticsVariantPerformanceRow[]
  performanceByLocation: Array<Record<string, string | number>>
  performanceByState: Array<Record<string, string | number>>
  performanceByZipcode: Array<Record<string, string | number>>
  controlVariant?: string | null
  mode?: "multi_domain" | "data_variant"
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

function fmtLiftAbs(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  const sign = v > 0 ? "+" : ""
  return `${sign}${fmtCount(v)}`
}

function fmtLiftPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—"
  const sign = v > 0 ? "+" : ""
  return `${sign}${safeNum(v).toFixed(1)}%`
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

function buildWinnerCallout(
  rows: AnalyticsVariantPerformanceRow[],
  controlVariant: string | null
): string | null {
  if (rows.length === 0) return null

  if (controlVariant) {
    let best: AnalyticsVariantPerformanceRow | null = null
    for (const row of rows) {
      if (row.variant === controlVariant) continue
      if (row.fsrLiftAbs == null) continue
      if (
        !best ||
        (row.fsrLiftAbs ?? -Infinity) > (best.fsrLiftAbs ?? -Infinity)
      ) {
        best = row
      }
    }
    if (best && (best.fsrLiftAbs ?? 0) > 0) {
      return `${best.variant} leads vs ${controlVariant} by ${fmtLiftPct(best.fsrLiftAbs)} FSR points (${fmtLiftPct(best.fsrLiftPct)} relative)`
    }
    return `Control ${controlVariant} is ahead or tied on FSR`
  }

  let best = rows[0]!
  for (const row of rows) {
    if (row.fsr > best.fsr) best = row
  }
  return `${best.variant} leads with ${fmtPct(best.fsr)} FSR`
}

export function buildExperimentsDashboardData(
  data: AnalyticsExperiments,
  formType: ReturnType<typeof parseOverviewLandingFormType>,
  rangeId: RangeId,
  config: ExperimentsDashboardData["config"],
  siblings: ExperimentsDashboardData["siblings"]
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
  const controlVariant = data.controlVariant ?? null
  const showLift = Boolean(controlVariant)

  const columns = [
    { key: "variant", label: "Variant" },
    { key: "visitors", label: "Visitors" },
    {
      key: "formSubmitted",
      label: experimentVariantPerformanceSubmitLabel(formType),
    },
    { key: "fsr", label: rateLabel },
  ]
  if (showLift) {
    columns.push(
      { key: "fsrLift", label: `${rateLabel} lift` },
      { key: "visitorsLift", label: "Visitors lift" }
    )
  }

  return {
    formType,
    dateRangeOptions: TRAFFIC_DATE_RANGE_OPTIONS,
    defaultDateRangeId: rangeId,
    experiments,
    variantPerformance: {
      title: "Variant performance",
      columns,
      rows: variantPerformance.map((row) => {
        const base: Record<string, string> = {
          variant: row.variant,
          visitors: fmtCount(row.visitors),
          formSubmitted: fmtCount(row.formSubmitted),
          fsr: fmtPct(row.fsr),
        }
        if (showLift) {
          base.fsrLift = row.isControl ? "Control" : fmtLiftAbs(row.fsrLiftAbs)
          base.visitorsLift = row.isControl
            ? "Control"
            : fmtLiftPct(row.visitorsLiftPct)
        }
        return base
      }),
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
    controlVariant,
    mode: data.mode ?? "data_variant",
    winnerCallout: buildWinnerCallout(variantPerformance, controlVariant),
    config,
    siblings,
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
  } catch (err: unknown) {
    const name =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : ""
    if (name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.warn("[experiments] analytics fetch timed out")
      }
      return null
    }
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
  const configBundle = await getExperimentConfigForLandingPage(row)

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
      formType,
      configBundle.experiment,
      configBundle.siblings
    )
  }

  return buildExperimentsDashboardData(
    analytics,
    formType,
    rangeId,
    configBundle.experiment,
    configBundle.siblings
  )
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
  const configBundle = await getExperimentConfigForLandingPage(row)

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
        formType,
        configBundle.experiment,
        configBundle.siblings
      ),
    }
  }

  return {
    ok: true,
    data: buildExperimentsDashboardData(
      analytics,
      formType,
      rangeId,
      configBundle.experiment,
      configBundle.siblings
    ),
  }
}
