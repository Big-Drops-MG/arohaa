import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

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
  id?: EventTrackingMetricId
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
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  kpis: EventTrackingKpi[]
  submissionRows: EventTrackingSubmissionRow[]
  pieSegments: EventTrackingPieSegment[]
}

export type EventTrackingValuesByMetric = Partial<
  Record<EventTrackingMetricId, string>
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
