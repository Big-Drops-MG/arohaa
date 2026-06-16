import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"

export type EventTrackingMetricId =
  | "total-events"
  | "call-clicks"
  | "form-started"
  | "form-submitted"
  | "success-rate"

export const EVENT_TRACKING_ZIP_METRIC_ORDER: readonly EventTrackingMetricId[] =
  ["total-events", "call-clicks", "form-submitted", "success-rate"]

export const EVENT_TRACKING_FORM_METRIC_ORDER: readonly EventTrackingMetricId[] =
  [
    "total-events",
    "call-clicks",
    "form-started",
    "form-submitted",
    "success-rate",
  ]

export function eventTrackingMetricOrder(
  formType: OverviewLandingFormType
): readonly EventTrackingMetricId[] {
  return formType === "zip"
    ? EVENT_TRACKING_ZIP_METRIC_ORDER
    : EVENT_TRACKING_FORM_METRIC_ORDER
}

/** @deprecated Use eventTrackingMetricOrder(formType) instead */
export const EVENT_TRACKING_METRIC_ORDER: readonly EventTrackingMetricId[] =
  EVENT_TRACKING_FORM_METRIC_ORDER

export type EventTrackingKpi = {
  id: EventTrackingMetricId
  label: string
  value: string
}

export type EventTrackingSubmissionRow = {
  date: string
  formSubmitted: string
  fsr: string
  share?: string
}

export type EventTrackingPieSegment = {
  name: string
  value: number
  color: string
}

export type EventTrackingDashboardData = {
  formType: OverviewLandingFormType
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  kpis: EventTrackingKpi[]
  submissionRows: EventTrackingSubmissionRow[]
  kpiSegments: EventTrackingKpiSegment[]
  /** @deprecated Use kpiSegments */
  pieSegments: EventTrackingPieSegment[]
}

export type EventTrackingValuesByMetric = Partial<
  Record<EventTrackingMetricId | "fsr" | "zsr", string>
>

export type EventTrackingByDateRange = Record<
  OverviewDateRangeId,
  EventTrackingValuesByMetric
>

export type EventTrackingSubmissionByDateRange = Record<
  OverviewDateRangeId,
  EventTrackingSubmissionRow[]
>

export type EventTrackingKpiSegmentId =
  | "form-submitted"
  | "call-clicks"
  | "zip-submit"
  | "form-start"

export type EventTrackingKpiSegment = {
  id: EventTrackingKpiSegmentId
  value: number
}

export type EventTrackingKpiSegmentsByDateRange = Record<
  OverviewDateRangeId,
  EventTrackingKpiSegment[]
>
