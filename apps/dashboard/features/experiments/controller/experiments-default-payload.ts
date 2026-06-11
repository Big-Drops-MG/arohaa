import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { ExperimentsByDateRange } from "@/features/experiments/model/experiments"
import {
  experimentPerformanceByLocationColumns,
  experimentVariantPerformanceColumns,
} from "@/features/experiments/utils/experiment-table-columns"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
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

export function defaultExperimentsTabTables(
  formType: OverviewLandingFormType
): ExperimentsByDateRange[OverviewDateRangeId] {
  return {
    variantPerformance: emptyTable(
      experimentVariantPerformanceColumns(formType)
    ),
    performanceByLocation: emptyTable(
      experimentPerformanceByLocationColumns(formType, [])
    ),
    winningVariantId: null,
  }
}

export function defaultExperimentsByDateRange(
  formType: OverviewLandingFormType
): ExperimentsByDateRange {
  const tables = defaultExperimentsTabTables(formType)
  return Object.fromEntries(
    RANGE_IDS.map((id) => [id, tables])
  ) as ExperimentsByDateRange
}
