import type { OverviewDateRangeId } from "@/features/overview/model/overview"

export type EventTrackingMetricId =
  | "total-events"
  | "call-clicks"
  | "form-submitted"
  | "success-rate"

export const EVENT_TRACKING_METRIC_ORDER: readonly EventTrackingMetricId[] = [
  "total-events",
  "call-clicks",
  "form-submitted",
  "success-rate",
]

export type EventTrackingKpi = {
  id: EventTrackingMetricId
  label: string
  value: string
}

export type EventTrackingValuesByMetric = Partial<
  Record<EventTrackingMetricId, string>
>

export type EventTrackingByDateRange = Record<
  OverviewDateRangeId,
  EventTrackingValuesByMetric
>

export type EventTrackingSubmissionRow = {
  date: string
  formSubmitted: string
  /** Computed share of period total; set by withSubmissionShare. */
  share?: string
}

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
