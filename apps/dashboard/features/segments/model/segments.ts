import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
  OverviewLandingFormType,
} from "@/features/overview/model/overview"
import { hasConversionMetrics } from "@/features/overview/model/overview"

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

export const SEGMENT_METRIC_ORDER_NONE: readonly SegmentMetricId[] = [
  "top-region",
  "top-device",
  "best-day",
  "best-time",
]

export function segmentMetricOrder(
  formType: OverviewLandingFormType
): readonly SegmentMetricId[] {
  return hasConversionMetrics(formType)
    ? SEGMENT_METRIC_ORDER
    : SEGMENT_METRIC_ORDER_NONE
}

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
  formType: OverviewLandingFormType
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  summaryKpis: SegmentsSummaryKpi[]
  performanceByLocation: SegmentsTableSection
  performanceByDevice: SegmentsTableSection
  performanceByTime: SegmentsTableSection
}
