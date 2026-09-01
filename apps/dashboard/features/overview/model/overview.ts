import type {
  FunnelFieldDropOff,
  FunnelStep,
} from "@/features/funnel/model/funnel"
import type {
  EventTrackingByDateRange,
  EventTrackingKpiSegmentsByDateRange,
  EventTrackingSubmissionByDateRange,
} from "@/features/event-tracking/model/event-tracking"
import type { AlertsByDateRange } from "@/features/alerts/model/alerts"
import type { ExperimentsByDateRange } from "@/features/experiments/model/experiments"
import type { SegmentsByDateRange } from "@/features/segments/model/segments"
import type { SegmentsPerformanceByDateRange } from "@/features/segments/model/segments-performance"
import type { TrafficTablesByDateRange } from "@/features/traffic/model/traffic"

export type OverviewDateRangeId =
  | "today"
  | "yesterday"
  | "this_week"
  | "7d"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom"

export type OverviewLandingFormType = "zip" | "single" | "multiple" | "none"

export const LANDING_FORM_TYPE_OPTIONS = [
  { value: "single" as const, label: "Single Step" },
  { value: "multiple" as const, label: "Multi Step" },
  { value: "zip" as const, label: "Zip" },
  { value: "none" as const, label: "None (Hub)" },
] as const

export function parseOverviewLandingFormType(
  raw: string | null | undefined
): OverviewLandingFormType {
  if (
    raw === "zip" ||
    raw === "single" ||
    raw === "multiple" ||
    raw === "none"
  ) {
    return raw
  }
  return "single"
}

/** Whether this form type tracks form/zip submissions (not hub service clicks). */
export function hasFormSubmissionMetrics(
  formType: OverviewLandingFormType
): boolean {
  return formType !== "none"
}

/** Hub pages convert via service/vertical clicks instead of forms. */
export function hasServiceClickMetrics(
  formType: OverviewLandingFormType
): boolean {
  return formType === "none"
}

/** Form submits, zip submits, or service clicks — all conversion metrics. */
export function hasConversionMetrics(
  formType: OverviewLandingFormType
): boolean {
  return hasFormSubmissionMetrics(formType) || hasServiceClickMetrics(formType)
}

export type OverviewDateRangeOption = {
  id: OverviewDateRangeId
  label: string
}

export type OverviewKpiMetricId =
  | "visitors"
  | "sessions"
  | "page-views"
  | "form-submitted"
  | "fsr"
  | "bounce-rate"

export const OVERVIEW_KPI_METRIC_ORDER: readonly OverviewKpiMetricId[] = [
  "visitors",
  "sessions",
  "page-views",
  "form-submitted",
  "fsr",
  "bounce-rate",
]

export function overviewKpiMetricOrder(
  _formType: OverviewLandingFormType
): readonly OverviewKpiMetricId[] {
  return OVERVIEW_KPI_METRIC_ORDER
}

export function overviewKpiLabelsForFormType(
  formType: OverviewLandingFormType
): Record<OverviewKpiMetricId, string> {
  if (formType === "none") {
    return {
      visitors: "Visitors",
      sessions: "Sessions",
      "page-views": "Page Views",
      "form-submitted": "Service Clicks",
      fsr: "SCR (Service Click Rate)",
      "bounce-rate": "Bounce Rate",
    }
  }
  const isZip = formType === "zip"
  return {
    visitors: "Visitors",
    sessions: "Sessions",
    "page-views": "Page Views",
    "form-submitted": isZip ? "Zip Submits" : "Form Submits",
    fsr: isZip ? "ZSR (Zip Success Rate)" : "FSR (Form Success Rate)",
    "bounce-rate": "Bounce Rate",
  }
}

export function conversionSubmitLabel(
  formType: OverviewLandingFormType
): string {
  if (formType === "none") return "Service Clicks"
  if (formType === "zip") return "Zip Submits"
  return "Form Submits"
}

export function conversionRateLabel(formType: OverviewLandingFormType): string {
  if (formType === "none") return "SCR"
  if (formType === "zip") return "ZSR"
  return "FSR"
}

