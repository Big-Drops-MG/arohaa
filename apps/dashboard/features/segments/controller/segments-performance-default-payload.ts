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
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

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
    TRAFFIC_RANGE_IDS.map((id) => [
      id,
      defaultSegmentsPerformanceTables(formType, id),
    ])
  ) as SegmentsPerformanceByDateRange
}
