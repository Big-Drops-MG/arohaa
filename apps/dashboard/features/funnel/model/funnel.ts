import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
  OverviewFunnelChangeVariant,
} from "@/features/overview/model/overview"

export type FunnelKpiMetricId =
  | "landing-page-visits"
  | "interactions"
  | "form-started"
  | "form-submitted"

export const FUNNEL_KPI_METRIC_IDS: readonly FunnelKpiMetricId[] = [
  "landing-page-visits",
  "interactions",
  "form-started",
  "form-submitted",
] as const

export const FUNNEL_DEFAULT_KPI_METRIC_ID: FunnelKpiMetricId =
  "landing-page-visits"

export function funnelKpiMetricIdAtIndex(index: number): FunnelKpiMetricId {
  return FUNNEL_KPI_METRIC_IDS[index] ?? "landing-page-visits"
}

export type FunnelMetricKpi = {
  id: FunnelKpiMetricId
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
  defaultKpiMetricId: FunnelKpiMetricId
  metrics: FunnelMetricKpi[]
  multiStepSteps: FunnelStep[]
  dropOffRows: FunnelDropOffRow[]
}
