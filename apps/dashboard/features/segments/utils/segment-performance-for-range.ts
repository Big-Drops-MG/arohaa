import { defaultSegmentsPerformanceTables } from "@/features/segments/controller/segments-performance-default-payload"
import type { SegmentsPerformanceTables } from "@/features/segments/model/segments-performance"
import {
  segmentPerformancePeriodColumns,
  segmentPerformancePeriodTitle,
  showSegmentPerformancePeriodCard,
} from "@/features/segments/utils/segment-performance-columns"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

export function segmentPerformanceForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): SegmentsPerformanceTables {
  const tables =
    data.segmentsPerformanceByDateRange[rangeId] ??
    defaultSegmentsPerformanceTables(data.formType, rangeId)

  const expectedPeriodColumns = segmentPerformancePeriodColumns(
    data.formType,
    rangeId
  )

  if (
    tables.byPeriod.columns[0]?.id !== expectedPeriodColumns[0]?.id ||
    tables.byPeriod.columns[0]?.label !== expectedPeriodColumns[0]?.label
  ) {
    return {
      ...tables,
      byPeriod: {
        columns: expectedPeriodColumns,
        rows: tables.byPeriod.rows,
      },
    }
  }

  return tables
}

export { segmentPerformancePeriodTitle, showSegmentPerformancePeriodCard }
