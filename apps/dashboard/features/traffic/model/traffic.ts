import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
} from "@/features/overview/model/overview"

export type TrafficKpiMetricId =
  | "active-users"
  | "visitors"
  | "sessions"
  | "page-views"
  | "bounce-rate"

export type TrafficKpi = {
  id: TrafficKpiMetricId
  label: string
  value: string
}

export type TrafficTableColumn = {
  key: string
  label: string
  align?: "left" | "right"
}

export type TrafficTableRow = Record<string, string>

export type TrafficTableSection = {
  title: string
  columns: TrafficTableColumn[]
  rows: TrafficTableRow[]
}

export type TrafficReferrerRow = {
  domain: string
  visitors: string
}

export type TrafficDashboardData = {
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  defaultKpiMetricId: TrafficKpiMetricId
  kpis: TrafficKpi[]
  trafficByTime: TrafficTableSection
  trafficByDevice: TrafficTableSection
  topPages: TrafficTableSection
  trafficByLocation: TrafficTableSection
  referrers: TrafficReferrerRow[]
  utmParameters: TrafficReferrerRow[]
}
