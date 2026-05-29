import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
  OverviewFunnelChangeVariant,
} from "@/features/overview/model/overview"

export type FunnelMetricKpi = {
  label: string
  value: string
  change?: string
  changeVariant?: OverviewFunnelChangeVariant
}

export type FunnelStep = {
  label: string
  value: string
  change?: string
  changeVariant?: OverviewFunnelChangeVariant
}

export type FunnelDropOffRow = {
  fieldName: string
  emphasized?: boolean
  dropOffs: string
  percentDrop: string
}

export type FunnelDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  metrics: FunnelMetricKpi[]
  multiStepSteps: FunnelStep[]
  dropOffRows: FunnelDropOffRow[]
}
