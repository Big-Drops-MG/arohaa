import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"

export type ExperimentVariantId = string

export type ExperimentVariantRef = {
  id: ExperimentVariantId
  label: string
}

export type ExperimentsTabTables = {
  variantPerformance: TrafficBreakdownTable
  performanceByLocation: TrafficBreakdownTable
  /** When set, matching variant rows and FSR columns are emphasized. */
  winningVariantId: ExperimentVariantId | null
}

export type ExperimentsByDateRange = Record<
  OverviewDateRangeId,
  ExperimentsTabTables
>

export type ExperimentTableHighlight = {
  boldRowVariantIds?: ExperimentVariantId[]
  boldColumnIds?: string[]
}

export function experimentHighlightForTables(tables: ExperimentsTabTables): {
  variantPerformance: ExperimentTableHighlight
  performanceByLocation: ExperimentTableHighlight
} {
  const winner = tables.winningVariantId
  if (!winner) {
    return {
      variantPerformance: {},
      performanceByLocation: {},
    }
  }

  return {
    variantPerformance: { boldRowVariantIds: [winner] },
    performanceByLocation: { boldColumnIds: [`${winner}-fsr`] },
  }
}
