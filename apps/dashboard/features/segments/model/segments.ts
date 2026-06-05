import type { OverviewDateRangeId } from "@/features/overview/model/overview"

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

export type SegmentKpi = {
  id: SegmentMetricId
  label: string
  value: string
}

export type SegmentValuesByMetric = Partial<Record<SegmentMetricId, string>>

export type SegmentsByDateRange = Record<
  OverviewDateRangeId,
  SegmentValuesByMetric
>
