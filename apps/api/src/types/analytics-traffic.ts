export type TrafficRangeId = '24h' | '7d' | '30d' | '3m' | '12m' | '24m'

export const TRAFFIC_RANGE_IDS: readonly TrafficRangeId[] = [
  '24h',
  '7d',
  '30d',
  '3m',
  '12m',
  '24m',
] as const

export function isTrafficRangeId(value: string): value is TrafficRangeId {
  return (TRAFFIC_RANGE_IDS as readonly string[]).includes(value)
}

export interface TrafficKpis {
  activeUsersNow: number
  visitors: number
  sessions: number
  pageViews: number
  bounceRate: number
}

export interface TrafficByTimeRow {
  date: string
  visitors: number
  sessions: number
  formSubmitted: number
}

export interface TrafficByDeviceRow {
  device: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface TopPageRow {
  page: string
  visitors: number
}

export interface TrafficByLocationRow {
  city: string
  visitors: number
  formSubmitted: number
  fsr: number
}

export interface ReferrerRow {
  domain: string
  visitors: number
}

export interface UtmParameterRow {
  domain: string
  visitors: number
}

export interface TrafficDashboardResponse {
  rangeId: TrafficRangeId
  kpis: TrafficKpis
  trafficByTime: TrafficByTimeRow[]
  trafficByDevice: TrafficByDeviceRow[]
  topPages: TopPageRow[]
  trafficByLocation: TrafficByLocationRow[]
  referrers: ReferrerRow[]
  utmParameters: UtmParameterRow[]
}
