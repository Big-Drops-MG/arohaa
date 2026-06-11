import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type EventTrackingKpi = {
  label: string
  value: string
}

export type EventTrackingSubmissionRow = {
  date: string
  formSubmitted: string
  fsr: string
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
