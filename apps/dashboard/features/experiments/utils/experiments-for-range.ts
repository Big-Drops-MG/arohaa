import { defaultExperimentsTabTables } from "@/features/experiments/controller/experiments-default-payload"
import type { ExperimentsTabTables } from "@/features/experiments/model/experiments"
import { syncPerformanceByLocationWithVariants } from "@/features/experiments/utils/experiment-table-columns"
import type {
  OverviewDashboardData,
  OverviewDateRangeId,
} from "@/features/overview/model/overview"

export function experimentsForDateRange(
  data: OverviewDashboardData,
  rangeId: OverviewDateRangeId
): ExperimentsTabTables {
  const tables =
    data.experimentsByDateRange[rangeId] ??
    defaultExperimentsTabTables(data.formType)

  return {
    ...tables,
    performanceByLocation: syncPerformanceByLocationWithVariants(
      data.formType,
      tables.variantPerformance,
      tables.performanceByLocation
    ),
  }
}
