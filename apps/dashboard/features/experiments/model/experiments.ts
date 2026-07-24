import type { OverviewDateRangeId } from "@/features/overview/model/overview"
import type { OverviewLandingFormType } from "@/features/overview/model/overview"
import type { TrafficBreakdownTable } from "@/features/traffic/model/traffic"
import type { OverviewDateRangeOption } from "@/features/overview/model/overview"
import type {
  ExperimentConfigView,
  SiblingLandingPageOption,
} from "@/lib/server/experiments-store"

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

/**
 * Emphasises the variant whose landing page is being viewed, so the tables read
 * as "this is you" rather than singling out an arbitrary row.
 */
export function experimentHighlightForTables(current: {
  variantRowId: ExperimentVariantId | null
  variantRateColumnId: string | null
}): {
  variantPerformance: ExperimentTableHighlight
  performanceByLocation: ExperimentTableHighlight
  performanceByState: ExperimentTableHighlight
  performanceByZipcode: ExperimentTableHighlight
} {
  const rowHighlight: ExperimentTableHighlight = current.variantRowId
    ? { boldRowVariantIds: [current.variantRowId] }
    : {}
  const columnHighlight: ExperimentTableHighlight = current.variantRateColumnId
    ? { boldColumnIds: [current.variantRateColumnId] }
    : {}

  return {
    variantPerformance: rowHighlight,
    performanceByLocation: columnHighlight,
    performanceByState: columnHighlight,
    performanceByZipcode: columnHighlight,
  }
}

export type ExperimentListRow = {
  id: string
  name: string
  status: string
  variants: string
  startDate: string
  endDate?: string | null
  noEndDate?: boolean
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
  formType: OverviewLandingFormType
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  experiments: ExperimentListRow[]
  variantPerformance: ExperimentsTableSection
  performanceByLocation: ExperimentsTableSection
  performanceByState: ExperimentsTableSection
  performanceByZipcode: ExperimentsTableSection
  controlVariant: string | null
  mode: "multi_domain" | "data_variant"
  winnerCallout: string | null
  config: ExperimentConfigView | null
  siblings: SiblingLandingPageOption[]
}
