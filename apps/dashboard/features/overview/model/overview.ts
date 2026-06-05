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

export type OverviewDateRangeId = "24h" | "7d" | "30d" | "3m" | "12m" | "24m"

export type OverviewLandingFormType = "zip" | "single" | "multiple"

export function parseOverviewLandingFormType(
  raw: string | null | undefined
): OverviewLandingFormType {
  if (raw === "zip" || raw === "single" || raw === "multiple") return raw
  return "single"
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

export function overviewKpiLabelsForFormType(
  formType: OverviewLandingFormType
): Record<OverviewKpiMetricId, string> {
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

export type OverviewKpi = {
  id: OverviewKpiMetricId
  label: string
  value: string
}

export type OverviewKpiValuesByMetric = Partial<
  Record<OverviewKpiMetricId, string>
>

export type OverviewKpiValuesByDateRange = Record<
  OverviewDateRangeId,
  OverviewKpiValuesByMetric
>

export type OverviewTimeSeriesPoint = {
  label: string
  value: number
}

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
}
