import type {
  OverviewDateRangeId,
  OverviewDateRangeOption,
  OverviewLandingFormType,
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

export type TrafficUtmParamKey =
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "utm_id"
  | "utm_s1"

export type TrafficUtmParamValueRow = {
  value: string
  visitors: string
}

export type TrafficUtmParamTab = {
  key: TrafficUtmParamKey
  label: string
  rows: TrafficUtmParamValueRow[]
}

export type TrafficDashboardData = {
  formType: OverviewLandingFormType
  dateRangeOptions: OverviewDateRangeOption[]
  defaultDateRangeId: OverviewDateRangeId
  defaultKpiMetricId: TrafficKpiMetricId
  kpis: TrafficKpi[]
  trafficByTime: TrafficTableSection
  trafficByDevice: TrafficTableSection
  topPages: TrafficTableSection
  trafficByLocation: TrafficTableSection
  referrers: TrafficReferrerRow[]
  utmByParam: TrafficUtmParamTab[]
  /** @deprecated Prefer `utmByParam`. */
  utmParameters: TrafficReferrerRow[]
}

export type TrafficBreakdownColumn = {
  id: string
  label: string
  align?: "left" | "right"
}

export type TrafficBreakdownTable = {
  columns: TrafficBreakdownColumn[]
  rows: TrafficTableRow[]
}

export type TrafficSourcesData = {
  referrers: TrafficBreakdownTable
  utmParameters: TrafficBreakdownTable
}

export type TrafficTabTables = {
  byTime: TrafficBreakdownTable
  byLocation: TrafficBreakdownTable
  byDevice: TrafficBreakdownTable
  sources: TrafficSourcesData
  topPages: TrafficBreakdownTable
}

export type TrafficTablesByDateRange = Record<
  OverviewDateRangeId,
  TrafficTabTables
>
