import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

export type SegmentsPerformanceTables = {
  byLocation: TrafficBreakdownTable
  byDevice: TrafficBreakdownTable
  byHour: TrafficBreakdownTable
  byPeriod: TrafficBreakdownTable
}

export type SegmentsPerformanceByDateRange = Record<
  OverviewDateRangeId,
  SegmentsPerformanceTables
>
