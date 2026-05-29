import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

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
