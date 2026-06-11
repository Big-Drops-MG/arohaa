import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type {
  SegmentsPerformanceByDateRange,
  SegmentsPerformanceTables,
} from "@/features/segments/model/segments-performance"
import {
  segmentPerformanceDeviceColumns,
  segmentPerformanceHourColumns,
  segmentPerformanceLocationColumns,
  segmentPerformancePeriodColumns,
} from "@/features/segments/utils/segment-performance-columns"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

const RANGE_IDS: OverviewDateRangeId[] = [
  "24h",
  "7d",
  "30d",
  "3m",
  "12m",
  "24m",
]

function emptyTable(
  columns: TrafficBreakdownTable["columns"]
): TrafficBreakdownTable {
  return { columns, rows: [] }
}

export function defaultSegmentsPerformanceTables(
  formType: OverviewLandingFormType,
  rangeId: OverviewDateRangeId
): SegmentsPerformanceTables {
  return {
    byLocation: emptyTable(segmentPerformanceLocationColumns(formType)),
    byDevice: emptyTable(segmentPerformanceDeviceColumns(formType)),
    byHour: emptyTable(segmentPerformanceHourColumns(formType)),
    byPeriod: emptyTable(segmentPerformancePeriodColumns(formType, rangeId)),
  }
}

export function defaultSegmentsPerformanceByDateRange(
  formType: OverviewLandingFormType
): SegmentsPerformanceByDateRange {
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, defaultSegmentsPerformanceTables(formType, id)])
  ) as SegmentsPerformanceByDateRange
}
