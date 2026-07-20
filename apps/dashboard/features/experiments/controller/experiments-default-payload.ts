import type { ExperimentsByDateRange } from "@/features/experiments/model/experiments"
import {
  experimentPerformanceByLocationColumns,
  experimentVariantPerformanceColumns,
} from "@/features/experiments/utils/experiment-table-columns"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import { TRAFFIC_RANGE_IDS } from "@/features/traffic/model/traffic-range"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

function emptyTable(
  columns: TrafficBreakdownTable["columns"]
): TrafficBreakdownTable {
  return { columns, rows: [] }
}

export function defaultExperimentsTabTables(
  formType: OverviewLandingFormType
): ExperimentsByDateRange[keyof ExperimentsByDateRange] {
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
    TRAFFIC_RANGE_IDS.map((id) => [id, tables])
  ) as ExperimentsByDateRange
}
