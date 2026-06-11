import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type SegmentMetricId =
  | "top-region"
  | "top-device"
  | "best-day"
  | "best-time"
  | "highest-fsr"

export const SEGMENT_METRIC_ORDER: readonly SegmentMetricId[] = [
  "top-region",
  "top-device",
  "best-day",
  "best-time",
  "highest-fsr",
]

export type SegmentValuesByMetric = Partial<Record<SegmentMetricId, string>>

export type SegmentsByDateRange = Record<
  OverviewDateRangeId,
  SegmentValuesByMetric
>

export type SegmentKpi = {
  id: SegmentMetricId
  label: string
  value: string
}

export type SegmentsSummaryKpi = {
  label: string
  value: string
}

export type SegmentsTableColumn = {
  key: string
  label: string
}

export type SegmentsTableRow = Record<string, string>

export type SegmentsTableSection = {
  title: string
  columns: SegmentsTableColumn[]
  rows: SegmentsTableRow[]
}

export type SegmentsDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  summaryKpis: SegmentsSummaryKpi[]
  performanceByLocation: SegmentsTableSection
  performanceByDevice: SegmentsTableSection
  performanceByTime: SegmentsTableSection
}
