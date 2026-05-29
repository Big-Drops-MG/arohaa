export type RangeId = "24h" | "7d" | "30d" | "3m" | "12m" | "24m"

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

export interface FunnelStep {
  label: string
  count: number
}

export interface AnalyticsOverview {
  kpis: Record<RangeId, RangeKpis>
  series: Record<RangeId, SeriesPoint[]>
  funnel: FunnelStep[]
  uniqueVisitors7d: number
  avgEngagedSecPerSession: number
  topCity: string
  bestDayLabel: string
  hasEvents24h: boolean
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

export interface AnalyticsTraffic {
  rangeId: RangeId
  kpis: AnalyticsTrafficKpis
  trafficByTime: AnalyticsTrafficByTimeRow[]
  trafficByDevice: AnalyticsTrafficByDeviceRow[]
  topPages: AnalyticsTopPageRow[]
  trafficByLocation: AnalyticsTrafficByLocationRow[]
  referrers: AnalyticsTrafficReferrerRow[]
  utmParameters: AnalyticsTrafficUtmRow[]
}
