import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import type { OverviewDateRangeOption } from "@/features/overview/model/overview"

export type ExperimentVariantId = string

export type ExperimentVariantRef = {
  id: ExperimentVariantId
  label: string
}

export type ExperimentsTabTables = {
  variantPerformance: TrafficBreakdownTable
  performanceByLocation: TrafficBreakdownTable
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

export type ExperimentListRow = {
  id: string
  name: string
  status: string
  variants: string
  startDate: string
  highlighted?: boolean
}

export type ExperimentsTableColumn = {
  key: string
  label: string
}

export type ExperimentsTableRow = Record<string, string>

export type ExperimentsTableSection = {
  title: string
  columns: ExperimentsTableColumn[]
  rows: ExperimentsTableRow[]
}

export type ExperimentsDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  experiments: ExperimentListRow[]
  variantPerformance: ExperimentsTableSection
  performanceByLocation: ExperimentsTableSection
}
