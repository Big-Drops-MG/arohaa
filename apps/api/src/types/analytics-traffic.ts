export type TrafficRangeId =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | '7d'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom'

export const TRAFFIC_RANGE_IDS: readonly TrafficRangeId[] = [
  'today',
  'yesterday',
  'this_week',
  '7d',
  'last_week',
  'this_month',
  'last_month',
  'custom',
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

export type TrafficUtmParamKey =
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'utm_term'
  | 'utm_content'
  | 'utm_id'
  | 'utm_s1'

export interface UtmParamValueRow {
  value: string
  visitors: number
}

export interface UtmParamTab {
  key: TrafficUtmParamKey
  label: string
  rows: UtmParamValueRow[]
}

/** @deprecated Prefer `utmByParam` tabs. Kept for older clients. */
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
  utmByParam: UtmParamTab[]
  /** @deprecated Prefer `utmByParam`. */
  utmParameters: UtmParameterRow[]
}