export function conversionSubmittedColumnLabel(
  formType: OverviewLandingFormType
): string {
  if (formType === "none") return "Service Clicked"
  if (formType === "zip") return "Zip Submitted"
  return "Form Submitted"
}

export type OverviewKpi = {
  id: OverviewKpiMetricId
  label: string
  value: string
}

export type OverviewKpiValuesByMetric = Partial<
  Record<OverviewKpiMetricId, string>
>

export type OverviewKpiValuesByDateRange = Partial<
  Record<OverviewDateRangeId, OverviewKpiValuesByMetric>
>

export type OverviewFunnelChangeVariant = "positive" | "negative" | "neutral"

export type OverviewFunnelStep = {
  label: string
  value: string
  change?: string
  changeVariant?: OverviewFunnelChangeVariant
}

export type OverviewTimeSeriesPoint = {
  label: string
  value: number
}

/** US state KPI values for the overview performance map. */
export type OverviewStateMetric = {
  state: string
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

/** City KPI values within a selected US state (map drill-down). */
export type OverviewCityMetric = {
  city: string
  state: string
  latitude?: number
  longitude?: number
  /** Distinct zipcodes with events in this city (GeoIP postal + form-submitted). */
  zipCount: number
  /** Distinct zipcode values backing `zipCount`, capped by the API. */
  zipcodes: string[]
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

/** Zipcode KPI values within a selected US city (map drill-down). */
export type OverviewZipcodeMetric = {
  zipcode: string
  city: string
  state: string
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  fsr: number
  bounceRate: number
}

export type OverviewKpiByStateByDateRange = Partial<
  Record<OverviewDateRangeId, OverviewStateMetric[]>
>

export type OverviewTrafficStat = {
  label: string
  value: string
}

export type OverviewAlertSeverity = "warning" | "alert" | "error"

export type OverviewAlert = {
  id: string
  message: string
  severity: OverviewAlertSeverity
  /** Display date for the Alerts tab (e.g. "Apr 10"). */
  dateLabel?: string
}

export type OverviewKpiSeriesByDateRange = Partial<
  Record<
    OverviewDateRangeId,
    Partial<Record<OverviewKpiMetricId, OverviewTimeSeriesPoint[]>>
  >
>

/**
 * Full server payload for the project dashboard. The project page should load this
 * (e.g. from your API or database) and pass it to tab views.
 */
export type OverviewDashboardData = {
  /** From landing page `data-formtype` (`single` | `multiple` | `zip`). */
  formType: OverviewLandingFormType
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  kpisByDateRange: OverviewKpiValuesByDateRange
  defaultKpiMetricId: OverviewKpiMetricId
  funnel: FunnelStep[]
  multiStepFormTracking: FunnelStep[]
  formDropOffByField: FunnelFieldDropOff[]
  traffic: OverviewTrafficStat[]
  segments: OverviewTrafficStat[]
  alerts: OverviewAlert[]
  /** Live count for the Traffic tab (e.g. "128 Users"). */
  activeUsersNow: string
  trafficTablesByDateRange: TrafficTablesByDateRange
  eventTrackingByDateRange: EventTrackingByDateRange
  eventTrackingSubmissionByDateRange: EventTrackingSubmissionByDateRange
  eventTrackingKpiSegmentsByDateRange: EventTrackingKpiSegmentsByDateRange
  segmentsByDateRange: SegmentsByDateRange
  segmentsPerformanceByDateRange: SegmentsPerformanceByDateRange
  experimentsByDateRange: ExperimentsByDateRange
  alertsByDateRange: AlertsByDateRange
  /**
   * Optional time series for the performance chart. When provided for the
   * active date range and KPI, those points are used; otherwise the chart
   * uses client-generated x-axis buckets with zero values.
   */
  kpiSeriesByDateRange?: OverviewKpiSeriesByDateRange
  /** Optional US state breakdown for the performance map view. */
  kpiByStateByDateRange?: OverviewKpiByStateByDateRange
}
