export type RangeId =
  | "today"
  | "yesterday"
  | "this_week"
  | "7d"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom"

export interface RangeKpis {
  visitors: number
  sessions: number
  pageViews: number
  formSubmitted: number
  bounceRate: number
  fsr: number
}

export interface SeriesPoint {
  label: string
  value: number
}

export type OverviewKpiMetricId =
  | "visitors"
  | "sessions"
  | "page-views"
  | "form-submitted"
  | "fsr"
  | "bounce-rate"

export interface FunnelStep {
  label: string
  count: number
}

export interface AnalyticsOverview {
  rangeId: RangeId
  kpis: RangeKpis
  series: SeriesPoint[]
  kpiSeries: Record<OverviewKpiMetricId, SeriesPoint[]>
  funnel: FunnelStep[]
  uniqueVisitors7d: number
  avgEngagedSecPerSession: number
  topCity: string
  bestDayLabel: string
  hasEvents24h: boolean
  activeUsersNow: number
}

export interface LandingPageCardMetrics {
  activeUsers: number
  formSubmissions7d: number
  bounceRate7d: number
}

export interface AnalyticsTrafficKpis {
  activeUsersNow: number
  visitors: number
  sessions: number
  pageViews: number
  bounceRate: number
}

export interface AnalyticsTrafficByTimeRow {
  date: string
  visitors: number
  sessions: number
  formSubmitted: number
}

export interface AnalyticsTrafficByDeviceRow {
  device: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface AnalyticsTopPageRow {
  page: string
  visitors: number
}

export interface AnalyticsTrafficByLocationRow {
  city: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface AnalyticsTrafficReferrerRow {
  domain: string
  visitors: number
}

export interface AnalyticsTrafficUtmRow {
  domain: string
  visitors: number
}

export type AnalyticsTrafficUtmParamKey =
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "utm_id"
  | "utm_s1"

export interface AnalyticsTrafficUtmParamValueRow {
  value: string
  visitors: number
}

export interface AnalyticsTrafficUtmParamTab {
  key: AnalyticsTrafficUtmParamKey
  label: string
  rows: AnalyticsTrafficUtmParamValueRow[]
}

export interface AnalyticsTraffic {
  rangeId: RangeId
  kpis: AnalyticsTrafficKpis
  trafficByTime: AnalyticsTrafficByTimeRow[]
  trafficByDevice: AnalyticsTrafficByDeviceRow[]
  topPages: AnalyticsTopPageRow[]
  trafficByLocation: AnalyticsTrafficByLocationRow[]
  referrers: AnalyticsTrafficReferrerRow[]
  utmByParam?: AnalyticsTrafficUtmParamTab[]
  /** @deprecated Prefer `utmByParam`. */
  utmParameters: AnalyticsTrafficUtmRow[]
}

export interface AnalyticsFunnelMetric {
  label: string
  count: number
  changePct: number | null
}

export interface AnalyticsFunnelStep {
  label: string
  count: number
  changePct: number | null
}

export interface AnalyticsFunnelDropOffRow {
  fieldName: string
  dropOffs: number
  percentDrop: number
  emphasized: boolean
}

export interface AnalyticsFunnel {
  rangeId: RangeId
  metrics: AnalyticsFunnelMetric[]
  multiStepSteps: AnalyticsFunnelStep[]
  dropOffRows: AnalyticsFunnelDropOffRow[]
}
